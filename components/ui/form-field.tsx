import { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type FormFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, hint, error, children }: FormFieldProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="sectionTitle">{label}</AppText>
        {hint ? <AppText tone="muted">{hint}</AppText> : null}
      </View>
      {children}
      {error ? <AppText style={{ color: '#D26A5C' }}>{error}</AppText> : null}
    </View>
  );
}
