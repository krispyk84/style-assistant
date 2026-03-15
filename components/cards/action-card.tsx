import { Ionicons } from '@expo/vector-icons';
import { Href, Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

type ActionCardProps = {
  title: string;
  description: string;
  href?: Href;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function ActionCard({ title, description, href, icon = 'arrow-forward-outline' }: ActionCardProps) {
  const content = (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 28,
        borderWidth: 1,
        padding: spacing.lg,
        gap: spacing.sm,
      }}>
      <Ionicons color={theme.colors.text} name={icon} size={20} />
      <AppText variant="title">{title}</AppText>
      <AppText tone="muted">{description}</AppText>
    </View>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} asChild>
      <Pressable>{content}</Pressable>
    </Link>
  );
}
