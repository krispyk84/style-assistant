import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing, theme } from '@/constants/theme';

// ── OptionalItemRow ───────────────────────────────────────────────────────────

type OptionalItemRowProps = {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
};

export function OptionalItemRow({ label, description, checked, onToggle }: OptionalItemRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
      }}>
      <AppIcon
        color={checked ? theme.colors.accent : theme.colors.mutedText}
        name={checked ? 'check-circle' : 'circle'}
        size={22}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ color: theme.colors.text, fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
          {label}
        </AppText>
        <AppText tone="muted" style={{ fontSize: 12, lineHeight: 17 }}>
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}

// ── ActionPill ────────────────────────────────────────────────────────────────

type ActionPillProps = {
  label: string;
  icon?: AppIconName;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function ActionPill({ label, icon, onPress, disabled = false, loading = false }: ActionPillProps) {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.subtleSurface,
        borderColor: loading ? theme.colors.accent : theme.colors.border,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.xs,
        justifyContent: 'center',
        minHeight: 44,
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: spacing.md,
      }}>
      {loading ? (
        <ActivityIndicator color={theme.colors.accent} size={14} />
      ) : icon ? (
        <AppIcon color={theme.colors.text} name={icon} size={16} />
      ) : null}
      <AppText style={loading ? { color: theme.colors.accent } : undefined}>{label}</AppText>
    </Pressable>
  );
}
