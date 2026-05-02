import { useEffect, useMemo, useRef, useState } from 'react';
import type { FlatList, SectionList } from 'react-native';

import type { ClosetItem } from '@/types/closet';
import { spacing } from '@/constants/theme';
import { chunkIntoRows, COLUMN_COUNT, type ClosetRow, type ClosetSection } from './closet-grid-utils';

export type ClosetSortMode = 'category' | 'recent';

type UseClosetNavigationParams = {
  items: ClosetItem[];
  sections: ClosetSection[];
};

export function useClosetNavigation({ items, sections }: UseClosetNavigationParams) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ClosetItem | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [pendingScrollItemId, setPendingScrollItemId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<ClosetSortMode>('category');

  // Refs created here — returned to the screen for forwarding to ClosetScreenView,
  // which wires them to the list components. The scroll effect calls them directly.
  const flatListRef = useRef<FlatList<ClosetRow>>(null);
  const sectionListRef = useRef<SectionList<ClosetRow>>(null);

  // FlatList renders whenever sort is 'recent' OR a category filter is active.
  // SectionList only renders for the default category-grouped, unfiltered view.
  const useFlatList = sortMode === 'recent' || selectedCategory !== null;

  // Memoised derived state — computed once per items/sort/filter change
  const sortedItems = useMemo(
    () =>
      sortMode === 'recent'
        ? [...items].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
        : items,
    [items, sortMode],
  );
  const displayItems = useMemo(
    () => (selectedCategory ? sortedItems.filter((item) => item.category === selectedCategory) : sortedItems),
    [sortedItems, selectedCategory],
  );
  const filteredRows = useMemo(() => chunkIntoRows(displayItems), [displayItems]);

  // Scroll-to-new-item using FlatList/SectionList index-based APIs (no measureLayout needed)
  useEffect(() => {
    if (!pendingScrollItemId) return;

    if (useFlatList) {
      // FlatList — scroll to the row containing the new item
      const itemIndex = displayItems.findIndex((i) => i.id === pendingScrollItemId);
      if (itemIndex < 0) return;
      const rowIndex = Math.floor(itemIndex / COLUMN_COUNT);
      const timeout = setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: rowIndex, animated: true, viewOffset: spacing.xl });
        setPendingScrollItemId(null);
      }, 150);
      return () => clearTimeout(timeout);
    } else {
      // SectionList — find section + row within that section
      const newItem = items.find((i) => i.id === pendingScrollItemId);
      if (!newItem) return;
      const cat = newItem.category || 'Other';
      const sectionIndex = sections.findIndex((s) => s.title === cat);
      if (sectionIndex < 0) return;
      const rowIndex =
        sections[sectionIndex]?.data.findIndex((row) =>
          row.some((i) => i.id === pendingScrollItemId),
        ) ?? -1;
      if (rowIndex < 0) return;
      const timeout = setTimeout(() => {
        try {
          sectionListRef.current?.scrollToLocation({
            sectionIndex,
            itemIndex: rowIndex,
            animated: true,
            viewOffset: spacing.xl,
          });
        } catch {
          // scrollToLocation can throw for unrendered items — ignore
        }
        setPendingScrollItemId(null);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [displayItems, items, pendingScrollItemId, sections, useFlatList]);

  return {
    selectedCategory,
    setSelectedCategory,
    pendingScrollItemId,
    setPendingScrollItemId,
    filterModalVisible,
    setFilterModalVisible,
    addModalVisible,
    setAddModalVisible,
    editingItem,
    setEditingItem,
    sortMode,
    setSortMode,
    useFlatList,
    displayItems,
    filteredRows,
    flatListRef,
    sectionListRef,
  };
}
