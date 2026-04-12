import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { STYLISTS, type StylistId } from '@/lib/stylists';
import type { useHelpMePick } from './useHelpMePick';

// ── Option constants ───────────────────────────────────────────────────────────

const DAY_TYPE_OPTIONS = [
  { value: 'casual', label: 'Casual day' },
  { value: 'work', label: 'Work' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'date', label: 'Date' },
  { value: 'formal', label: 'Formal event' },
] as const;

const VIBE_OPTIONS = [
  { value: 'classic', label: 'Classic' },
  { value: 'refined', label: 'Refined' },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'bold', label: 'Bold' },
  { value: 'minimal', label: 'Minimal' },
] as const;

const RISK_OPTIONS = [
  { value: 'safe', label: 'Play it safe' },
  { value: 'balanced', label: 'Mix it up' },
  { value: 'adventurous', label: 'Surprise me' },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type HelpMePickModalProps = {
  hook: ReturnType<typeof useHelpMePick>;
  onUseItem: (params: { closetItemId: string; closetItemTitle: string; closetItemImageUrl: string; closetItemFitStatus?: string }) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function HelpMePickModal({ hook, onUseItem }: HelpMePickModalProps) {
  const { height: screenHeight } = useWindowDimensions();
  const modalMaxHeight = screenHeight * 0.9;

  const {
    isOpen, close, modalState, error,
    result, stylistId, setStylistId,
    dayType, setDayType, vibe, setVibe, risk, setRisk,
    handlePick, handlePickAgain,
  } = hook;

  const selectedStylist = STYLISTS.find((s) => s.id === stylistId) ?? STYLISTS[0]!;

  return (
    <Modal animationType="slide" transparent visible={isOpen} onRequestClose={close}>
      <Pressable
        onPress={close}
        style={{
          flex: 1,
          backgroundColor: 'rgba(24, 18, 14, 0.55)',
          justifyContent: 'flex-end',
        }}>
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            maxHeight: modalMaxHeight,
            overflow: 'hidden',
          }}>

          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.xs }}>
            <View style={{ backgroundColor: theme.colors.border, borderRadius: 999, height: 4, width: 36 }} />
          </View>

          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingTop: spacing.md }}>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <AppText variant="sectionTitle">Help Me Pick</AppText>
                <AppText tone="muted" style={{ fontSize: 13 }}>Let a stylist choose your anchor piece</AppText>
              </View>
              <Pressable hitSlop={8} onPress={close}>
                <Ionicons color={theme.colors.mutedText} name="close" size={22} />
              </Pressable>
            </View>

            {/* Loading state */}
            {modalState === 'loading' ? (
              <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl }}>
                <ActivityIndicator color={theme.colors.accent} size="large" />
                <AppText tone="muted" style={{ textAlign: 'center' }}>
                  {selectedStylist.name} is scanning your wardrobe...
                </AppText>
              </View>
            ) : modalState === 'result' && result ? (
              <ResultCard
                result={result}
                onUseItem={onUseItem}
                onPickAgain={handlePickAgain}
                onClose={close}
              />
            ) : (
              <IntentForm
                stylistId={stylistId}
                onStylistChange={(id) => setStylistId(id)}
                dayType={dayType}
                onDayTypeChange={setDayType}
                vibe={vibe}
                onVibeChange={setVibe}
                risk={risk}
                onRiskChange={setRisk}
                error={error}
                onPick={() => void handlePick()}
              />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Intent form ───────────────────────────────────────────────────────────────

type IntentFormProps = {
  stylistId: StylistId;
  onStylistChange: (id: StylistId) => void;
  dayType: string;
  onDayTypeChange: (v: string) => void;
  vibe: string;
  onVibeChange: (v: string) => void;
  risk: string;
  onRiskChange: (v: string) => void;
  error: string | null;
  onPick: () => void;
};

function IntentForm({
  stylistId, onStylistChange,
  dayType, onDayTypeChange,
  vibe, onVibeChange,
  risk, onRiskChange,
  error, onPick,
}: IntentFormProps) {
  return (
    <>
      {/* Stylist selector */}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
          Your Stylist
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {STYLISTS.map((stylist) => {
            const isSelected = stylistId === stylist.id;
            return (
              <Pressable
                key={stylist.id}
                onPress={() => onStylistChange(stylist.id)}
                style={{
                  alignItems: 'center',
                  backgroundColor: isSelected ? theme.colors.card : theme.colors.background,
                  borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                  borderRadius: 22,
                  borderWidth: isSelected ? 2 : 1,
                  flex: 1,
                  gap: spacing.sm,
                  padding: spacing.md,
                }}>
                <View
                  style={{
                    borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                    borderRadius: 40,
                    borderWidth: 2,
                    height: 72,
                    overflow: 'hidden',
                    width: 72,
                  }}>
                  <Image
                    contentFit="cover"
                    contentPosition="top"
                    source={stylist.image}
                    style={{ height: '100%', width: '100%' }}
                  />
                </View>
                <AppText variant="sectionTitle" style={{ textAlign: 'center' }}>{stylist.name}</AppText>
                {isSelected ? (
                  <Ionicons color={theme.colors.accent} name="checkmark-circle" size={16} />
                ) : (
                  <Ionicons color={theme.colors.border} name="ellipse-outline" size={16} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Day type */}
      <OptionRow
        label="What's the day like?"
        options={DAY_TYPE_OPTIONS as unknown as readonly { value: string; label: string }[]}
        value={dayType}
        onChange={onDayTypeChange}
      />

      {/* Vibe */}
      <OptionRow
        label="What vibe?"
        options={VIBE_OPTIONS as unknown as readonly { value: string; label: string }[]}
        value={vibe}
        onChange={onVibeChange}
      />

      {/* Risk */}
      <OptionRow
        label="Style risk?"
        options={RISK_OPTIONS as unknown as readonly { value: string; label: string }[]}
        value={risk}
        onChange={onRiskChange}
      />

      {error ? (
        <AppText style={{ color: theme.colors.danger, fontSize: 13, textAlign: 'center' }}>{error}</AppText>
      ) : null}

      <PrimaryButton label={`Ask ${STYLISTS.find((s) => s.id === stylistId)?.name ?? 'Stylist'}`} onPress={onPick} />
    </>
  );
}

// ── Option row ─────────────────────────────────────────────────────────────────

type OptionRowProps = {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
};

function OptionRow({ label, options, value, onChange }: OptionRowProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                backgroundColor: active ? theme.colors.accent : theme.colors.surface,
                borderColor: active ? theme.colors.accent : theme.colors.border,
              }}>
              <AppText style={{ fontSize: 13, color: active ? theme.colors.inverseText : theme.colors.text }}>
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Result card ────────────────────────────────────────────────────────────────

type ResultCardProps = {
  result: NonNullable<ReturnType<typeof useHelpMePick>['result']>;
  onUseItem: HelpMePickModalProps['onUseItem'];
  onPickAgain: () => void;
  onClose: () => void;
};

function ResultCard({ result, onUseItem, onPickAgain, onClose }: ResultCardProps) {
  const router = useRouter();
  const stylist = STYLISTS.find((s) => s.id === result.stylistId) ?? STYLISTS[0]!;

  function handleUseItem() {
    onClose();
    onUseItem({
      closetItemId: result.itemId,
      closetItemTitle: result.itemTitle,
      closetItemImageUrl: result.itemImageUrl ?? '',
      closetItemFitStatus: result.itemFitStatus ?? undefined,
    });
    router.push({
      pathname: '/create-look',
      params: {
        closetItemId: result.itemId,
        closetItemTitle: result.itemTitle,
        closetItemImageUrl: result.itemImageUrl ?? '',
        closetItemFitStatus: result.itemFitStatus ?? '',
      },
    });
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Stylist attribution */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            borderColor: theme.colors.border,
            borderRadius: 24,
            borderWidth: 1,
            height: 40,
            overflow: 'hidden',
            width: 40,
          }}>
          <Image
            contentFit="cover"
            contentPosition="top"
            source={stylist.image}
            style={{ height: '100%', width: '100%' }}
          />
        </View>
        <View style={{ gap: 1 }}>
          <AppText style={{ fontSize: 13, fontFamily: theme.fonts.sansMedium }}>{stylist.name}</AppText>
          <AppText tone="muted" style={{ fontSize: 11 }}>recommends</AppText>
        </View>
      </View>

      {/* Item card */}
      <View
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: 20,
          borderWidth: 1,
          overflow: 'hidden',
        }}>
        {result.itemImageUrl ? (
          <Image
            contentFit="cover"
            source={{ uri: result.itemImageUrl }}
            style={{ height: 200, width: '100%' }}
          />
        ) : (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              height: 120,
              justifyContent: 'center',
            }}>
            <Ionicons color={theme.colors.subtleText} name="shirt-outline" size={36} />
          </View>
        )}
        <View style={{ gap: spacing.xs, padding: spacing.md }}>
          <AppText variant="sectionTitle">{result.itemTitle}</AppText>
          <AppText tone="muted" style={{ fontSize: 13, fontStyle: 'italic' }}>&ldquo;{result.reason}&rdquo;</AppText>
        </View>
      </View>

      {/* Actions */}
      <PrimaryButton label="Use this" onPress={handleUseItem} />
      <PrimaryButton label="Pick again" onPress={onPickAgain} variant="secondary" />
    </View>
  );
}
