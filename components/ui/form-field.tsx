import { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type FormFieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, hint, error, children }: FormFieldProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      {label || hint ? (
        <View style={{ gap: spacing.xs }}>
          {label ? <AppText variant="sectionTitle">{label}</AppText> : null}
          {hint ? <AppText tone="muted">{hint}</AppText> : null}
        </View>
      ) : null}
      {children}
      {error ? <AppText style={{ color: '#D26A5C' }}>{error}</AppText> : null}
    </View>
  );
}
