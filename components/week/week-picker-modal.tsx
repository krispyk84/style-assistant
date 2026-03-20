import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RemoteImagePanel } from '@/components/ui/remote-image-panel';
import { SectionHeader } from '@/components/ui/section-header';
import { spacing, theme } from '@/constants/theme';
import { getNextSevenDays, loadWeekPlan } from '@/lib/week-plan-storage';
import { loadNextSevenDayForecast, type WeekForecastDay } from '@/services/weather/current-weather-service';
import type { WeekPlannedOutfit } from '@/types/style';

type WeekPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectDay: (dayKey: string, dayLabel: string) => void;
};

export function WeekPickerModal({ visible, onClose, onSelectDay }: WeekPickerModalProps) {
  const days = getNextSevenDays();
  const [assignedDays, setAssignedDays] = useState<WeekPlannedOutfit[]>([]);
  const [replacementCandidate, setReplacementCandidate] = useState<WeekPlannedOutfit | null>(null);
  const [forecastByDay, setForecastByDay] = useState<Record<string, WeekForecastDay>>({});

  useEffect(() => {
    let isMounted = true;

    async function hydrateModal() {
      const [items, forecast] = await Promise.all([
        loadWeekPlan(),
        loadNextSevenDayForecast().catch(() => [] as WeekForecastDay[]),
      ]);

      if (!isMounted) {
        return;
      }

      setAssignedDays(items);
      setForecastByDay(
        Object.fromEntries(forecast.map((day) => [day.dayKey, day]))
      );
    }

    if (visible) {
      void hydrateModal();
      setReplacementCandidate(null);
    }

    return () => {
      isMounted = false;
    };
  }, [visible]);

  const activeAssignment = replacementCandidate
    ? assignedDays.find((item) => item.dayKey === replacementCandidate.dayKey) ?? replacementCandidate
    : null;

  function handleDayPress(dayKey: string, dayLabel: string) {
    const existingAssignment = assignedDays.find((item) => item.dayKey === dayKey);

    if (existingAssignment) {
      setReplacementCandidate(existingAssignment);
      return;
    }

    onSelectDay(dayKey, dayLabel);
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          alignItems: 'center',
          backgroundColor: 'rgba(24, 18, 14, 0.24)',
          flex: 1,
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: '#FFFDFC',
            borderRadius: 28,
            gap: spacing.md,
            maxWidth: 420,
            padding: spacing.lg,
            width: '100%',
          }}>
          {activeAssignment ? (
            <View style={{ gap: spacing.md }}>
              <SectionHeader
                title="Replace planned outfit?"
                subtitle="There's already an outfit assigned to that day. Are you sure you want to replace it?"
              />
              <View
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: 22,
                  borderWidth: 1,
                  gap: spacing.md,
                  padding: spacing.md,
                }}>
                <AppText variant="sectionTitle">{activeAssignment.dayLabel}</AppText>
                {activeAssignment.recommendation.sketchImageUrl ? (
                  <RemoteImagePanel
                    uri={activeAssignment.recommendation.sketchImageUrl}
                    aspectRatio={4 / 5}
                    minHeight={180}
                    fallbackTitle="Sketch unavailable"
                    fallbackMessage="The assigned illustration could not be displayed."
                  />
                ) : null}
                <View style={{ gap: spacing.xs }}>
                  <AppText variant="sectionTitle">{activeAssignment.recommendation.title}</AppText>
                  <AppText tone="muted">{formatTierLabel(activeAssignment.recommendation.tier)}</AppText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <PrimaryButton
                  label="No"
                  onPress={() => setReplacementCandidate(null)}
                  style={{ flex: 1 }}
                  variant="secondary"
                />
                <PrimaryButton
                  label="Yes"
                  onPress={() => onSelectDay(activeAssignment.dayKey, activeAssignment.dayLabel)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : (
            <>
              <SectionHeader title="Add to week" subtitle="Choose one of the next 7 days." />
              {days.map((day) => {
                const existingAssignment = assignedDays.find((item) => item.dayKey === day.dayKey);
                const isAssigned = Boolean(existingAssignment);
                const forecast = forecastByDay[day.dayKey];

                return (
                  <Pressable
                    key={day.dayKey}
                    onPress={() => handleDayPress(day.dayKey, day.dayLabel)}
                    style={{
                      alignItems: 'center',
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderRadius: 999,
                      borderWidth: 1,
                      flexDirection: 'row',
                      gap: spacing.sm,
                      justifyContent: 'space-between',
                      minHeight: 54,
                      paddingHorizontal: spacing.lg,
                    }}>
                    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, flex: 1 }}>
                      <Ionicons
                        color={isAssigned ? theme.colors.accent : theme.colors.subtleText}
                        name={isAssigned ? 'calendar' : 'ellipse-outline'}
                        size={18}
                      />
                      <AppText style={{ flexShrink: 1 }}>{day.dayLabel}</AppText>
                    </View>
                    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm }}>
                      {forecast ? (
                        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs }}>
                          <Ionicons color={theme.colors.subtleText} name={weatherIconName(forecast.weatherCode)} size={16} />
                          <AppText tone="muted">{`${Math.round(forecast.highTempC)}°C`}</AppText>
                        </View>
                      ) : null}
                      <AppText tone="muted">{isAssigned ? 'Assigned' : 'Open'}</AppText>
                    </View>
                  </Pressable>
                );
              })}
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatTierLabel(tier: WeekPlannedOutfit['recommendation']['tier']) {
  if (tier === 'smart-casual') {
    return 'Smart Casual';
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function weatherIconName(code: number): React.ComponentProps<typeof Ionicons>['name'] {
  if (code === 0) return 'sunny-outline';
  if ([1, 2, 3].includes(code)) return 'partly-sunny-outline';
  if ([45, 48].includes(code)) return 'cloud-outline';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rainy-outline';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow-outline';
  if ([95, 96, 99].includes(code)) return 'thunderstorm-outline';
  return 'cloud-outline';
}
