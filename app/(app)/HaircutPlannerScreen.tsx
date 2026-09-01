import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { HaircutGuideView } from '@/components/haircut/HaircutGuideView';
import { HairstyleTrendReportModal } from '@/components/haircut/HairstyleTrendReportModal';
import { HaircutSwipeDeck } from '@/components/haircut/HaircutSwipeDeck';
import { useHaircutGuideExport } from '@/components/haircut/useHaircutGuideExport';
import { ImagePickerField } from '@/components/forms/image-picker-field';
import { AppIcon } from '@/components/ui/app-icon';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import type { HaircutOption, SavedHaircutSession } from '@/types/api';
import { useHaircutPlanner } from './useHaircutPlanner';
import { useHairstyleTrendReport } from './useHairstyleTrendReport';

export function HaircutPlannerScreen() {
  const {
    image, isPicking, isUploading, uploadError,
    pickFromLibrary, handleOpenCamera,
    stage, session, error,
    currentBatch, batchIndex, likedOptions,
    selectedOption, guide, angleShots, angleShotsError, isLoadingAngleShots,
    savedSessions, isLoadingSavedSessions, isSavingSession, isCurrentSessionSaved,
    deletingSessionId,
    startSession, handleSwipedRight, handleSwipedLeft, handleSwipedAll,
    reviewFavorites, requestMoreHaircuts, selectFinal, reset, goBack,
    saveHaircut, unsaveHaircut, openSavedSession, deleteSavedSession,
  } = useHaircutPlanner();

  const trendReport = useHairstyleTrendReport();

  const viewShotRef = useRef<ViewShot>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const { isSaving, message: exportMessage, saveToPhotos, shareGuide } = useHaircutGuideExport(viewShotRef, setIsCapturing);

  const readyCount = session?.options.filter((o) => o.status === 'ready' || o.status === 'failed').length ?? 0;
  const totalCount = session?.options.length ?? 0;

  // The ScrollView keeps whatever scroll offset it had before content resizes.
  // Stages vary hugely in content height (the upload form vs. a short spinner),
  // and within the upload stage itself, picking a photo grows the content by
  // several hundred px in one update (empty dashed box -> image preview). A
  // stale offset relative to the new (shorter or taller) content can leave the
  // viewport pointed past the end of it — reset to top whenever the stage OR
  // the picked image changes so the new content always starts visible.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [stage, image]);

  return (
    <AppScreen scrollable={stage !== 'swipe'} scrollRef={scrollRef} avoidsKeyboard={false}>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        {/* Tab bar navigates away, so a back button here is only shown where
            it steps back one stage within this flow (narrowed/guide) rather
            than just re-exiting the whole screen — see useHaircutPlanner's
            goBack() for which stages that applies to. */}
        {stage === 'upload' ? (
          <View style={{ gap: spacing.lg }}>
            <AppText variant="heroSmall">Haircut Planner</AppText>
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

            <Pressable
              onPress={() => void trendReport.open()}
              style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
              <AppIcon color={theme.colors.accent} name="sparkles" size={16} />
              <AppText style={{ color: theme.colors.accent, fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>
                Hairstyle Trend Report
              </AppText>
            </Pressable>

            {isLoadingSavedSessions ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <ActivityIndicator color={theme.colors.accent} size="small" />
              </View>
            ) : savedSessions.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <AppText variant="sectionTitle">Saved haircuts</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {savedSessions.map((saved) => (
                    <SavedHaircutCard
                      key={saved.sessionId}
                      saved={saved}
                      onPress={() => openSavedSession(saved)}
                      onDelete={() => void deleteSavedSession(saved.sessionId)}
                      isDeleting={deletingSessionId === saved.sessionId}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
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
          <View style={{ gap: spacing.md }}>
            <HaircutSwipeDeck
              key={batchIndex}
              options={currentBatch}
              onSwipedRight={handleSwipedRight}
              onSwipedLeft={handleSwipedLeft}
              onSwipedAll={handleSwipedAll}
            />
            <AppText tone="muted" style={{ textAlign: 'center', fontSize: 13 }}>
              Swipe right to like, left to discard
            </AppText>
          </View>
        ) : null}

        {stage === 'swipe-choice' ? (
          <View style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl }}>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="heroSmall" style={{ textAlign: 'center' }}>That's all of them</AppText>
              <AppText tone="muted" style={{ textAlign: 'center' }}>
                {likedOptions.length > 0
                  ? `You liked ${likedOptions.length} so far. Want to see more, or ready to review your favorites?`
                  : 'You haven\'t liked any yet. See more haircuts to keep looking.'}
              </AppText>
            </View>
            {error ? (
              <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>{error}</AppText>
            ) : null}
            <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
              <PrimaryButton label="See More Haircuts" onPress={() => void requestMoreHaircuts()} />
              <PrimaryButton
                label="Review My Favorites"
                onPress={reviewFavorites}
                variant="secondary"
                disabled={likedOptions.length === 0}
              />
            </View>
          </View>
        ) : null}

        {stage === 'more-loading' ? (
          <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
            <ActivityIndicator color={theme.colors.accent} size="large" />
            <AppText tone="muted" style={{ textAlign: 'center' }}>
              Rendering more haircuts on your photo... {readyCount}/{totalCount}
            </AppText>
          </View>
        ) : null}

        {stage === 'narrowed' ? (
          <View style={{ gap: spacing.md }}>
            <BackChevron onPress={goBack} />
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
            {/* Outside ViewShot — it captures everything inside it for the
                Save to Photos / Share export, so an app-only back control
                has no place baked into that exported image. */}
            <BackChevron onPress={goBack} />
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
              <HaircutGuideView
                option={selectedOption}
                guide={guide}
                angleShots={angleShots}
                isLoadingAngleShots={isLoadingAngleShots}
                angleShotsError={angleShotsError}
                isSaved={isCurrentSessionSaved}
                isSaving={isSavingSession}
                onSave={() => void saveHaircut()}
                onUnsave={() => void unsaveHaircut()}
                hideSaveButton={isCapturing}
              />
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

      <HairstyleTrendReportModal
        visible={trendReport.isOpen}
        isLoading={trendReport.isLoading}
        isGenerating={trendReport.isGenerating}
        styles={trendReport.styles}
        isStale={trendReport.isStale}
        error={trendReport.error}
        onClose={trendReport.close}
      />
    </AppScreen>
  );
}

/** Bare back chevron, no label — used only where goBack() steps back one
 * stage within this flow (narrowed/guide), not to leave the screen (the tab
 * bar already does that everywhere else in the flow). */
function BackChevron({ onPress }: { onPress: () => void }) {
  return (
    <Pressable hitSlop={8} onPress={onPress} style={{ alignSelf: 'flex-start' }}>
      <AppIcon color={theme.colors.text} name="chevron-left" size={24} />
    </Pressable>
  );
}

function SavedHaircutCard({
  saved, onPress, onDelete, isDeleting,
}: {
  saved: SavedHaircutSession;
  onPress: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 16,
        borderWidth: 1,
        gap: spacing.xs,
        overflow: 'hidden',
        width: 120,
      }}>
      <View style={{ alignItems: 'center', backgroundColor: theme.colors.card, height: 120, justifyContent: 'center', width: '100%' }}>
        {saved.option.imageUrl ? (
          <Image contentFit="contain" source={{ uri: saved.option.imageUrl }} style={{ height: '100%', width: '100%' }} />
        ) : (
          <AppIcon color={theme.colors.subtleText} name="person" size={24} />
        )}
        <Pressable
          accessibilityLabel="Delete saved haircut"
          disabled={isDeleting}
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderRadius: 999,
            height: 24,
            justifyContent: 'center',
            opacity: isDeleting ? 0.5 : 1,
            position: 'absolute',
            right: 4,
            top: 4,
            width: 24,
          }}>
          {isDeleting ? (
            <ActivityIndicator color={theme.colors.danger} size="small" />
          ) : (
            <AppIcon color={theme.colors.danger} name="trash" size={13} />
          )}
        </Pressable>
      </View>
      <AppText style={{ fontSize: 12, fontFamily: theme.fonts.sansMedium, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs }} numberOfLines={1}>
        {saved.styleLabel}
      </AppText>
    </Pressable>
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
      <View style={{ alignItems: 'center', backgroundColor: theme.colors.card, height: 160, justifyContent: 'center', width: '100%' }}>
        {option.imageUrl ? (
          <Image contentFit="contain" source={{ uri: option.imageUrl }} style={{ height: '100%', width: '100%' }} />
        ) : (
          <AppIcon color={theme.colors.subtleText} name="person" size={28} />
        )}
      </View>
      <View style={{ padding: spacing.sm }}>
        <AppText style={{ fontSize: 13, fontFamily: theme.fonts.sansMedium }}>{option.styleLabel}</AppText>
      </View>
    </Pressable>
  );
}
