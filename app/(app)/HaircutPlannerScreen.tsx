import { Image } from 'expo-image';
import { useRef } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { HaircutGuideView } from '@/components/haircut/HaircutGuideView';
import { HaircutSwipeDeck } from '@/components/haircut/HaircutSwipeDeck';
import { useHaircutGuideExport } from '@/components/haircut/useHaircutGuideExport';
import { ImagePickerField } from '@/components/forms/image-picker-field';
import { AppIcon } from '@/components/ui/app-icon';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing, theme } from '@/constants/theme';
import type { HaircutOption } from '@/types/api';
import { useHaircutPlanner } from './useHaircutPlanner';

export function HaircutPlannerScreen() {
  const {
    image, isPicking, isUploading, uploadError,
    pickFromLibrary, handleOpenCamera,
    stage, session, error,
    readyOptions, likedOptions,
    selectedOption, guide,
    startSession, handleSwipedRight, handleSwipedAll, selectFinal, reset,
  } = useHaircutPlanner();

  const viewShotRef = useRef<ViewShot>(null);
  const { isSaving, message: exportMessage, saveToPhotos, shareGuide } = useHaircutGuideExport(viewShotRef);

  const readyCount = session?.options.filter((o) => o.status === 'ready' || o.status === 'failed').length ?? 0;
  const totalCount = session?.options.length ?? 0;

  return (
    <AppScreen scrollable={stage !== 'swipe'} floatingBack>
      <View style={{ flex: 1, gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Haircut Planner" showBack />

        {stage === 'upload' ? (
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="heroSmall">Try on a new haircut</AppText>
              <AppText tone="muted">Upload a clear, front-facing headshot — we&apos;ll render trendy haircuts on your actual photo.</AppText>
            </View>
            <ImagePickerField
              label="Your headshot"
              hint="A well-lit, front-facing photo works best."
              image={image}
              isPicking={isPicking || isUploading}
              error={uploadError}
              statusMessage={isUploading ? 'Uploading...' : null}
              pickLabel="Choose photo"
              cameraLabel="Take photo"
              onPick={() => void pickFromLibrary()}
              onTakePhoto={handleOpenCamera}
              onRemove={reset}
            />
            <PrimaryButton
              label="Find My Haircut"
              disabled={!image || isUploading}
              onPress={() => void startSession()}
            />
          </View>
        ) : null}

        {stage === 'generating' ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
            <ActivityIndicator color={theme.colors.accent} size="large" />
            <AppText tone="muted" style={{ textAlign: 'center' }}>
              Rendering trendy haircuts on your photo... {readyCount}/{totalCount || 6}
            </AppText>
          </View>
        ) : null}

        {stage === 'swipe' ? (
          <View style={{ flex: 1, gap: spacing.md }}>
            <AppText tone="muted" style={{ textAlign: 'center', fontSize: 13 }}>
              Swipe right to like, left to pass
            </AppText>
            <HaircutSwipeDeck options={readyOptions} onSwipedRight={handleSwipedRight} onSwipedAll={handleSwipedAll} />
          </View>
        ) : null}

        {stage === 'narrowed' ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="heroSmall">Your favorites</AppText>
              <AppText tone="muted">Pick one to build your barber guide.</AppText>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {likedOptions.map((option) => (
                <HaircutOptionCard key={option.id} option={option} onPress={() => void selectFinal(option)} />
              ))}
            </View>
          </View>
        ) : null}

        {stage === 'guide-loading' ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
            <ActivityIndicator color={theme.colors.accent} size="large" />
            <AppText tone="muted" style={{ textAlign: 'center' }}>Writing your barber guide...</AppText>
          </View>
        ) : null}

        {stage === 'guide' && selectedOption && guide ? (
          <View style={{ gap: spacing.lg }}>
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
              <HaircutGuideView option={selectedOption} guide={guide} />
            </ViewShot>
            {exportMessage ? (
              <AppText tone="muted" style={{ textAlign: 'center', fontSize: 12 }}>{exportMessage}</AppText>
            ) : null}
            <PrimaryButton label="Save to Photos" onPress={() => void saveToPhotos()} disabled={isSaving} />
            <PrimaryButton label="Share / Save to Files" onPress={() => void shareGuide()} variant="secondary" disabled={isSaving} />
            <PrimaryButton label="Start Over" onPress={reset} variant="secondary" />
          </View>
        ) : null}

        {stage === 'error' ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
            <AppText style={{ color: theme.colors.danger, textAlign: 'center' }}>{error}</AppText>
            <PrimaryButton label="Start Over" onPress={reset} />
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}

function HaircutOptionCard({ option, onPress }: { option: HaircutOption; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 20,
        borderWidth: 1,
        gap: spacing.xs,
        overflow: 'hidden',
        width: '47%',
      }}>
      {option.imageUrl ? (
        <Image contentFit="cover" source={{ uri: option.imageUrl }} style={{ height: 160, width: '100%' }} />
      ) : (
        <View style={{ alignItems: 'center', backgroundColor: theme.colors.card, height: 160, justifyContent: 'center' }}>
          <AppIcon color={theme.colors.subtleText} name="person" size={28} />
        </View>
      )}
      <View style={{ padding: spacing.sm }}>
        <AppText style={{ fontSize: 13, fontFamily: theme.fonts.sansMedium }}>{option.styleLabel}</AppText>
      </View>
    </Pressable>
  );
}
