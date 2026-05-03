import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { AnimatedLoadingBar } from '@/components/generated/AnimatedLoadingBar';
import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { RemoteImagePanel, SKETCH_ASPECT_RATIO } from '@/components/ui/remote-image-panel';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

export type GeneratedSketchStatus =
  | 'ready'
  | 'pending'
  | 'loading'
  | 'failed'
  | 'not_started'
  | null
  | undefined;

type GeneratedSketchPanelProps = {
  status?: GeneratedSketchStatus;
  imageUrl?: string | null;
  mode?: 'large' | 'compact';
  minHeight?: number;
  unavailableMinHeight?: number;
  aspectRatio?: number;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  pendingTitle?: string;
  pendingMessage?: string;
  fallbackTitle?: string;
  fallbackMessage?: string;
  loadingLabel?: string;
  idleLabel?: string;
  failedLabel?: string;
  actionLabel?: string;
  failedActionLabel?: string;
  isRegenerating?: boolean;
  regeneratingLabel?: string;
  onAction?: () => void;
};

export function GeneratedSketchPanel({
  status,
  imageUrl,
  mode = 'large',
  minHeight = 400,
  unavailableMinHeight = 180,
  aspectRatio = SKETCH_ASPECT_RATIO,
  resizeMode = 'contain',
  pendingTitle = 'Rendering sketch...',
  pendingMessage = 'This illustration will appear automatically when it is ready.',
  fallbackTitle = 'Sketch unavailable',
  fallbackMessage = 'The outfit details are still usable even when the illustration is unavailable.',
  loadingLabel = 'Generating sketch...',
  idleLabel = 'No sketch yet',
  failedLabel = 'Sketch failed. Try again.',
  actionLabel = 'Generate Sketch',
  failedActionLabel = 'Retry Sketch',
  isRegenerating = false,
  regeneratingLabel = 'Finding a new outfit...',
  onAction,
}: GeneratedSketchPanelProps) {
  const { theme } = useTheme();
  const hasImage = status === 'ready' && Boolean(imageUrl);

  if (mode === 'compact') {
    if (hasImage) {
      return (
        <Image
          source={{ uri: imageUrl! }}
          style={{ aspectRatio, width: '100%' }}
          resizeMode={resizeMode}
        />
      );
    }

    if (isRegenerating) {
      return (
        <View
          style={{
            backgroundColor: theme.colors.subtleSurface,
            gap: spacing.sm,
            height: 80,
            justifyContent: 'center',
            paddingHorizontal: spacing.lg,
            width: '100%',
          }}>
          <AppText style={{ color: theme.colors.mutedText, fontSize: 12, textAlign: 'center' }}>
            {regeneratingLabel}
          </AppText>
          <AnimatedLoadingBar height={3} marginBottom={0} />
        </View>
      );
    }

    if (status === 'loading' || status === 'pending') {
      return (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.subtleSurface,
            gap: spacing.xs,
            height: 80,
            justifyContent: 'center',
            width: '100%',
          }}>
          <ActivityIndicator color={theme.colors.subtleText} size="small" />
          <AppText style={{ color: theme.colors.mutedText, fontSize: 12 }}>
            {loadingLabel}
          </AppText>
        </View>
      );
    }

    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.subtleSurface,
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.lg,
          width: '100%',
        }}>
        <AppIcon name="sparkles" color={theme.colors.subtleText} size={22} />
        <AppText style={{ color: theme.colors.mutedText, fontSize: 12, textAlign: 'center' }}>
          {status === 'failed' ? failedLabel : idleLabel}
        </AppText>
        {onAction ? (
          <Pressable
            onPress={onAction}
            style={{
              backgroundColor: theme.colors.text,
              borderRadius: 999,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            }}>
            <AppText
              style={{
                color: theme.colors.inverseText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}>
              {status === 'failed' ? failedActionLabel : actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (hasImage) {
    return (
      <RemoteImagePanel
        uri={imageUrl}
        aspectRatio={aspectRatio}
        minHeight={minHeight}
        resizeMode={resizeMode}
        fallbackTitle={fallbackTitle}
        fallbackMessage="The illustration could not be displayed on this device."
      />
    );
  }

  if (status === 'pending' || status === 'loading' || !status) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: 22,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight,
          padding: spacing.lg,
        }}>
        <AnimatedLoadingBar />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
            {pendingTitle}
          </AppText>
          <AppText tone="muted" style={{ textAlign: 'center' }}>
            {pendingMessage}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderRadius: 22,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: unavailableMinHeight,
        padding: spacing.lg,
      }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
          {fallbackTitle}
        </AppText>
        <AppText tone="muted" style={{ textAlign: 'center' }}>
          {fallbackMessage}
        </AppText>
      </View>
    </View>
  );
}
