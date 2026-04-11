import { useEffect, useMemo, useRef, useState } from 'react';
import type { FlatList, SectionList } from 'react-native';

import type { ClosetItem } from '@/types/closet';
import { spacing } from '@/constants/theme';
import { chunkIntoRows, COLUMN_COUNT, type ClosetRow, type ClosetSection } from './closet-grid-utils';

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

  // Refs created here — returned to the screen for forwarding to ClosetScreenView,
  // which wires them to the list components. The scroll effect calls them directly.
  const flatListRef = useRef<FlatList<ClosetRow>>(null);
  const sectionListRef = useRef<SectionList<ClosetRow>>(null);

  // Memoised derived state — computed once per items/filter change, not on every render
  const displayItems = useMemo(
    () => (selectedCategory ? items.filter((item) => item.category === selectedCategory) : items),
    [items, selectedCategory],
  );
  const filteredRows = useMemo(() => chunkIntoRows(displayItems), [displayItems]);

  // Scroll-to-new-item using FlatList/SectionList index-based APIs (no measureLayout needed)
  useEffect(() => {
    if (!pendingScrollItemId) return;

    if (selectedCategory) {
      // Filtered FlatList — scroll to the row containing the new item
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
  }, [displayItems, items, pendingScrollItemId, sections, selectedCategory]);

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
    displayItems,
    filteredRows,
    flatListRef,
    sectionListRef,
  };
}
