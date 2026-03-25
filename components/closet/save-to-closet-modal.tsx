import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

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

  useEffect(() => {
    if (!visible) {
      return;
    }

    setTitle('');
    setBrand('');
    setSize('');
    setCategory('');
    setSaveError(null);

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

    return () => {
      isMounted = false;
    };
  }, [visible, uploadedImage, description]);

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
    });

    setIsSaving(false);

    if (response.success) {
      onSaved();
      onClose();
    } else {
      setSaveError(response.error?.message ?? 'Failed to save item to closet.');
    }
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(24, 18, 14, 0.52)',
            flex: 1,
            justifyContent: 'center',
            padding: spacing.lg,
          }}>
          <Pressable
            onPress={() => undefined}
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

              {/* Item image preview */}
              {uploadedImage?.publicUrl ? (
                <View
                  style={{
                    borderRadius: 18,
                    overflow: 'hidden',
                    aspectRatio: 1,
                    backgroundColor: theme.colors.card,
                  }}>
                  <Image
                    contentFit="cover"
                    source={{ uri: uploadedImage.publicUrl }}
                    style={{ height: '100%', width: '100%' }}
                  />
                </View>
              ) : null}

              {isAnalyzing ? (
                <LoadingState
                  label="Identifying piece..."
                  messages={[
                    'Identifying your piece.',
                    'Checking the fabric situation.',
                    'Cataloguing with intention.',
                  ]}
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  {/* Title */}
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
                      Title
                    </AppText>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g. Navy Slim Trousers"
                      placeholderTextColor={theme.colors.subtleText}
                      returnKeyType="next"
                      style={inputStyle}
                    />
                  </View>

                  {/* Category */}
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
                      Category
                    </AppText>
                    <TextInput
                      value={category}
                      onChangeText={setCategory}
                      placeholder="e.g. Trousers"
                      placeholderTextColor={theme.colors.subtleText}
                      returnKeyType="next"
                      style={inputStyle}
                    />
                  </View>

                  {/* Brand + Size row */}
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
                        Brand
                      </AppText>
                      <TextInput
                        value={brand}
                        onChangeText={setBrand}
                        placeholder="e.g. COS"
                        placeholderTextColor={theme.colors.subtleText}
                        returnKeyType="next"
                        style={inputStyle}
                      />
                    </View>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>
                        Size
                      </AppText>
                      <TextInput
                        value={size}
                        onChangeText={setSize}
                        placeholder="e.g. M / 32"
                        placeholderTextColor={theme.colors.subtleText}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        style={inputStyle}
                      />
                    </View>
                  </View>

                  {saveError ? (
                    <AppText style={{ color: '#D26A5C', fontSize: 13 }}>{saveError}</AppText>
                  ) : null}

                  <PrimaryButton
                    label={isSaving ? 'Saving...' : 'Save to Closet'}
                    onPress={() => void handleSave()}
                    disabled={isSaving || !title.trim()}
                  />
                  <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
                </View>
              )}
            </ScrollView>
          </Pressable>
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
