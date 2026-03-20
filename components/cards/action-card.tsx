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
  variant?: 'default' | 'featured';
};

export function ActionCard({ title, description, href, icon = 'arrow-forward-outline', variant = 'default' }: ActionCardProps) {
  const isFeatured = variant === 'featured';
  
  const content = (
    <View
      style={[
        {
          backgroundColor: isFeatured ? theme.colors.text : theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        !isFeatured && {
          borderColor: theme.colors.border,
          borderWidth: 1,
        },
        theme.shadows.md,
      ]}>
      <View 
        style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: spacing.xs,
        }}>
        <View 
          style={{ 
            width: 44, 
            height: 44, 
            borderRadius: theme.radius.md,
            backgroundColor: isFeatured ? 'rgba(255,255,255,0.15)' : theme.colors.accentLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons 
            color={isFeatured ? theme.colors.surface : theme.colors.accent} 
            name={icon} 
            size={22} 
          />
        </View>
        <View 
          style={{ 
            width: 32, 
            height: 32, 
            borderRadius: theme.radius.full,
            backgroundColor: isFeatured ? 'rgba(255,255,255,0.1)' : theme.colors.borderSubtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons 
            color={isFeatured ? theme.colors.surface : theme.colors.mutedText} 
            name="chevron-forward" 
            size={16} 
          />
        </View>
      </View>
      <AppText 
        variant="title" 
        tone={isFeatured ? 'inverse' : 'default'}
      >
        {title}
      </AppText>
      <AppText 
        variant="caption"
        tone={isFeatured ? 'inverse' : 'muted'}
        style={isFeatured ? { opacity: 0.8 } : undefined}
      >
        {description}
      </AppText>
    </View>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        {content}
      </Pressable>
    </Link>
  );
}
