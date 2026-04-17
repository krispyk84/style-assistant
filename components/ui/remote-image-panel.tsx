import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageStyle, StyleProp, View } from 'react-native';

import { spacing, theme } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';

/** Standard portrait aspect ratio for all generated outfit sketches (width:height = 2:3). */
export const SKETCH_ASPECT_RATIO = 2 / 3;

type RemoteImagePanelProps = {
  uri: string | null | undefined;
  aspectRatio?: number;
  minHeight?: number;
  fallbackTitle: string;
  fallbackMessage: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
};

export function RemoteImagePanel({
  uri,
  aspectRatio = 3 / 4,
  minHeight = 280,
  fallbackTitle,
  fallbackMessage,
  style,
  resizeMode = 'cover',
}: RemoteImagePanelProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(uri));

  useEffect(() => {
    setHasError(false);
    setIsLoading(Boolean(uri));
  }, [uri]);

  useEffect(() => {
    if (!uri || !isLoading) {
      return;
    }

    const timeout = setTimeout(() => {
      setHasError(true);
      setIsLoading(false);
    }, 8000);

    return () => clearTimeout(timeout);
  }, [uri, isLoading]);

  if (!uri || hasError) {
    return (
      <FallbackCard
        minHeight={minHeight}
        title={fallbackTitle}
        message={fallbackMessage}
      />
    );
  }

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        borderRadius: 22,
        justifyContent: 'center',
        minHeight,
        overflow: 'hidden',
      }}>
      <Image
        source={{ uri }}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        onLoad={() => setIsLoading(false)}
        resizeMode={resizeMode}
        style={[
          {
            aspectRatio,
            backgroundColor: theme.colors.card,
            borderRadius: 22,
            width: '100%',
          },
          style,
        ]}
      />
      {isLoading ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.card,
            bottom: 0,
            justifyContent: 'center',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
          }}>
          <ActivityIndicator color={theme.colors.text} />
        </View>
      ) : null}
    </View>
  );
}

function FallbackCard({
  minHeight,
  title,
  message,
}: {
  minHeight: number;
  title: string;
  message: string;
}) {
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
      <View style={{ gap: spacing.xs }}>
        <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>
          {title}
        </AppText>
        <AppText tone="muted" style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      </View>
    </View>
  );
}
