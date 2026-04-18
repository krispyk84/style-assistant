import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { DestinationResult, DestinationType } from '@/services/destination';
import { destinationService } from '@/services/destination';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

const TYPE_LABEL: Record<DestinationType, string> = {
  city: 'City',
  region: 'Region',
  country: 'Country',
  place: 'Place',
};

type Props = {
  value: DestinationResult | null;
  onChange: (value: DestinationResult | null) => void;
};

export function DestinationAutocomplete({ value, onChange }: Props) {
  const { theme } = useTheme();
  const [inputText, setInputText] = useState(value?.label ?? '');
  const [results, setResults] = useState<DestinationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Prevent the blur handler from closing the dropdown while the user is
  // pressing a result row.
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync label into the input when a value is set externally (e.g. form reset).
  useEffect(() => {
    if (value !== null) {
      setInputText(value.label);
    }
  }, [value]);

  // Debounced search — only fires when there is no confirmed selection.
  useEffect(() => {
    if (value !== null || inputText.length < MIN_QUERY_LENGTH) {
      if (inputText.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setIsOpen(false);
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await destinationService.search(inputText);
        setResults(data);
        setIsOpen(data.length > 0);
      } catch (e) {
        setError('Could not load suggestions. Check your connection.');
        setIsOpen(true); // keep dropdown open so error is visible
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputText, value]);

  function handleChangeText(text: string) {
    setInputText(text);
    // Clear any prior selection so the search effect re-runs.
    if (value !== null) onChange(null);
  }

  function handleSelect(result: DestinationResult) {
    // Cancel the pending blur-close before updating state.
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setInputText(result.label);
    setResults([]);
    setIsOpen(false);
    onChange(result);
  }

  function handleBlur() {
    setIsFocused(false);
    // Short delay lets a tap on a result row register before the dropdown hides.
    blurTimerRef.current = setTimeout(() => setIsOpen(false), 200);
  }

  function handleDropdownTouchStart() {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
  }

  const borderColor = error
    ? theme.colors.danger
    : isFocused
    ? theme.colors.accent
    : theme.colors.border;

  return (
    <View>
      {/* Input row */}
      <View
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderColor,
          borderRadius: 16,
          borderWidth: 1,
          flexDirection: 'row',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}>
        <TextInput
          autoCapitalize="words"
          autoCorrect={false}
          placeholder="City, country, or region"
          placeholderTextColor={theme.colors.subtleText}
          value={inputText}
          onChangeText={handleChangeText}
          onFocus={() => {
            setIsFocused(true);
            if (results.length > 0 && value === null) setIsOpen(true);
          }}
          onBlur={handleBlur}
          style={{
            color: theme.colors.text,
            flex: 1,
            fontFamily: theme.fonts.sans,
            fontSize: 16,
            paddingVertical: 2,
          }}
        />
        {isLoading ? (
          <ActivityIndicator color={theme.colors.subtleText} size="small" />
        ) : null}
      </View>

      {/* Dropdown */}
      {isOpen ? (
        <View
          onTouchStart={handleDropdownTouchStart}
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 16,
            borderWidth: 1,
            marginTop: spacing.xs,
            overflow: 'hidden',
          }}>
          {error ? (
            <View style={{ padding: spacing.md }}>
              <AppText style={{ color: theme.colors.danger, fontSize: 14 }}>{error}</AppText>
            </View>
          ) : results.length === 0 ? (
            <View style={{ padding: spacing.md }}>
              <AppText tone="muted" style={{ fontSize: 14 }}>
                No results for &ldquo;{inputText}&rdquo;
              </AppText>
            </View>
          ) : (
            results.map((result, index) => (
              <Pressable
                key={result.geonameId}
                onPress={() => handleSelect(result)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? theme.colors.subtleSurface : 'transparent',
                  borderTopColor: theme.colors.border,
                  borderTopWidth: index === 0 ? 0 : 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                })}>
                <AppText
                  numberOfLines={1}
                  style={{ flex: 1, fontSize: 15, marginRight: spacing.sm }}>
                  {result.label}
                </AppText>
                <View
                  style={{
                    backgroundColor: theme.colors.subtleSurface,
                    borderRadius: 999,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 3,
                  }}>
                  <AppText
                    style={{
                      color: theme.colors.mutedText,
                      fontFamily: theme.fonts.sansMedium,
                      fontSize: 10,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}>
                    {TYPE_LABEL[result.type]}
                  </AppText>
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}
