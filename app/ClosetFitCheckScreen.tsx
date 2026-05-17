import { Image } from 'expo-image';
import { Pressable, TextInput, View } from 'react-native';

import { ImagePickerField } from '@/components/forms/image-picker-field';
import { AppIcon } from '@/components/ui/app-icon';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState, extendedFashionLoadingMessages } from '@/components/ui/loading-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing, theme } from '@/constants/theme';
import { getShareDiagnostics } from '@/lib/share-handoff';
import { STYLISTS, type StylistId } from '@/lib/stylists';
import type {
  ClosetFitCheckReasoning,
  ClosetFitCheckResponse,
  ClosetFitCheckScores,
  ClosetFitCheckVerdict,
} from '@/types/api';
import type { ClosetItem } from '@/types/closet';
import { useClosetFitCheck } from './useClosetFitCheck';

// ── Verdict copy + colors ─────────────────────────────────────────────────────

const VERDICT_LABEL: Record<ClosetFitCheckVerdict, string> = {
  'strong-buy': 'Strong buy',
  'worth-considering': 'Worth considering',
  'only-if-you-love-it': 'Only if you love it',
  skip: 'Skip',
};

const VERDICT_TONE: Record<ClosetFitCheckVerdict, { bg: string; text: string }> = {
  'strong-buy': { bg: theme.colors.accent, text: '#FFFFFF' },
  'worth-considering': { bg: theme.colors.card, text: theme.colors.text },
  'only-if-you-love-it': { bg: theme.colors.subtleSurface, text: theme.colors.text },
  skip: { bg: theme.colors.danger, text: '#FFFFFF' },
};

// ── Dimension labels — order matters; matches the weights ordering ───────────

const DIMENSIONS: { key: keyof ClosetFitCheckScores; label: string; description: string }[] = [
  { key: 'profileFit', label: 'Profile fit', description: 'Suits your style, color, and aesthetic' },
  { key: 'utility', label: 'Utility', description: 'How many outfits you can build with it' },
  { key: 'redundancyComplementarity', label: 'Closet additivity', description: 'Adds vs duplicates what you own' },
  { key: 'stylistOpinion', label: 'Stylist opinion', description: 'Independent design judgment' },
  { key: 'trendiness', label: 'Trendiness', description: 'Cool, current, relevant right now' },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export function ClosetFitCheckScreen() {
  const hook = useClosetFitCheck();
  const canAnalyze = Boolean(hook.image.uploadedImage) && !hook.image.isUploading;

  if (hook.isAnalyzing) {
    return (
      <AppScreen>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingState label="Evaluating against your closet..." messages={extendedFashionLoadingMessages} />
        </View>
      </AppScreen>
    );
  }

  if (hook.report) {
    return <ReportView report={hook.report} closetItems={hook.closetItems} onNewCheck={hook.reset} />;
  }

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Closet Fit Check" showBack />

        <View style={{ gap: spacing.xs }}>
          <AppText variant="heroSmall">Does this work in my closet?</AppText>
          <AppText tone="muted">
            Take a photo in store, pick from your library, or upload a screenshot. We&apos;ll check it honestly against your profile and your existing pieces.
          </AppText>
        </View>

        <ImagePickerField
          image={hook.image.image}
          isPicking={hook.image.isPicking || hook.image.isUploading}
          error={hook.image.error}
          statusMessage={
            hook.image.isUploading
              ? `Uploading ${Math.round(hook.image.uploadProgress * 100)}%`
              : hook.image.uploadedImage
                ? hook.image.uploadSuccessMessage ?? 'Upload complete.'
                : null
          }
          pickLabel={hook.image.isUploading ? `Uploading ${Math.round(hook.image.uploadProgress * 100)}%` : 'Choose from library'}
          cameraLabel="Take photo"
          futureCameraHint="Use the camera in store, or upload a screenshot from your library."
          onPick={() => {
            hook.clearReport();
            void hook.image.pickFromLibrary();
          }}
          onTakePhoto={() => {
            hook.clearReport();
            void hook.image.takePhoto();
          }}
          onRemove={() => {
            hook.image.removeImage();
            hook.clearReport();
          }}
        />

        <View style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            Notes (optional)
          </AppText>
          <TextInput
            multiline
            autoCapitalize="sentences"
            onChangeText={hook.setNotes}
            placeholder="Anything we should know? e.g. found at Aritzia for $250, or considering it for a wedding"
            placeholderTextColor={theme.colors.subtleText}
            maxLength={500}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 18,
              borderWidth: 1,
              color: theme.colors.text,
              fontFamily: theme.fonts.sans,
              fontSize: 15,
              minHeight: 84,
              paddingHorizontal: spacing.md,
              paddingTop: spacing.md,
              textAlignVertical: 'top',
            }}
            value={hook.notes}
          />
        </View>

        {hook.analysisError ? (
          <ErrorState title="We couldn't evaluate this piece" message={hook.analysisError} />
        ) : null}

        <PrimaryButton
          label={hook.image.isUploading ? 'Uploading...' : 'Evaluate this piece'}
          onPress={() => void hook.runAnalysis()}
          disabled={!canAnalyze}
        />

        <ShareDiagnosticsPanel />
      </View>
    </AppScreen>
  );
}

// Visible only when the user opens this screen WITHOUT a pending share, and
// only if the share-handoff system has any state worth showing (it'll be empty
// on fresh installs that never used share-to-app). Lets the user see at a
// glance whether the App Group bridge is reachable from the main app.

function ShareDiagnosticsPanel() {
  const diag = getShareDiagnostics();
  const everScanned = diag.lastScan !== null || diag.lastUrlHandoff !== null || diag.lastIngest !== null;
  if (!everScanned) return null;
  return (
    <View
      style={{
        backgroundColor: theme.colors.subtleSurface,
        borderColor: theme.colors.border,
        borderRadius: 16,
        borderWidth: 1,
        gap: spacing.xs,
        padding: spacing.md,
      }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6, fontSize: 10 }}>
        SHARE HANDOFF
      </AppText>
      <AppText style={{ color: theme.colors.mutedText, fontSize: 12, lineHeight: 17 }}>
        App Group: {diag.appGroupContainerResolved ? 'connected' : 'not reachable'}
        {diag.appGroupId ? ` (${diag.appGroupId})` : ''}
      </AppText>
      {diag.lastScan ? (
        <AppText style={{ color: theme.colors.mutedText, fontSize: 12, lineHeight: 17 }}>
          Last scan: {diag.lastScan.candidatesFound} pending share
          {diag.lastScan.candidatesFound === 1 ? '' : 's'} found.
        </AppText>
      ) : null}
      {diag.lastIngest ? (
        <AppText style={{ color: theme.colors.mutedText, fontSize: 11, lineHeight: 16 }}>
          Last ingest: {diag.lastIngest.shareId} → {diag.lastIngest.destExists ? 'file present' : 'FILE MISSING'}
        </AppText>
      ) : null}
      {diag.lastError ? (
        <AppText style={{ color: theme.colors.danger, fontSize: 11, lineHeight: 16 }}>
          {diag.lastError}
        </AppText>
      ) : null}
    </View>
  );
}

export { ClosetFitCheckScreen as default };

// ── Report view ──────────────────────────────────────────────────────────────

function ReportView({
  report,
  closetItems,
  onNewCheck,
}: {
  report: ClosetFitCheckResponse;
  closetItems: ClosetItem[];
  onNewCheck: () => void;
}) {
  const verdictTone = VERDICT_TONE[report.verdict];
  const similar = report.similarClosetItemIds
    .map((id) => closetItems.find((item) => item.id === id))
    .filter((item): item is ClosetItem => !!item);

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Closet Fit Check" showBack />

        {/* Hero image */}
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: 24,
            borderWidth: 1,
            overflow: 'hidden',
          }}>
          <Image
            contentFit="cover"
            source={{ uri: report.imageUrl }}
            style={{ aspectRatio: 3 / 4, width: '100%' }}
          />
        </View>

        {/* Item header */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            {report.item.category}
            {report.item.formality ? ` · ${report.item.formality}` : ''}
          </AppText>
          <AppText variant="heroSmall">{report.item.title}</AppText>
          {report.item.material || report.item.primaryColor ? (
            <AppText tone="muted">
              {[report.item.primaryColor, report.item.material].filter(Boolean).join(' · ')}
            </AppText>
          ) : null}
        </View>

        {/* Verdict card */}
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderWidth: 1,
            gap: spacing.lg,
            padding: spacing.lg,
          }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                alignSelf: 'center',
                backgroundColor: verdictTone.bg,
                borderRadius: 999,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.xs + 2,
              }}>
              <AppText
                variant="eyebrow"
                style={{
                  color: verdictTone.text,
                  fontFamily: theme.fonts.sansMedium,
                  letterSpacing: 1.6,
                }}>
                {VERDICT_LABEL[report.verdict]}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <AppText style={{ fontSize: 56, fontFamily: theme.fonts.sansMedium, lineHeight: 64 }}>
                {report.overallScore}
              </AppText>
              <AppText tone="muted" style={{ fontSize: 20 }}> / 100</AppText>
            </View>
            <AppText style={{ color: theme.colors.text, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>
              {report.summary}
            </AppText>
          </View>
        </View>

        {/* Five-dimension breakdown */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            Breakdown
          </AppText>
          {DIMENSIONS.map(({ key, label, description }) => (
            <DimensionRow
              key={key}
              label={label}
              description={description}
              score={report.scores[key]}
              weight={report.weights[key]}
              reasoning={report.reasoning[key as keyof ClosetFitCheckReasoning]}
            />
          ))}
        </View>

        {/* Closet impact */}
        <Section title="Closet impact" body={report.closetImpact}>
          {similar.length > 0 ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <AppText variant="eyebrow" style={{ color: theme.colors.subtleText, letterSpacing: 1.4 }}>
                Similar to what you own
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {similar.map((item) => (
                  <SimilarItemChip key={item.id} item={item} />
                ))}
              </View>
            </View>
          ) : null}
        </Section>

        {/* Stylist take — two perspectives */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            Stylist take
          </AppText>
          <StylistTakeCard stylistId="vittorio" body={report.stylistTake.vittorio} />
          <StylistTakeCard stylistId="alessandra" body={report.stylistTake.alessandra} />
        </View>

        {/* Actions */}
        <View style={{ gap: spacing.sm }}>
          <PrimaryButton label="Check another piece" onPress={onNewCheck} />
        </View>
      </View>
    </AppScreen>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DimensionRow({
  label,
  description,
  score,
  weight,
  reasoning,
}: {
  label: string;
  description: string;
  score: number;
  weight: number;
  reasoning: string;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 20,
        borderWidth: 1,
        gap: spacing.sm,
        padding: spacing.md,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>{label}</AppText>
          <AppText tone="muted" style={{ fontSize: 11 }}>
            {description} · weight {Math.round(weight * 100)}%
          </AppText>
        </View>
        <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 18 }}>{Math.round(score)}</AppText>
      </View>
      <View
        style={{
          backgroundColor: theme.colors.border,
          borderRadius: 999,
          height: 5,
          overflow: 'hidden',
        }}>
        <View
          style={{
            backgroundColor: theme.colors.accent,
            borderRadius: 999,
            height: '100%',
            width: `${Math.max(2, Math.min(100, score))}%`,
          }}
        />
      </View>
      <AppText style={{ color: theme.colors.mutedText, fontSize: 13, lineHeight: 19 }}>{reasoning}</AppText>
    </View>
  );
}

function Section({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
        {title}
      </AppText>
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: 20,
          borderWidth: 1,
          gap: spacing.sm,
          padding: spacing.md,
        }}>
        <AppText style={{ color: theme.colors.text, fontSize: 14, lineHeight: 21 }}>{body}</AppText>
        {children}
      </View>
    </View>
  );
}

function StylistTakeCard({ stylistId, body }: { stylistId: StylistId; body: string }) {
  const stylist = STYLISTS.find((s) => s.id === stylistId);
  if (!stylist) return null;
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 20,
        borderWidth: 1,
        gap: spacing.sm,
        padding: spacing.md,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            borderColor: theme.colors.border,
            borderRadius: 24,
            borderWidth: 1,
            height: 44,
            overflow: 'hidden',
            width: 44,
          }}>
          <Image
            contentFit="cover"
            contentPosition="top"
            source={stylist.image}
            style={{ height: '100%', width: '100%' }}
          />
        </View>
        <View style={{ gap: 1 }}>
          <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 14 }}>{stylist.name}</AppText>
          <AppText tone="muted" style={{ fontSize: 11 }}>{stylist.title}</AppText>
        </View>
      </View>
      <AppText style={{ color: theme.colors.text, fontSize: 14, fontStyle: 'italic', lineHeight: 21 }}>
        &ldquo;{body}&rdquo;
      </AppText>
    </View>
  );
}

function SimilarItemChip({ item }: { item: ClosetItem }) {
  const uri = item.sketchImageUrl ?? item.uploadedImageUrl ?? null;
  return (
    <Pressable
      style={{
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderRadius: 14,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
      }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.background,
          borderRadius: 10,
          height: 36,
          justifyContent: 'center',
          overflow: 'hidden',
          width: 36,
        }}>
        {uri ? (
          <Image contentFit="cover" source={{ uri }} style={{ height: '100%', width: '100%' }} />
        ) : (
          <AppIcon color={theme.colors.subtleText} name="shirt" size={14} />
        )}
      </View>
      <AppText style={{ fontSize: 12, maxWidth: 140 }} numberOfLines={2}>
        {item.title}
      </AppText>
    </Pressable>
  );
}
