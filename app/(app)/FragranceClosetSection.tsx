import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { FragranceCard } from '@/components/cards/fragrance-card';
import { SaveToClosetModal } from '@/components/closet/save-to-closet-modal';
import { FragranceItemSheetView } from '@/components/closet/fragrance/FragranceItemSheetView';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import type { UserFragrance } from '@/types/fragrance';
import { useFragranceClosetData } from './useFragranceClosetData';

const COLUMN_COUNT = 3;

export function FragranceClosetSection() {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const cellWidth = useMemo(
    () => (screenWidth - spacing.lg * 2 - spacing.sm * (COLUMN_COUNT - 1)) / COLUMN_COUNT,
    [screenWidth],
  );

  const { items, setItems, isLoading, loadItems } = useFragranceClosetData();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UserFragrance | null>(null);

  function handleFragranceSaved(item: UserFragrance) {
    setItems((prev) => [item, ...prev]);
  }

  function handleItemUpdated(item: UserFragrance) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    setSelectedItem(item);
  }

  function handleItemDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedItem(null);
  }

  const rows = useMemo(() => {
    const chunked: UserFragrance[][] = [];
    for (let i = 0; i < items.length; i += COLUMN_COUNT) chunked.push(items.slice(i, i + COLUMN_COUNT));
    return chunked;
  }, [items]);

  return (
    <SafeAreaView edges={[]} style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(_, index) => `fragrance-row-${index}`}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xl }}>
            <AppText variant="heroSmall">My Fragrances</AppText>
            <Pressable
              hitSlop={8}
              onPress={() => setAddModalVisible(true)}
              style={{
                alignItems: 'center',
                backgroundColor: theme.colors.accent,
                borderRadius: 999,
                height: 40,
                justifyContent: 'center',
                width: 40,
              }}>
              <AppIcon color="#FFF" name="add" size={22} />
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={theme.colors.accent} style={{ marginTop: spacing.xxl }} />
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl }}>
              <AppIcon color={theme.colors.subtleText} name="tag" size={28} />
              <AppText tone="muted" style={{ textAlign: 'center', paddingHorizontal: spacing.xl }}>
                Add a fragrance to get outfit-matched scent recommendations alongside your looks.
              </AppText>
            </View>
          )
        }
        renderItem={({ item: row }) => (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {row.map((item) => (
              <FragranceCard key={item.id} item={item} cellWidth={cellWidth} onPress={setSelectedItem} />
            ))}
            {row.length < COLUMN_COUNT
              ? Array.from({ length: COLUMN_COUNT - row.length }).map((_, i) => <View key={`empty-${i}`} style={{ flex: 1 }} />)
              : null}
          </View>
        )}
      />

      <SaveToClosetModal
        visible={addModalVisible}
        initialItemKind="fragrance"
        onClose={() => setAddModalVisible(false)}
        onSaved={() => undefined}
        onFragranceSaved={(item) => {
          handleFragranceSaved(item);
          void loadItems();
        }}
      />

      <FragranceItemSheetView
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSaved={handleItemUpdated}
        onDeleted={handleItemDeleted}
      />
    </SafeAreaView>
  );
}
