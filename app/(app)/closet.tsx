import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, View } from 'react-native';

import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';

const COLUMN_COUNT = 3;
const POLL_INTERVAL_MS = 5000;

export default function ClosetScreen() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const translateX = useRef(new Animated.Value(-140)).current;

  const loadItems = useCallback(async () => {
    const response = await closetService.getItems();
    if (response.success && response.data) {
      setItems(response.data.items);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // Loading bar animation
  useEffect(() => {
    if (!isLoading) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 220,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, { toValue: -140, duration: 0, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isLoading, translateX]);

  // Poll for pending sketch items
  useEffect(() => {
    const hasPending = items.some((item) => item.sketchStatus === 'pending');
    if (!hasPending) return;

    const interval = setInterval(() => {
      void closetService.getItems().then((response) => {
        if (response.success && response.data) {
          setItems(response.data.items);
        }
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [items]);

  const categories = buildCategories(items);
  const displayItems = selectedCategory
    ? items.filter((item) => item.category === selectedCategory)
    : items;

  const activeLabel = selectedCategory ?? 'All Items';

  return (
    <AppScreen scrollable>
      <View style={{ gap: spacing.xl, paddingBottom: spacing.xl }}>
        {/* Header */}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            The Atelier
          </AppText>
          <AppText variant="heroSmall">My Closet</AppText>
          <AppText tone="muted">Your catalogued wardrobe pieces.</AppText>
        </View>

        {/* Loading bar */}
        {isLoading ? (
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 28,
              borderWidth: 1,
              padding: spacing.xl,
              gap: spacing.md,
              alignItems: 'center',
            }}>
            <View
              style={{
                backgroundColor: theme.colors.border,
                borderRadius: 999,
                height: 10,
                overflow: 'hidden',
                width: '100%',
              }}>
              <Animated.View
                style={{
                  backgroundColor: theme.colors.accent,
                  borderRadius: 999,
                  height: '100%',
                  transform: [{ translateX }],
                  width: 140,
                }}
              />
            </View>
            <AppText tone="muted">Loading your wardrobe...</AppText>
          </View>
        ) : null}

        {/* Category filter */}
        {!isLoading && items.length > 0 ? (
          <Pressable
            onPress={() => setFilterModalVisible(true)}
            style={{
              alignItems: 'center',
              alignSelf: 'flex-start',
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 999,
              borderWidth: 1,
              flexDirection: 'row',
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}>
            <AppText variant="eyebrow" style={{ letterSpacing: 1.4 }}>{activeLabel}</AppText>
            <Ionicons color={theme.colors.mutedText} name="chevron-down" size={14} />
          </Pressable>
        ) : null}

        {/* Grid or Sectioned list */}
        {!isLoading ? (
          selectedCategory ? (
            <ClosetGrid items={displayItems} />
          ) : (
            <SectionedCloset items={items} />
          )
        ) : null}

        {/* Empty state */}
        {!isLoading && items.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 28,
              borderWidth: 1,
              gap: spacing.md,
              padding: spacing.xl,
            }}>
            <Ionicons color={theme.colors.subtleText} name="shirt-outline" size={40} />
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <AppText variant="sectionTitle">Your closet is empty</AppText>
              <AppText tone="muted" style={{ textAlign: 'center' }}>
                Save pieces from your outfit reviews or piece checks to start cataloguing your wardrobe.
              </AppText>
            </View>
          </View>
        ) : null}
      </View>

      {/* Category filter modal */}
      <CategoryFilterModal
        visible={filterModalVisible}
        categories={categories}
        selected={selectedCategory}
        onSelect={(cat) => {
          setSelectedCategory(cat);
          setFilterModalVisible(false);
        }}
        onClose={() => setFilterModalVisible(false)}
      />
    </AppScreen>
  );
}

// ── Grid component ──────────────────────────────────────────────────────────

function ClosetGrid({ items }: { items: ClosetItem[] }) {
  if (items.length === 0) {
    return (
      <AppText tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.lg }}>
        No items in this category.
      </AppText>
    );
  }

  const rows: ClosetItem[][] = [];
  for (let i = 0; i < items.length; i += COLUMN_COUNT) {
    rows.push(items.slice(i, i + COLUMN_COUNT));
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: spacing.sm }}>
          {row.map((item) => (
            <ClosetGridItem key={item.id} item={item} />
          ))}
          {/* Fill empty cells */}
          {row.length < COLUMN_COUNT
            ? Array.from({ length: COLUMN_COUNT - row.length }).map((_, i) => (
                <View key={`empty-${i}`} style={{ flex: 1 }} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

function ClosetGridItem({ item }: { item: ClosetItem }) {
  const [cellWidth, setCellWidth] = useState(0);
  const hasBoth = Boolean(item.sketchImageUrl) && Boolean(item.uploadedImageUrl);
  const primaryUri = item.sketchImageUrl ?? item.uploadedImageUrl ?? null;

  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <View
        onLayout={(e) => setCellWidth(e.nativeEvent.layout.width)}
        style={{
          aspectRatio: 3 / 4,
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: 16,
          borderWidth: 1,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {hasBoth && cellWidth > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: cellWidth, flex: 1 }}>
            <Image
              contentFit="cover"
              source={{ uri: item.sketchImageUrl! }}
              style={{ width: cellWidth, flex: 1 }}
            />
            <Image
              contentFit="cover"
              source={{ uri: item.uploadedImageUrl! }}
              style={{ width: cellWidth, flex: 1 }}
            />
          </ScrollView>
        ) : primaryUri ? (
          <Image
            contentFit="cover"
            source={{ uri: primaryUri }}
            style={{ height: '100%', width: '100%' }}
          />
        ) : item.sketchStatus === 'pending' ? (
          <Ionicons color={theme.colors.subtleText} name="time-outline" size={22} />
        ) : (
          <Ionicons color={theme.colors.subtleText} name="shirt-outline" size={22} />
        )}

        {/* Swipe indicator dots */}
        {hasBoth ? (
          <View
            style={{
              bottom: 6,
              flexDirection: 'row',
              gap: 4,
              position: 'absolute',
              alignSelf: 'center',
            }}>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 999, height: 5, width: 5, opacity: 0.9 }} />
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 999, height: 5, width: 5, opacity: 0.45 }} />
          </View>
        ) : null}
      </View>
      <AppText
        style={{ fontSize: 11, fontFamily: theme.fonts.sansMedium, letterSpacing: 0.2 }}
        numberOfLines={2}>
        {item.title}
      </AppText>
      {item.brand ? (
        <AppText tone="muted" style={{ fontSize: 10 }} numberOfLines={1}>
          {item.brand}
        </AppText>
      ) : null}
    </View>
  );
}

// ── Sectioned (All) view ────────────────────────────────────────────────────

function SectionedCloset({ items }: { items: ClosetItem[] }) {
  const grouped = groupByCategory(items);
  const sortedCategories = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <View style={{ gap: spacing.xl }}>
      {sortedCategories.map((category) => (
        <View key={category} style={{ gap: spacing.md }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            {category}
          </AppText>
          <ClosetGrid items={grouped[category]!} />
        </View>
      ))}
    </View>
  );
}

// ── Category filter modal ────────────────────────────────────────────────────

type CategoryEntry = { label: string; count: number };

type CategoryFilterModalProps = {
  visible: boolean;
  categories: CategoryEntry[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  onClose: () => void;
};

function CategoryFilterModal({ visible, categories, selected, onSelect, onClose }: CategoryFilterModalProps) {
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
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            Filter by Category
          </AppText>

          {/* All option */}
          <Pressable
            onPress={() => onSelect(null)}
            style={[filterRowStyle, !selected ? filterRowActiveStyle : null]}>
            <AppText variant="sectionTitle" style={!selected ? { color: theme.colors.accent } : undefined}>
              All Items
            </AppText>
            <AppText tone="muted">{categories.reduce((sum, c) => sum + c.count, 0)}</AppText>
          </Pressable>

          {categories.map((cat) => (
            <Pressable
              key={cat.label}
              onPress={() => onSelect(cat.label)}
              style={[filterRowStyle, selected === cat.label ? filterRowActiveStyle : null]}>
              <AppText
                variant="sectionTitle"
                style={selected === cat.label ? { color: theme.colors.accent } : undefined}>
                {cat.label}
              </AppText>
              <AppText tone="muted">{cat.count}</AppText>
            </Pressable>
          ))}

          <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByCategory(items: ClosetItem[]): Record<string, ClosetItem[]> {
  const groups: Record<string, ClosetItem[]> = {};
  for (const item of items) {
    const cat = item.category || 'Other';
    if (!groups[cat]) {
      groups[cat] = [];
    }
    groups[cat]!.push(item);
  }
  return groups;
}

function buildCategories(items: ClosetItem[]): CategoryEntry[] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const cat = item.category || 'Other';
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const filterRowStyle = {
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
} as const;

const filterRowActiveStyle = {
  borderColor: theme.colors.accent,
} as const;
