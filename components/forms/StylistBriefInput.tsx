import { Pressable, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useVoiceTranscription } from '@/hooks/use-voice-transcription';
import { trackAskStylistVoiceUsed } from '@/lib/analytics';
import type { Stylist } from '@/lib/stylists';

type StylistBriefInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  stylist: Stylist | null;
};

/**
 * "Tell your stylist" — the conversational flow's single free-text brief,
 * replacing the original form's Season/Style Keywords/Optional Items/
 * Additional Details/Occasion Formality fields entirely. Typing always
 * works; the mic button is an additional input METHOD, not a separate
 * workflow — a transcription failure only surfaces an inline error and
 * never disables the text field.
 */
export function StylistBriefInput({ value, onChangeText, stylist }: StylistBriefInputProps) {
  const { theme } = useTheme();
  const voice = useVoiceTranscription();

  const stylistName = stylist?.name ?? 'your stylist';
  const stylistPronoun = stylist?.id === 'alessandra' ? 'she' : 'he';
  const placeholder = `Tell ${stylistName} what you're dressing for, the vibe you want, and anything else ${stylistPronoun} should know...`;

  async function handleMicPress() {
    if (voice.isRecording) {
      const transcript = await voice.stopRecordingAndTranscribe();
      if (!transcript) return;
      if (stylist) trackAskStylistVoiceUsed({ stylist_id: stylist.id });
      onChangeText(value.trim() ? `${value.trim()} ${transcript}` : transcript);
      return;
    }
    voice.startRecording();
  }

  const micActive = voice.isRecording || voice.isTranscribing;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
          Tell Your Stylist
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voice.isRecording ? 'Stop recording' : 'Speak your stylist brief'}
          disabled={voice.isTranscribing}
          onPress={() => void handleMicPress()}
          style={{
            alignItems: 'center',
            backgroundColor: micActive ? theme.colors.accent : theme.colors.subtleSurface,
            borderRadius: 999,
            flexDirection: 'row',
            gap: spacing.xs,
            opacity: voice.isTranscribing ? 0.6 : 1,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
          }}>
          <AppIcon color={micActive ? theme.colors.inverseText : theme.colors.text} name="mic" size={14} />
          <AppText style={{ color: micActive ? theme.colors.inverseText : theme.colors.text, fontSize: 12 }}>
            {voice.isTranscribing ? 'Transcribing...' : voice.isRecording ? 'Listening — tap to stop' : 'Speak'}
          </AppText>
        </Pressable>
      </View>

      <TextInput
        multiline
        autoCapitalize="sentences"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.subtleText}
        maxLength={1000}
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: 18,
          borderWidth: 1,
          color: theme.colors.text,
          fontFamily: theme.fonts.sans,
          fontSize: 16,
          minHeight: 120,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          textAlignVertical: 'top',
        }}
        value={value}
      />

      {voice.permissionDenied ? (
        <AppText style={{ color: theme.colors.danger, fontSize: 12 }}>
          Vesture needs microphone access to record your brief. You can still type it above, or enable the microphone in Settings.
        </AppText>
      ) : voice.error ? (
        <AppText style={{ color: theme.colors.danger, fontSize: 12 }}>{voice.error}</AppText>
      ) : null}
    </View>
  );
}
