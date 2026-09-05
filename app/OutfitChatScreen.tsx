import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Image } from 'expo-image';

import { AppIcon } from '@/components/ui/app-icon';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useOutfitChat } from './useOutfitChat';

const SUGGESTED_QUESTIONS = [
  'What kind of tie works with this?',
  'Would a different shirt color work?',
  'Is this too casual for the occasion?',
];

export function OutfitChatScreen() {
  const { theme } = useTheme();
  const { context, messages, isSending, errorMessage, sendQuestion } = useOutfitChat();
  const [draft, setDraft] = useState('');

  function handleSend() {
    const question = draft.trim();
    if (!question) return;
    setDraft('');
    void sendQuestion(question);
  }

  return (
    <AppScreen scrollable avoidsKeyboard floatingBack>
      <View style={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <ScreenHeader title="Ask About This Look" showBack />

        {context?.sketchImageUrl ? (
          <View style={{
            backgroundColor: theme.colors.card,
            borderRadius: 20,
            height: 200,
            overflow: 'hidden',
          }}>
            <Image contentFit="cover" source={{ uri: context.sketchImageUrl }} style={{ height: '100%', width: '100%' }} />
          </View>
        ) : null}

        {context?.outfitTitle ? <AppText variant="sectionTitle">{context.outfitTitle}</AppText> : null}

        <View style={{ gap: spacing.md }}>
          {messages.length === 0 ? (
            <View style={{ gap: spacing.sm }}>
              <AppText tone="muted">Ask anything about this outfit — swaps, alternatives, whether something works.</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => void sendQuestion(q)}
                    style={{
                      backgroundColor: theme.colors.subtleSurface,
                      borderRadius: 999,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                    }}>
                    <AppText style={{ fontSize: 13 }}>{q}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {messages.map((message, index) => (
            <View
              key={index}
              style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: message.role === 'user' ? theme.colors.text : theme.colors.subtleSurface,
                borderRadius: 18,
                maxWidth: '85%',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
              }}>
              <AppText style={{ color: message.role === 'user' ? theme.colors.inverseText : theme.colors.text }}>
                {message.content}
              </AppText>
            </View>
          ))}

          {isSending ? (
            <View style={{ alignSelf: 'flex-start', paddingVertical: spacing.sm }}>
              <ActivityIndicator color={theme.colors.subtleText} size="small" />
            </View>
          ) : null}

          {errorMessage ? (
            <AppText style={{ color: theme.colors.danger, fontSize: 13 }}>{errorMessage}</AppText>
          ) : null}
        </View>

        <View style={{
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: 999,
          borderWidth: 1,
          flexDirection: 'row',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
        }}>
          <TextInput
            multiline
            onChangeText={setDraft}
            placeholder="Ask a question..."
            placeholderTextColor={theme.colors.subtleText}
            style={{ color: theme.colors.text, flex: 1, fontFamily: theme.fonts.sans, fontSize: 15, maxHeight: 100, paddingVertical: spacing.sm }}
            value={draft}
          />
          <Pressable
            disabled={!draft.trim() || isSending}
            onPress={handleSend}
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.text,
              borderRadius: 999,
              height: 36,
              justifyContent: 'center',
              opacity: !draft.trim() || isSending ? 0.5 : 1,
              width: 36,
            }}>
            <AppIcon color={theme.colors.inverseText} name="arrow-right" size={16} />
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}
