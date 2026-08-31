import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '@/contexts/theme-context';

type FloatingGlassProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  radius?: number;
}>;

/**
 * Native translucent material for controls floating OVER imagery (the
 * result-card action row, contextual overlays) — deliberately not used for
 * ordinary cards/sections, which stay on Vesture's paper/editorial surface
 * treatment. Shadow lives on an outer, non-clipping wrapper since
 * `overflow: hidden` (required to round the BlurView's corners) would
 * otherwise clip it.
 */
export function FloatingGlass({ children, style, contentStyle, radius = 999 }: FloatingGlassProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          borderRadius: radius,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme.dark ? 0.35 : 0.12,
          shadowRadius: 14,
          elevation: 6,
        },
        style,
      ]}>
      <View style={{ borderRadius: radius, overflow: 'hidden' }}>
        <BlurView intensity={44} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <View
          style={[
            { backgroundColor: theme.dark ? 'rgba(31,26,21,0.34)' : 'rgba(255,255,255,0.40)' },
            contentStyle,
          ]}>
          {children}
        </View>
      </View>
    </View>
  );
}
