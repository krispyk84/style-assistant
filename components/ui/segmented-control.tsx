import { Animated, Pressable, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { useTheme } from '@/contexts/theme-context';
import { AppText } from '@/components/ui/app-text';

const INSET = 3;
const CONTROL_HEIGHT = 42;

type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const { theme } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = Math.max(0, options.indexOf(value));
  const pillWidth = containerWidth > 0 ? (containerWidth - INSET * 2) / options.length : 0;
  const translateX = useRef(new Animated.Value(0)).current;
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (pillWidth === 0) return;
    const toValue = activeIndex * pillWidth;
    if (!hasInitialized.current) {
      translateX.setValue(toValue);
      hasInitialized.current = true;
      return;
    }
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.7,
    }).start();
  }, [activeIndex, pillWidth, translateX]);

  const pillBackground = theme.dark ? theme.colors.card : theme.colors.surface;

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={{
        backgroundColor: theme.colors.subtleSurface,
        borderRadius: 999,
        flexDirection: 'row',
        height: CONTROL_HEIGHT,
        padding: INSET,
      }}>

      {/* Floating selected pill — absolutely positioned, pointer-events disabled so taps reach segments */}
      {pillWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            backgroundColor: pillBackground,
            borderRadius: 999,
            bottom: INSET,
            left: INSET,
            position: 'absolute',
            top: INSET,
            transform: [{ translateX }],
            width: pillWidth,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: theme.dark ? 0.28 : 0.10,
            shadowRadius: 3,
            elevation: 2,
          }}
        />
      )}

      {options.map((option) => {
        const isActive = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(option)}
            style={{
              alignItems: 'center',
              flex: 1,
              justifyContent: 'center',
              zIndex: 1,
            }}>
            <AppText
              numberOfLines={1}
              style={{
                color: isActive ? theme.colors.text : theme.colors.subtleText,
                fontFamily: isActive ? theme.fonts.sansMedium : theme.fonts.sans,
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}>
              {option.replaceAll('-', ' ')}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
