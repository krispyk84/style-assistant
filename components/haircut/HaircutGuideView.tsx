import { Image } from 'expo-image';
import { useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import type { HaircutAngleShots, HaircutGuideResponse, HaircutOption } from '@/types/api';

type HaircutGuideViewProps = {
  option: HaircutOption;
  guide: HaircutGuideResponse;
  angleShots: HaircutAngleShots | null;
  isLoadingAngleShots: boolean;
  angleShotsError: string | null;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  onUnsave: () => void;
  /** Hidden during the ViewShot capture used for "Save to Photos"/"Share" — an
   * app-only control has no place baked into the exported barber-guide image. */
  hideSaveButton?: boolean;
};

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 1.6 }}>{title}</AppText>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={{ gap: 4 }}>
      {items.map((item) => (
        <AppText key={item} style={{ fontSize: 13, lineHeight: 19 }}>{'•  '}{item}</AppText>
      ))}
    </View>
  );
}

type PhotoTile = { key: string; label: string; option: HaircutOption | null };

// Square tiles, contain (never crop) — the generated image's real dimensions
// aren't guaranteed to match a square exactly, and cropping was cutting into
// the subject off-center. contain always shows the whole image, at the cost
// of a small letterbox margin if the source isn't quite square.
function AnglePhoto({ label, option, selected, onPress }: { label: string; option: HaircutOption | null; selected: boolean; onPress: () => void }) {
  const ready = option?.status === 'ready' && !!option.imageUrl;
  return (
    <Pressable onPress={ready ? onPress : undefined} style={{ flex: 1, gap: 4 }}>
      <View
        style={{
          aspectRatio: 1,
          backgroundColor: theme.colors.card,
          borderRadius: 14,
          borderWidth: selected ? 2 : 0,
          borderColor: theme.colors.accent,
          overflow: 'hidden',
          width: '100%',
        }}>
        {ready ? (
          <Image contentFit="contain" source={{ uri: option!.imageUrl! }} style={{ height: '100%', width: '100%' }} />
        ) : option?.status === 'failed' ? (
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <AppIcon color={theme.colors.subtleText} name="warning" size={18} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <ActivityIndicator color={theme.colors.accent} size="small" />
          </View>
        )}
      </View>
      <AppText tone={selected ? undefined : 'subtle'} style={{ fontSize: 10, textAlign: 'center' }}>{label}</AppText>
    </Pressable>
  );
}

export function HaircutGuideView({ option, guide, angleShots, isLoadingAngleShots, angleShotsError, isSaved, isSaving, onSave, onUnsave, hideSaveButton = false }: HaircutGuideViewProps) {
  const photos: PhotoTile[] = [
    { key: 'front', label: 'Front', option },
    { key: 'front-angled', label: 'Front Angled', option: angleShots?.frontAngled ?? null },
    { key: 'side', label: 'Side', option: angleShots?.side ?? null },
    { key: 'back', label: 'Back', option: angleShots?.back ?? null },
  ];
  const [selectedKey, setSelectedKey] = useState('front');
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const selectedPhoto = photos.find((photo) => photo.key === selectedKey) ?? photos[0]!;
  const mainReady = selectedPhoto.option?.status === 'ready' && !!selectedPhoto.option.imageUrl;

  return (
    <View style={{ backgroundColor: theme.colors.background, gap: spacing.lg, padding: spacing.lg, width: 360 }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <AppText tone="muted" variant="eyebrow" style={{ letterSpacing: 2.4 }}>HAIRCUT GUIDE</AppText>
        <AppText variant="heroSmall" style={{ textAlign: 'center' }}>{option.styleLabel}</AppText>
      </View>

      {mainReady ? (
        <Pressable onPress={() => setFullscreenOpen(true)}>
          <View style={{ aspectRatio: 1, backgroundColor: theme.colors.card, borderRadius: 20, overflow: 'hidden', width: '100%' }}>
            <Image contentFit="contain" source={{ uri: selectedPhoto.option!.imageUrl! }} style={{ height: '100%', width: '100%' }} />
          </View>
        </Pressable>
      ) : null}

      {angleShots || isLoadingAngleShots ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {photos.map((photo) => (
            <AnglePhoto
              key={photo.key}
              label={photo.label}
              option={photo.option}
              selected={photo.key === selectedKey}
              onPress={() => setSelectedKey(photo.key)}
            />
          ))}
        </View>
      ) : angleShotsError ? (
        <AppText tone="muted" style={{ fontSize: 12, textAlign: 'center' }}>{angleShotsError}</AppText>
      ) : null}

      {hideSaveButton ? null : (
        <PrimaryButton
          label={isSaved ? 'Saved' : 'Save Haircut'}
          onPress={isSaved ? onUnsave : onSave}
          variant={isSaved ? 'secondary' : 'primary'}
          disabled={isSaving}
        />
      )}

      <Modal visible={fullscreenOpen} animationType="fade" transparent onRequestClose={() => setFullscreenOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
          <Pressable
            hitSlop={12}
            onPress={() => setFullscreenOpen(false)}
            style={{ alignSelf: 'flex-end', padding: spacing.lg }}>
            <AppIcon color="#fff" name="close" size={28} />
          </Pressable>
          {mainReady ? (
            <Image
              contentFit="contain"
              source={{ uri: selectedPhoto.option!.imageUrl! }}
              style={{ flex: 1, width: '100%' }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      <Section title="THE LOOK">
        <AppText style={{ fontSize: 14, lineHeight: 20 }}>{guide.theLook}</AppText>
      </Section>

      <Section title="WHAT TO ASK FOR">
        <BulletList items={guide.whatToAskFor} />
      </Section>

      <Section title="CUT DETAILS">
        <BulletList items={guide.cutDetails} />
      </Section>

      <Section title="STYLING TIPS">
        <BulletList items={guide.stylingTips} />
      </Section>

      <Section title="WHAT TO AVOID">
        <BulletList items={guide.whatToAvoid} />
      </Section>

      <Section title="MAINTENANCE">
        <AppText style={{ fontSize: 13, lineHeight: 19 }}>{guide.maintenance}</AppText>
      </Section>

      <Section title="PRODUCTS">
        <BulletList items={guide.products} />
      </Section>
    </View>
  );
}
