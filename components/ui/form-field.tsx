import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type FormFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

export function FormField({ label, hint, error, required, children }: FormFieldProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="sectionTitle">{label}</AppText>
          {required && (
            <View 
              style={{ 
                width: 6, 
                height: 6, 
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.accent,
              }} 
            />
          )}
        </View>
        {hint && <AppText variant="caption" tone="subtle">{hint}</AppText>}
      </View>
      {children}
      {error && (
        <View 
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            gap: spacing.xs,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
            backgroundColor: theme.colors.dangerLight,
            borderRadius: theme.radius.sm,
          }}>
          <Ionicons name="alert-circle-outline" size={14} color={theme.colors.danger} />
          <AppText variant="caption" style={{ color: theme.colors.danger }}>{error}</AppText>
        </View>
      )}
    </View>
  );
}
