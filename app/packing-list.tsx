import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Calendar from 'expo-calendar';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { buildMatchedItemNameSet } from '@/lib/trip-closet-matches';
import { tripOutfitsStorage } from '@/lib/trip-outfits-storage';
import { buildPackingList } from '@/lib/trip-packing';
import type { PackingGroup } from '@/lib/trip-packing';
import { closetService } from '@/services/closet';
import { savedTripsService } from '@/services/saved-trips';
import type { ClosetItem } from '@/types/closet';

// ── Reminders export ──────────────────────────────────────────────────────────

async function exportToReminders(destination: string, groups: PackingGroup[]): Promise<void> {
  const { status } = await Calendar.requestRemindersPermissionsAsync();
  if (status !== 'granted') throw new Error('Reminders permission denied.');

  const reminderCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
  const sourceId = reminderCalendars.find((c) => c.allowsModifications)?.source.id
    ?? reminderCalendars[0]?.source.id;
  if (!sourceId) throw new Error('No reminders source available.');

  const listId = await Calendar.createCalendarAsync({
    title: `Pack for ${destination}`,
    color: '#A56A1F',
    entityType: Calendar.EntityTypes.REMINDER,
    sourceId,
  });

  const tasks: Promise<string>[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      tasks.push(
        Calendar.createReminderAsync(listId, {
          title: item.count > 1 ? `${item.name} ×${item.count}` : item.name,
          completed: false,
        }),
      );
    }
  }
  await Promise.all(tasks);
}

// ── Screen ────────────────────────────────────────────────────────────────────

type ExportState = 'idle' | 'exporting' | 'done' | 'error';

export default function PackingList() {
  const { tripId, savedTripId } = useLocalSearchParams<{ tripId: string; savedTripId?: string }>();
  const { theme } = useTheme();

  const [groups,      setGroups]      = useState<PackingGroup[]>([]);
  const [destination, setDestination] = useState('');
  const [isLoading,   setIsLoading]   = useState(true);
  const [loadError,   setLoadError]   = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);

  useEffect(() => {
    closetService.getItems().then((res) => {
      if (res.success && res.data) setClosetItems(res.data.items ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!tripId && !savedTripId) { setIsLoading(false); return; }

    if (savedTripId) {
      savedTripsService.getById(savedTripId)
        .then((detail) => {
          setDestination(detail.destination);
          setGroups(buildPackingList(detail.days ?? []));
        })
        .catch(() => setLoadError(true))
        .finally(() => setIsLoading(false));
      return;
    }

    tripOutfitsStorage.load(tripId!)
      .then((plan) => {
        if (plan) {
          setDestination(plan.destination);
          setGroups(buildPackingList(plan.days ?? []));
        } else {
          setLoadError(true);
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));
  }, [tripId, savedTripId]);

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  const matchedItemNames = useMemo(() => {
    return buildMatchedItemNameSet(
      groups.flatMap((group) => group.items.map((item) => item.name)),
      closetItems,
    );
  }, [closetItems, groups]);

  async function handleExportToReminders() {
    if (exportState === 'exporting' || groups.length === 0) return;
    setExportState('exporting');
    try {
      await exportToReminders(destination || 'Your trip', groups);
      setExportState('done');
    } catch {
      setExportState('error');
      setTimeout(() => setExportState('idle'), 3000);
    }
  }

  const exportLabel =
    exportState === 'exporting' ? 'Adding to Reminders…'  :
    exportState === 'done'      ? 'Added to Reminders ✓'  :
    exportState === 'error'     ? 'Failed — tap to retry' :
    'Add to Reminders';

  const exportIcon: string =
    exportState === 'done'  ? 'check' :
    exportState === 'error' ? 'close' :
    'archive';

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} style={{ padding: spacing.xs }}>
            <AppIcon name="arrow-left" color={theme.colors.text} size={20} />
          </Pressable>
          <AppText variant="heroSmall">Packing List</AppText>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
          <AppText tone="muted" style={{ textAlign: 'center' }}>
            Could not load your trip data. Please go back and try again.
          </AppText>
          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: theme.colors.text,
              borderRadius: 999,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
            }}>
            <AppText style={{ color: theme.colors.inverseText, fontFamily: theme.fonts.sansMedium, fontSize: 13 }}>
              Go Back
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable onPress={() => router.back()} style={{ padding: spacing.xs }}>
            <AppIcon name="arrow-left" color={theme.colors.text} size={20} />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heroSmall">Packing List</AppText>
            <AppText tone="muted">
              {destination || 'Your trip'}
              {totalItems > 0 ? ` · ${totalItems} item type${totalItems !== 1 ? 's' : ''}` : ''}
            </AppText>
          </View>
        </View>

        {groups.length === 0 ? (
          <AppText tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.xl }}>
            No items to pack yet.
          </AppText>
        ) : (
          <>
            {/* Export to Reminders */}
            <Pressable
              onPress={() => void handleExportToReminders()}
              disabled={exportState === 'exporting' || exportState === 'done'}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                backgroundColor: exportState === 'done' ? theme.colors.subtleSurface : theme.colors.text,
                borderRadius: 999,
                paddingVertical: spacing.md,
              }}>
              {exportState === 'exporting' ? (
                <ActivityIndicator size="small" color={theme.colors.inverseText} />
              ) : (
                <AppIcon
                  name={exportIcon as any}
                  color={exportState === 'done' ? theme.colors.mutedText : theme.colors.inverseText}
                  size={15}
                />
              )}
              <AppText style={{
                color: exportState === 'done' ? theme.colors.mutedText : theme.colors.inverseText,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 14,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>
                {exportLabel}
              </AppText>
            </Pressable>

            {/* Packing groups */}
            {groups.map((group) => (
              <View
                key={group.category}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: 20,
                  borderWidth: 1,
                  overflow: 'hidden',
                }}>
                <View style={{
                  borderBottomColor: theme.colors.border,
                  borderBottomWidth: 1,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                }}>
                  <AppText style={{
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 11,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                    color: theme.colors.mutedText,
                  }}>
                    {group.category}
                  </AppText>
                </View>

                {group.items.map((item, idx) => (
                  <View
                    key={item.name}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.sm + 2,
                      borderBottomWidth: idx < group.items.length - 1 ? 1 : 0,
                      borderBottomColor: theme.colors.border,
                    }}>
                    <AppText style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{item.name}</AppText>
                    {matchedItemNames.has(item.name) && (
                      <AppIcon name="check-circle" color={theme.colors.accent} size={14} style={{ marginTop: 3 }} />
                    )}
                    {item.count > 1 && (
                      <View style={{
                        backgroundColor: theme.colors.subtleSurface,
                        borderRadius: 999,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                        marginLeft: spacing.sm,
                      }}>
                        <AppText style={{ color: theme.colors.mutedText, fontSize: 11, fontFamily: theme.fonts.sansMedium }}>
                          Worn ×{item.count}
                        </AppText>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
