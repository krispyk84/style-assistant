import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { LoadingState } from '@/components/ui/loading-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { closetService } from '@/services/closet';
import type { UploadedImageAsset } from '@/types/media';

type SaveToClosetModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  uploadedImage?: UploadedImageAsset | null;
  description?: string;
};

export function SaveToClosetModal({ visible, onClose, onSaved, uploadedImage, description }: SaveToClosetModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [category, setCategory] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sketch generation state
  const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);
  const [sketchJobId, setSketchJobId] = useState<string | null>(null);
  const [sketchImageUrl, setSketchImageUrl] = useState<string | null>(null);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [cellWidth, setCellWidth] = useState(0);
  const sketchTranslateX = useRef(new Animated.Value(-140)).current;

  // Reset state when modal opens
  useEffect(() => {
    if (!visible) return;

    setTitle('');
    setBrand('');
    setSize('');
    setCategory('');
    setSaveError(null);
    setSketchImageUrl(null);
    setSketchJobId(null);
    setSketchError(null);
    setIsGeneratingSketch(false);

    let isMounted = true;
    setIsAnalyzing(true);

    void closetService
      .analyzeItem({
        uploadedImageId: uploadedImage?.id,
        uploadedImageUrl: uploadedImage?.publicUrl,
        description: description ?? '',
      })
      .then((response) => {
        if (!isMounted) return;
        if (response.success && response.data) {
          setTitle(response.data.title);
          setCategory(response.data.category);
        }
        setIsAnalyzing(false);
      });

    return () => { isMounted = false; };
  }, [visible, uploadedImage, description]);

  // Sketch loading bar animation
  useEffect(() => {
    if (!isGeneratingSketch) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sketchTranslateX, { toValue: 220, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sketchTranslateX, { toValue: -140, duration: 0, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isGeneratingSketch, sketchTranslateX]);

  // Poll for sketch when jobId is set
  useEffect(() => {
    if (!sketchJobId) return;

    const interval = setInterval(() => {
      void closetService.getItemSketch(sketchJobId).then((response) => {
        if (!response.success || !response.data) return;
        if (response.data.sketchStatus === 'ready' && response.data.sketchImageUrl) {
          setSketchImageUrl(response.data.sketchImageUrl);
          setIsGeneratingSketch(false);
          setSketchJobId(null);
        } else if (response.data.sketchStatus === 'failed') {
          setSketchError('Sketch generation failed. You can still save without it.');
          setIsGeneratingSketch(false);
          setSketchJobId(null);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [sketchJobId]);

  async function handleGenerateSketch() {
    if (!uploadedImage?.publicUrl) return;
    setSketchError(null);
    setIsGeneratingSketch(true);

    const response = await closetService.generateItemSketch({
      uploadedImageId: uploadedImage.id,
      uploadedImageUrl: uploadedImage.publicUrl,
    });

    if (response.success && response.data) {
      setSketchJobId(response.data.jobId);
      // keep isGeneratingSketch = true, poll will set it false when done
    } else {
      setSketchError(response.error?.message ?? 'Sketch generation is not available right now.');
      setIsGeneratingSketch(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) return;
    setIsSaving(true);
    setSaveError(null);

    const response = await closetService.saveItem({
      title: title.trim(),
      brand: brand.trim(),
      size: size.trim(),
      category: category.trim() || 'Clothing',
      uploadedImageId: uploadedImage?.id,
      uploadedImageUrl: uploadedImage?.publicUrl,
      sketchImageUrl: sketchImageUrl ?? undefined,
    });

    setIsSaving(false);

    if (response.success) {
      onSaved();
      onClose();
    } else {
      setSaveError(response.error?.message ?? 'Failed to save item to closet.');
    }
  }

  const hasBothImages = Boolean(sketchImageUrl) && Boolean(uploadedImage?.publicUrl);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable
          onPress={() => { Keyboard.dismiss(); onClose(); }}
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(24, 18, 14, 0.52)',
            flex: 1,
            justifyContent: 'center',
            padding: spacing.lg,
          }}>
          <View
            style={{
              backgroundColor: '#FFFDFC',
              borderRadius: 28,
              maxWidth: 420,
              width: '100%',
              overflow: 'hidden',
              maxHeight: '92%',
            }}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg }}>

              {/* Header */}
              <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
                  <Ionicons color={theme.colors.accent} name="archive-outline" size={18} />
                  <AppText variant="eyebrow" style={{ letterSpacing: 1.8, color: theme.colors.mutedText }}>
                    Save to Closet
                  </AppText>
                </View>
                <Pressable hitSlop={8} onPress={onClose}>
                  <Ionicons color={theme.colors.mutedText} name="close" size={22} />
                </Pressable>
              </View>

              {/* Image area — swipeable when sketch available, photo only otherwise */}
              {uploadedImage?.publicUrl ? (
                <View style={{ gap: spacing.sm }}>
                  <View
                    onLayout={(e) => setCellWidth(e.nativeEvent.layout.width)}
                    style={{
                      aspectRatio: 4 / 3,
                      backgroundColor: theme.colors.card,
                      borderRadius: 18,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {hasBothImages && cellWidth > 0 ? (
                      <>
                        <ScrollView
                          horizontal
                          pagingEnabled
                          showsHorizontalScrollIndicator={false}
                          style={{ width: cellWidth, flex: 1 }}>
                          <Image contentFit="cover" source={{ uri: sketchImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
                          <Image contentFit="cover" source={{ uri: uploadedImage.publicUrl }} style={{ width: cellWidth, flex: 1 }} />
                        </ScrollView>
                        <View style={{ bottom: 8, flexDirection: 'row', gap: 5, position: 'absolute', alignSelf: 'center' }}>
                          <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 6, width: 6, opacity: 0.9 }} />
                          <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 6, width: 6, opacity: 0.45 }} />
                        </View>
                      </>
                    ) : (
                      <Image contentFit="cover" source={{ uri: uploadedImage.publicUrl }} style={{ height: '100%', width: '100%' }} />
                    )}
                  </View>

                  {/* Sketch generation */}
                  {isGeneratingSketch ? (
                    <View
                      style={{
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        borderRadius: 16,
                        borderWidth: 1,
                        padding: spacing.md,
                        gap: spacing.sm,
                        alignItems: 'center',
                      }}>
                      <View style={{ backgroundColor: theme.colors.border, borderRadius: 999, height: 8, overflow: 'hidden', width: '100%' }}>
                        <Animated.View
                          style={{
                            backgroundColor: theme.colors.accent,
                            borderRadius: 999,
                            height: '100%',
                            transform: [{ translateX: sketchTranslateX }],
                            width: 140,
                          }}
                        />
                      </View>
                      <AppText tone="muted" style={{ fontSize: 13 }}>Generating sketch...</AppText>
                    </View>
                  ) : sketchImageUrl ? (
                    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
                      <Ionicons color={theme.colors.accent} name="checkmark-circle-outline" size={16} />
                      <AppText tone="muted" style={{ fontSize: 12 }}>Sketch ready — swipe left to see original photo</AppText>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => void handleGenerateSketch()}
                      style={{
                        alignItems: 'center',
                        backgroundColor: theme.colors.subtleSurface,
                        borderColor: theme.colors.border,
                        borderRadius: 999,
                        borderWidth: 1,
                        flexDirection: 'row',
                        gap: spacing.sm,
                        justifyContent: 'center',
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                      }}>
                      <Ionicons color={theme.colors.accent} name="color-wand-outline" size={16} />
                      <AppText variant="eyebrow" style={{ color: theme.colors.accent, letterSpacing: 1.4 }}>
                        Generate Sketch
                      </AppText>
                    </Pressable>
                  )}

                  {sketchError ? (
                    <AppText style={{ color: '#D26A5C', fontSize: 12 }}>{sketchError}</AppText>
                  ) : null}
                </View>
              ) : null}

              {isAnalyzing ? (
                <LoadingState
                  label="Identifying piece..."
                  messages={['Identifying your piece.', 'Checking the fabric situation.', 'Cataloguing with intention.']}
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Title</AppText>
                    <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Navy Slim Trousers" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                  </View>

                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Category</AppText>
                    <TextInput value={category} onChangeText={setCategory} placeholder="e.g. Trousers" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                  </View>

                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Brand</AppText>
                      <TextInput value={brand} onChangeText={setBrand} placeholder="e.g. COS" placeholderTextColor={theme.colors.subtleText} returnKeyType="next" style={inputStyle} />
                    </View>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Size</AppText>
                      <TextInput value={size} onChangeText={setSize} placeholder="e.g. M / 32" placeholderTextColor={theme.colors.subtleText} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} style={inputStyle} />
                    </View>
                  </View>

                  {saveError ? <AppText style={{ color: '#D26A5C', fontSize: 13 }}>{saveError}</AppText> : null}

                  <PrimaryButton
                    label={isSaving ? 'Saving...' : 'Save to Closet'}
                    onPress={() => void handleSave()}
                    disabled={isSaving || !title.trim()}
                  />
                  <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const inputStyle = {
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
  borderRadius: 14,
  borderWidth: 1,
  color: theme.colors.text,
  fontFamily: theme.fonts.sans,
  fontSize: 15,
  minHeight: 48,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
} as const;
