import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { spacing } from '@/constants/theme';
import { ClosetItemSheetView } from '@/components/closet/ClosetItemSheetView';
import { HelpMePickModal } from '@/components/closet/HelpMePickModal';
import { useHelpMePick } from '@/components/closet/useHelpMePick';
import type { ClosetItem } from '@/types/closet';
import { COLUMN_COUNT } from './closet-grid-utils';
import { useClosetAnimations } from './useClosetAnimations';
import { useClosetData } from './useClosetData';
import { useClosetNavigation } from './useClosetNavigation';
import { ClosetScreenView } from './ClosetScreenView';

// Categories excluded from Help Me Pick eligibility (accessories + shoes)
const HELP_ME_PICK_EXCLUDED = new Set([
  'Shoes', 'Sneakers', 'Loafers', 'Boots',
  'Belt', 'Bag', 'Watch', 'Scarf', 'Hat', 'Tie', 'Socks', 'Sunglasses',
]);

export default function ClosetScreen() {
  // ── Step 1: Data — items, loading, polling, categories, sections ──────────
  const { items, setItems, isLoading, loadItems, categories, sections } = useClosetData();

  // ── Step 2: Navigation — consumes items and sections from step 1 ──────────
  const {
    selectedCategory, setSelectedCategory,
    setPendingScrollItemId,
    filterModalVisible, setFilterModalVisible,
    addModalVisible, setAddModalVisible,
    editingItem, setEditingItem,
    displayItems: _displayItems,
    filteredRows,
    flatListRef, sectionListRef,
  } = useClosetNavigation({ items, sections });

  // ── Step 3: Animation — consumes only isLoading from step 1 ──────────────
  const { translateX } = useClosetAnimations(isLoading);

  // ── Step 4: Help Me Pick ──────────────────────────────────────────────────
  const helpMePick = useHelpMePick();

  // ── Cell width — purely a render calculation ──────────────────────────────
  const { width: screenWidth } = useWindowDimensions();
  const cellWidth = useMemo(
    () => (screenWidth - spacing.lg * 2 - spacing.sm * (COLUMN_COUNT - 1)) / COLUMN_COUNT,
    [screenWidth],
  );

  const eligibleItemCount = useMemo(
    () => items.filter((item) => !HELP_ME_PICK_EXCLUDED.has(item.category)).length,
    [items],
  );

  // ── Cross-hook coordinators ───────────────────────────────────────────────

  function handleItemSaved(updated: ClosetItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingItem(updated); // keep modal open in view mode with fresh data
  }

  function handleItemDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setEditingItem(null);
  }

  // Critical sequencing — order is non-negotiable:
  // 1. Clear filter (switches list to SectionList)
  // 2. Arm scroll before loadItems resolves (guard absorbs the race)
  // 3. Fetch so new item appears and sections update
  function handleNewItemSaved(savedItem: ClosetItem) {
    setSelectedCategory(null);
    setPendingScrollItemId(savedItem.id);
    void loadItems();
  }

  return (
    <>
      <ClosetScreenView
        isLoading={isLoading}
        itemCount={items.length}
        eligibleItemCount={eligibleItemCount}
        categories={categories}
        sections={sections}
        selectedCategory={selectedCategory}
        filteredRows={filteredRows}
        filterModalVisible={filterModalVisible}
        onFilterPress={() => setFilterModalVisible(true)}
        onCategorySelect={(cat) => { setSelectedCategory(cat); setFilterModalVisible(false); }}
        onFilterModalClose={() => setFilterModalVisible(false)}
        addModalVisible={addModalVisible}
        onAddPress={() => setAddModalVisible(true)}
        onAddModalClose={() => setAddModalVisible(false)}
        onNewItemSaved={handleNewItemSaved}
        onHelpMePickPress={helpMePick.open}
        cellWidth={cellWidth}
        onPressItem={setEditingItem}
        flatListRef={flatListRef}
        sectionListRef={sectionListRef}
        translateX={translateX}
      />
      {editingItem !== null ? (
        <ClosetItemSheetView
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleItemSaved}
          onDeleted={handleItemDeleted}
        />
      ) : null}
      <HelpMePickModal
        hook={helpMePick}
        onUseItem={() => undefined}
      />
    </>
  );
}
