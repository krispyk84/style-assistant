import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, type PropsWithChildren, type RefObject, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

// How far past the computed native max offset (contentSize - viewport +
// contentInset.bottom) counts as a real overscroll for diagnostic purposes,
// vs. float/rounding noise from Yoga layout.
const OVERSCROLL_LOG_TOLERANCE = 2;

type AppScreenProps = PropsWithChildren<{
  scrollable?: boolean;
  topInset?: boolean;
  /** When true, shows a floating "Back" button after the user scrolls down. */
  floatingBack?: boolean;
  /** When true, shows a permanent back chevron row above the content. */
  backButton?: boolean;
  /** Optional ref forwarded to the inner ScrollView (only meaningful when scrollable=true). */
  scrollRef?: RefObject<ScrollView | null>;
  /** Optional scroll handler forwarded to the inner ScrollView. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Optional refresh control forwarded to the inner ScrollView. */
  refreshControl?: ScrollViewProps['refreshControl'];
  /**
   * When false, disables rubber-band/momentum overscroll (default true, matching
   * iOS's native ScrollView default). Turn off on screens whose content height
   * changes dynamically and abruptly (e.g. an image appearing) — a fling gesture
   * whose momentum was calculated against the old (shorter) content can overshoot
   * scroll bounds once content grows mid-gesture, and without bounce enabled to
   * self-correct, the scroll view can be left stuck past the end of its content.
   */
  bounces?: boolean;
  /**
   * When true, enables automaticallyAdjustKeyboardInsets on the ScrollView so
   * content scrolls clear of the keyboard as it opens. Default FALSE — opt in
   * only on screens with a real text input. That prop pads content based on
   * native keyboard-geometry-change notifications, and on screens with no
   * text input (so no real keyboard interaction is possible), a dismissing
   * system sheet (e.g. a photo picker) can fire a similar geometry-change
   * notification that gets misread as a keyboard appearing — adding a bottom
   * content inset that never clears, since no real keyboard-hide event
   * follows it. This was the actual root cause of a recurring "scrolls past
   * the real end into blank space" bug across the app; defaulting this to
   * false (rather than defaulting on and special-casing every non-form
   * screen) means a newly added screen can't silently reintroduce it.
   */
  avoidsKeyboard?: boolean;
}>;

const FLOATING_BACK_THRESHOLD = 80;

export function AppScreen({
  children,
  scrollable = false,
  topInset = true,
  floatingBack = false,
  backButton = false,
  scrollRef,
  onScroll,
  refreshControl,
  bounces = true,
  avoidsKeyboard = false,
}: AppScreenProps) {
  const [showFloatingBack, setShowFloatingBack] = useState(false);
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  // Falls back to an internally-owned ref when the caller doesn't pass one —
  // screens that DO pass their own scrollRef (for their own intentional
  // reset-to-top effects on real content changes) share this same ref; both
  // operate on the identical ScrollView.
  const internalScrollRef = useRef<ScrollView>(null);
  const effectiveScrollRef = scrollRef ?? internalScrollRef;

  // Diagnostics only — no corrective scrollTo(). An earlier version of this
  // component imperatively clamped the scroll offset back on every content
  // resize, which both (a) didn't account for contentInset.bottom in its max-
  // offset math, so it could clamp to the wrong position, and (b) risked
  // fighting native momentum/gesture handling (a related per-onScroll variant
  // of this pattern once made buttons across the app untappable). The actual
  // root cause of "scrolled past the end into blank space" was AppScreen
  // defaulting avoidsKeyboard to true (see that prop's doc comment) — with
  // that fixed and normal iOS bounce left on, native UIScrollView already
  // self-corrects an offset that outlives a content shrink (that's what
  // elastic bounce is for) without any JS involvement. These refs + logs are
  // kept as a lightweight, temporary way to confirm that in the field; they
  // never call scrollTo.
  const scrollViewHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const contentOffsetYRef = useRef(0);
  const contentInsetBottomRef = useRef(0);
  const logScrollDiagnostics = useCallback((event: string) => {
    if (!__DEV__) return;
    const maxOffset = Math.max(
      0,
      contentHeightRef.current - scrollViewHeightRef.current + contentInsetBottomRef.current,
    );
    const overscrolled = contentOffsetYRef.current > maxOffset + OVERSCROLL_LOG_TOLERANCE;
    console.log(`[AppScreen:${event}]`, {
      offsetY: contentOffsetYRef.current,
      contentHeight: contentHeightRef.current,
      viewportHeight: scrollViewHeightRef.current,
      contentInsetBottom: contentInsetBottomRef.current,
      maxOffset,
      overscrolled,
    });
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    scrollViewHeightRef.current = e.nativeEvent.layout.height;
    logScrollDiagnostics('layout');
  }, [logScrollDiagnostics]);
  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeightRef.current = height;
    logScrollDiagnostics('contentSizeChange');
  }, [logScrollDiagnostics]);
  const handleMomentumScrollEnd = useCallback(() => {
    logScrollDiagnostics('momentumScrollEnd');
  }, [logScrollDiagnostics]);

  useFocusEffect(useCallback(() => {
    logScrollDiagnostics('focus');
  }, [logScrollDiagnostics]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') logScrollDiagnostics('resume');
    });
    return () => subscription.remove();
  }, [logScrollDiagnostics]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      contentOffsetYRef.current = e.nativeEvent.contentOffset.y;
      contentInsetBottomRef.current = e.nativeEvent.contentInset?.bottom ?? 0;
      if (floatingBack) {
        setShowFloatingBack(e.nativeEvent.contentOffset.y > FLOATING_BACK_THRESHOLD);
      }
      onScroll?.(e);
    },
    [floatingBack, onScroll],
  );

  // flex: 1 only makes sense for the non-scrollable case (fill the screen for
  // static content). Inside a ScrollView, giving the sole content child
  // flex: 1 creates a circular sizing constraint against the ScrollView's own
  // contentContainerStyle flexGrow: 1 — normally invisible, but Yoga can
  // resolve it inconsistently whenever content height changes asynchronously
  // (an image swapping in, a card mounting/unmounting), leaving the scroll
  // view showing a stale/collapsed layout. contentContainerStyle's
  // flexGrow: 1 alone already makes short content fill the viewport without
  // needing this child to also carry flex: 1.
  const content = (
    <View
      style={{
        ...(scrollable ? null : { flex: 1 }),
        paddingHorizontal: spacing.lg,
        paddingTop: topInset ? spacing.md : spacing.xs,
        paddingBottom: spacing.xl,
      }}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']}>
      {backButton ? (
        <Pressable
          onPress={() => router.back()}
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            gap: spacing.xs,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
          }}>
          <AppIcon color={theme.colors.text} name="chevron-left" size={18} />
          <AppText style={{ fontSize: 15 }}>Back</AppText>
        </Pressable>
      ) : null}
      {scrollable ? (
        <ScrollView
          ref={effectiveScrollRef}
          automaticallyAdjustKeyboardInsets={avoidsKeyboard}
          bounces={bounces}
          // SafeAreaView (above) already handles safe-area insets explicitly
          // via its `edges` prop + this component's own paddingTop; letting
          // iOS ALSO auto-adjust contentInset for safe area on top of that
          // double-counts it.
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        content
      )}

      {floatingBack && showFloatingBack ? (
        <Pressable
          onPress={() => router.back()}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 999,
            borderWidth: 1,
            elevation: 4,
            flexDirection: 'row',
            gap: spacing.xs,
            left: spacing.lg,
            top: insets.top + spacing.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            position: 'absolute',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
          }}>
          <AppIcon color={theme.colors.text} name="arrow-left" size={16} />
          <AppText style={{ fontSize: 14 }}>Back</AppText>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
