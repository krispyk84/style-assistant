import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { tripOutfitsStorage } from '@/lib/trip-outfits-storage';
import type { TripOutfitDay } from '@/services/trip-outfits';

// ── Category detection ────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: [string, string[]][] = [
  ['Swimwear',    ['swimsuit', 'bikini', 'boardshort', 'swim trunks', 'one-piece', 'swimwear', 'wetsuit']],
  ['Outerwear',   ['jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'windbreaker', 'parka', 'vest', 'puffer', 'trench', 'overcoat', 'jumper']],
  ['Dresses',     ['dress', 'jumpsuit', 'romper', 'overalls']],
  ['Tops',        ['shirt', 'tee', 't-shirt', 'blouse', 'top', 'sweater', 'polo', 'tank', 'turtleneck', 'henley', 'pullover']],
  ['Bottoms',     ['trouser', 'trousers', 'jeans', 'shorts', 'skirt', 'chino', 'chinos', 'legging', 'leggings', 'jogger', 'joggers', 'pant', 'pants', 'culottes', 'midi', 'maxi']],
];

const CATEGORY_ORDER = ['Swimwear', 'Outerwear', 'Dresses', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories'];

function categorizeItem(item: string, isShoes?: boolean, isBag?: boolean, isAccessory?: boolean): string {
  if (isShoes) return 'Shoes';
  if (isBag) return 'Bags';
  if (isAccessory) return 'Accessories';
  const lower = item.toLowerCase();
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return 'Tops'; // fallback
}

type PackingItem = { name: string; count: number };
type PackingGroup = { category: string; items: PackingItem[] };

function buildPackingList(days: TripOutfitDay[]): PackingGroup[] {
  // Accumulate counts per item name (case-insensitive) with category
  const countMap = new Map<string, { category: string; count: number; displayName: string }>();

  function add(raw: string, category: string) {
    const key = raw.trim().toLowerCase();
    if (!key) return;
    const existing = countMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      countMap.set(key, { category, count: 1, displayName: raw.trim() });
    }
  }

  for (const day of days) {
    for (const piece of day.pieces) add(piece, categorizeItem(piece));
    add(day.shoes, 'Shoes');
    if (day.bag) add(day.bag, 'Bags');
    for (const acc of day.accessories) add(acc, 'Accessories');
  }

  // Group by category
  const groupMap = new Map<string, PackingItem[]>();
  for (const { category, count, displayName } of countMap.values()) {
    const list = groupMap.get(category) ?? [];
    list.push({ name: displayName, count });
    groupMap.set(category, list);
  }

  // Sort within each group by count desc
  const groups: PackingGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = groupMap.get(category);
    if (items?.length) {
      groups.push({ category, items: items.sort((a, b) => b.count - a.count) });
    }
  }

  return groups;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PackingListScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { theme } = useTheme();

  const [groups, setGroups] = useState<PackingGroup[]>([]);
  const [destination, setDestination] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tripId) { setIsLoading(false); return; }
    tripOutfitsStorage.load(tripId).then((plan) => {
      if (plan) {
        setDestination(plan.destination);
        setGroups(buildPackingList(plan.days));
      }
      setIsLoading(false);
    });
  }, [tripId]);

  const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable
            onPress={() => router.back()}
            style={{ padding: spacing.xs }}>
            <AppIcon name="arrow-left" color={theme.colors.text} size={20} />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heroSmall">Packing List</AppText>
            <AppText tone="muted">{destination || 'Your trip'}{totalItems > 0 ? ` · ${totalItems} item type${totalItems !== 1 ? 's' : ''}` : ''}</AppText>
          </View>
        </View>

        {isLoading ? null : groups.length === 0 ? (
          <AppText tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.xl }}>
            No items to pack yet.
          </AppText>
        ) : (
          groups.map((group) => (
            <View
              key={group.category}
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: 20,
                borderWidth: 1,
                overflow: 'hidden',
              }}>
              {/* Category header */}
              <View
                style={{
                  borderBottomColor: theme.colors.border,
                  borderBottomWidth: 1,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                }}>
                <AppText style={{ fontFamily: theme.fonts.sansMedium, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: theme.colors.mutedText }}>
                  {group.category}
                </AppText>
              </View>

              {/* Items */}
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
                  {item.count > 1 && (
                    <View
                      style={{
                        backgroundColor: theme.colors.subtleSurface,
                        borderRadius: 999,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                        marginLeft: spacing.sm,
                      }}>
                      <AppText style={{ color: theme.colors.mutedText, fontSize: 11, fontFamily: theme.fonts.sansMedium }}>
                        ×{item.count}
                      </AppText>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
