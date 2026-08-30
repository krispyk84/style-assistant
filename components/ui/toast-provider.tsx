import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type ToastTone = 'success' | 'error';
type ToastAction = { label: string; onPress: () => void };

type ToastContextValue = {
  /** Pass `action` (e.g. { label: 'Undo', onPress }) to show an inline action
   * button and give the toast longer to stay up before it auto-dismisses. */
  showToast: (message: string, tone?: ToastTone, action?: ToastAction) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 2000;
const ACTION_DURATION_MS = 4000;

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone; action?: ToastAction } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const dismiss = useCallback(() => {
    animationRef.current?.stop();
    Animated.timing(opacity, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [opacity]);

  const value = useMemo(
    () => ({
      showToast(message: string, tone: ToastTone = 'success', action?: ToastAction) {
        setToast({ message, tone, action });
        opacity.setValue(0);

        const sequence = Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(action ? ACTION_DURATION_MS : DEFAULT_DURATION_MS),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 180,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]);
        animationRef.current = sequence;
        sequence.start(({ finished }) => {
          if (finished) setToast(null);
        });
      },
    }),
    [opacity]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        // box-none: the empty margin around the toast card passes touches
        // through to whatever's underneath, but the card's own Undo button
        // (if present) still receives taps normally.
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: spacing.xxl * 2,
            alignItems: 'center',
          }}>
          <Animated.View
            style={{
              opacity,
              alignItems: 'center',
              flexDirection: 'row',
              gap: spacing.md,
              justifyContent: 'space-between',
              backgroundColor: toast.tone === 'success' ? theme.colors.card : theme.colors.danger,
              borderColor: theme.colors.border,
              borderRadius: 18,
              borderWidth: 1,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              width: '100%',
            }}>
            <AppText
              style={{
                flex: 1,
                color: toast.tone === 'success' ? theme.colors.text : theme.colors.surface,
                textAlign: toast.action ? 'left' : 'center',
              }}>
              {toast.message}
            </AppText>
            {toast.action ? (
              <Pressable
                hitSlop={10}
                onPress={() => {
                  const action = toast.action;
                  dismiss();
                  action?.onPress();
                }}>
                <AppText
                  style={{
                    color: toast.tone === 'success' ? theme.colors.accent : theme.colors.surface,
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 13,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}>
                  {toast.action.label}
                </AppText>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
