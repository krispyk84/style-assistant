import { useEffect, useRef } from 'react';
import { PanResponder, View, type DimensionValue } from 'react-native';

import { useTheme } from '@/contexts/theme-context';

type Props = {
  /** 0–100 */
  value: number;
  /** Fires continuously during drag — wire to local state for instant visual feedback. */
  onChange: (value: number) => void;
  /** Fires once when the gesture releases — wire to async persistence to avoid thrash. */
  onChangeEnd?: (value: number) => void;
  accessibilityLabel?: string;
};

export function SensitivitySlider({ value, onChange, onChangeEnd, accessibilityLabel }: Props) {
  const { theme } = useTheme();
  const trackMetrics = useRef({ x: 0, width: 1 });
  const trackRef = useRef<View>(null);

  // Capture latest callbacks in refs so the PanResponder (created once at mount)
  // never reads stale closures when the parent re-renders.
  const onChangeRef = useRef(onChange);
  const onChangeEndRef = useRef(onChangeEnd);
  const lastValueRef = useRef(value);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onChangeEndRef.current = onChangeEnd; }, [onChangeEnd]);
  useEffect(() => { lastValueRef.current = value; }, [value]);

  function measureTrack() {
    trackRef.current?.measureInWindow((x, _y, width) => {
      trackMetrics.current = { x, width: width || 1 };
    });
  }

  function valueFromPageX(pageX: number): number {
    const ratio = (pageX - trackMetrics.current.x) / trackMetrics.current.width;
    return Math.round(Math.min(100, Math.max(0, ratio * 100)));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: (evt) => {
        // Re-measure on every gesture start so scroll/layout shifts don't leave stale x.
        measureTrack();
        const next = valueFromPageX(evt.nativeEvent.pageX);
        lastValueRef.current = next;
        onChangeRef.current(next);
      },
      onPanResponderMove: (evt) => {
        const next = valueFromPageX(evt.nativeEvent.pageX);
        lastValueRef.current = next;
        onChangeRef.current(next);
      },
      onPanResponderRelease: () => {
        onChangeEndRef.current?.(lastValueRef.current);
      },
      onPanResponderTerminate: () => {
        onChangeEndRef.current?.(lastValueRef.current);
      },
    }),
  ).current;

  const thumbPercent = `${value}%` as DimensionValue;

  return (
    <View
      ref={trackRef}
      {...panResponder.panHandlers}
      onLayout={measureTrack}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={{ height: 44, justifyContent: 'center' }}>

      <View
        style={{
          backgroundColor: theme.colors.border,
          borderRadius: 4,
          height: 6,
          overflow: 'hidden',
        }}>
        <View
          style={{
            backgroundColor: theme.colors.accent,
            borderRadius: 4,
            height: '100%',
            width: thumbPercent,
          }}
        />
      </View>

      <View
        pointerEvents="none"
        style={{
          backgroundColor: theme.colors.text,
          borderRadius: 11,
          height: 22,
          left: thumbPercent,
          position: 'absolute',
          transform: [{ translateX: -11 }],
          width: 22,
        }}
      />
    </View>
  );
}
