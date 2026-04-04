import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, SectionList, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { SaveToClosetModal } from '@/components/closet/save-to-closet-modal';
import { PrimaryButton } from '@/components/ui/primary-button';
import { spacing, theme } from '@/constants/theme';
import { incrementClosetItemCounter } from '@/lib/closet-storage';
import { closetService } from '@/services/closet';
import { FitStatusPicker } from '@/components/closet/fit-status-picker';
import type { ClosetItem, ClosetItemFitStatus } from '@/types/closet';
import { CLOSET_FIT_STATUS_OPTIONS } from '@/types/closet';

const COLUMN_COUNT = 3;
const POLL_INTERVAL_MS = 5000;

// A row in the grid — up to COLUMN_COUNT items
type ClosetRow = ClosetItem[];

function chunkIntoRows(items: ClosetItem[]): ClosetRow[] {
  const rows: ClosetRow[] = [];
  for (let i = 0; i < items.length; i += COLUMN_COUNT) {
    rows.push(items.slice(i, i + COLUMN_COUNT));
  }
  return rows;
}

export default function ClosetScreen() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ClosetItem | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [pendingScrollItemId, setPendingScrollItemId] = useState<string | null>(null);
  const translateX = useRef(new Animated.Value(-140)).current;

  const { width: screenWidth } = useWindowDimensions();
  // Compute cell width once at screen level — eliminates per-item onLayout state
  const cellWidth = useMemo(
    () => (screenWidth - spacing.lg * 2 - spacing.sm * (COLUMN_COUNT - 1)) / COLUMN_COUNT,
    [screenWidth],
  );

  const flatListRef = useRef<FlatList<ClosetRow>>(null);
  const sectionListRef = useRef<SectionList<ClosetRow>>(null);

  const loadItems = useCallback(async () => {
    const response = await closetService.getItems();
    if (response.success && response.data) {
      setItems(response.data.items);
    }
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadItems();
    }, [loadItems]),
  );

  // Loading bar animation
  useEffect(() => {
    if (!isLoading) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: 220, duration: 1400, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -140, duration: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isLoading, translateX]);

  // Poll for pending sketch items — depends on a stable boolean, not the entire items array,
  // so the interval is only recreated when pending status actually flips.
  const hasPendingItems = useMemo(() => items.some((item) => item.sketchStatus === 'pending'), [items]);
  useEffect(() => {
    if (!hasPendingItems) return;
    const interval = setInterval(() => {
      void closetService.getItems().then((response) => {
        if (response.success && response.data) {
          setItems(response.data.items);
        }
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasPendingItems]);

  // Memoised derived state — computed once per items/filter change, not on every render
  const categories = useMemo(() => buildCategories(items), [items]);
  const displayItems = useMemo(
    () => (selectedCategory ? items.filter((item) => item.category === selectedCategory) : items),
    [items, selectedCategory],
  );
  const filteredRows = useMemo(() => chunkIntoRows(displayItems), [displayItems]);
  const sections = useMemo(() => {
    const grouped = groupByCategory(items);
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((cat) => ({ title: cat, data: chunkIntoRows(grouped[cat]!) }));
  }, [items]);

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

  function handleItemSaved(updated: ClosetItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditingItem(null);
  }

  function handleItemDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setEditingItem(null);
  }

  function handleNewItemSaved(savedItem: ClosetItem) {
    setSelectedCategory(null);
    setPendingScrollItemId(savedItem.id);
    void loadItems();
  }

  const activeLabel = selectedCategory ?? 'All Items';

  // renderItem is stable unless cellWidth changes (device rotation / window resize)
  const renderRow = useCallback(
    ({ item: row }: { item: ClosetRow }) => (
      <ClosetGridRow row={row} cellWidth={cellWidth} onPressItem={setEditingItem} />
    ),
    [cellWidth],
  );

  const listHeaderContent = (
    <View style={{ gap: spacing.xl, paddingBottom: spacing.xs }}>
      {/* Title + add button */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ gap: spacing.sm, flex: 1 }}>
          <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
            The Atelier
          </AppText>
          <AppText variant="heroSmall">My Closet</AppText>
          <AppText tone="muted">Your catalogued wardrobe pieces.</AppText>
        </View>
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
          <Ionicons color="#FFF" name="add" size={22} />
        </Pressable>
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
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right']}>
      {selectedCategory ? (
        <FlatList<ClosetRow>
          ref={flatListRef}
          data={filteredRows}
          keyExtractor={(row, i) => row[0]?.id ?? String(i)}
          renderItem={renderRow}
          ListHeaderComponent={listHeaderContent}
          ItemSeparatorComponent={RowSeparator}
          ListEmptyComponent={
            !isLoading ? (
              <AppText tone="muted" style={{ textAlign: 'center', paddingVertical: spacing.lg }}>
                No items in this category.
              </AppText>
            ) : null
          }
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={9}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
        />
      ) : (
        <SectionList<ClosetRow>
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(row, i) => row[0]?.id ?? String(i)}
          renderItem={renderRow}
          renderSectionHeader={({ section: { title } }) => (
            <View style={{ paddingBottom: spacing.md, paddingTop: spacing.xl }}>
              <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
                {title}
              </AppText>
            </View>
          )}
          ListHeaderComponent={listHeaderContent}
          ItemSeparatorComponent={RowSeparator}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          windowSize={5}
          maxToRenderPerBatch={5}
          initialNumToRender={9}
          removeClippedSubviews={Platform.OS === 'android'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={() => undefined}
        />
      )}

      <SaveToClosetModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSaved={(savedItem) => {
          handleNewItemSaved(savedItem);
        }}
      />

      <CategoryFilterModal
        visible={filterModalVisible}
        categories={categories}
        selected={selectedCategory}
        onSelect={(cat) => { setSelectedCategory(cat); setFilterModalVisible(false); }}
        onClose={() => setFilterModalVisible(false)}
      />

      {editingItem !== null ? (
        <ClosetItemEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleItemSaved}
          onDeleted={handleItemDeleted}
        />
      ) : null}
    </SafeAreaView>
  );
}

const RowSeparator = () => <View style={{ height: spacing.sm }} />;

// ── Grid row ──────────────────────────────────────────────────────────────────

type ClosetGridRowProps = {
  row: ClosetRow;
  cellWidth: number;
  onPressItem: (item: ClosetItem) => void;
};

const ClosetGridRow = React.memo(function ClosetGridRow({ row, cellWidth, onPressItem }: ClosetGridRowProps) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {row.map((item) => (
        <ClosetGridItem
          key={item.id}
          item={item}
          cellWidth={cellWidth}
          onPress={onPressItem}
        />
      ))}
      {row.length < COLUMN_COUNT
        ? Array.from({ length: COLUMN_COUNT - row.length }).map((_, i) => (
            <View key={`empty-${i}`} style={{ flex: 1 }} />
          ))
        : null}
    </View>
  );
});

// ── Grid item ─────────────────────────────────────────────────────────────────

type ClosetGridItemProps = {
  item: ClosetItem;
  cellWidth: number;
  onPress: (item: ClosetItem) => void;
};

const ClosetGridItem = React.memo(function ClosetGridItem({ item, cellWidth, onPress }: ClosetGridItemProps) {
  const hasBoth = Boolean(item.sketchImageUrl) && Boolean(item.uploadedImageUrl);
  const primaryUri = item.sketchImageUrl ?? item.uploadedImageUrl ?? null;

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={{ flex: 1, gap: spacing.xs }} onPress={() => onPress(item)}>
        <View
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
              <Image contentFit="cover" source={{ uri: item.sketchImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
              <Image contentFit="cover" source={{ uri: item.uploadedImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
            </ScrollView>
          ) : primaryUri ? (
            <Image contentFit="cover" source={{ uri: primaryUri }} style={{ height: '100%', width: '100%' }} />
          ) : item.sketchStatus === 'pending' ? (
            <Ionicons color={theme.colors.subtleText} name="time-outline" size={22} />
          ) : (
            <Ionicons color={theme.colors.subtleText} name="shirt-outline" size={22} />
          )}

          {hasBoth ? (
            <View style={{ bottom: 6, flexDirection: 'row', gap: 4, position: 'absolute', alignSelf: 'center' }}>
              <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 5, width: 5, opacity: 0.9 }} />
              <View style={{ backgroundColor: '#FFF', borderRadius: 999, height: 5, width: 5, opacity: 0.45 }} />
            </View>
          ) : null}
        </View>
        <View style={{ gap: 2 }}>
          <AppText style={{ fontSize: 11, fontFamily: theme.fonts.sansMedium, letterSpacing: 0.2 }} numberOfLines={2}>
            {item.title}
          </AppText>
          {item.brand ? (
            <AppText tone="muted" style={{ fontSize: 10 }} numberOfLines={1}>{item.brand}</AppText>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
});

// ── Edit modal ────────────────────────────────────────────────────────────────

type ClosetItemEditModalProps = {
  item: ClosetItem | null;
  onClose: () => void;
  onSaved: (item: ClosetItem) => void;
  onDeleted: (id: string) => void;
};

function ClosetItemEditModal({ item, onClose, onSaved, onDeleted }: ClosetItemEditModalProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [fitStatus, setFitStatus] = useState<ClosetItemFitStatus | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cellWidth, setCellWidth] = useState(0);

  // Separate animation channels: backdrop fades, sheet slides
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(800)).current;

  // Animate in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate out then call onClose so the parent unmounts us
  function dismissAndClose() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 800, duration: 240, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  useEffect(() => {
    if (!item) return;
    setTitle(item.title);
    setCategory(item.category);
    setBrand(item.brand);
    setSize(item.size);
    setFitStatus(item.fitStatus);
    setIsEditing(false);
    setError(null);
    setConfirmDelete(false);
  }, [item]);

  async function handleSave() {
    if (!item || !title.trim()) return;
    setIsSaving(true);
    setError(null);
    const response = await closetService.updateItem({
      id: item.id,
      title: title.trim(),
      brand: brand.trim(),
      size: size.trim(),
      category: category.trim() || 'Clothing',
      fitStatus,
    });
    setIsSaving(false);
    if (response.success && response.data) {
      setIsEditing(false);
      onSaved(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to save changes.');
    }
  }

  async function handleDelete() {
    if (!item) return;
    setIsDeleting(true);
    await closetService.deleteItem(item.id);
    setIsDeleting(false);
    onDeleted(item.id);
  }

  function handleAnchorToOutfit() {
    if (!item) return;
    const id = item.id;
    const anchorImageUrl = item.sketchImageUrl ?? item.uploadedImageUrl ?? '';
    void incrementClosetItemCounter(id, 'anchorToOutfitCount');
    onClose();
    // Defer navigation until after the modal close state update has flushed
    setTimeout(() => {
      router.push({
        pathname: '/create-look',
        params: {
          closetItemId: id,
          closetItemTitle: item.title,
          closetItemImageUrl: anchorImageUrl,
          closetItemFitStatus: item.fitStatus,
        },
      });
    }, 50);
  }

  const hasBoth = Boolean(item?.sketchImageUrl) && Boolean(item?.uploadedImageUrl);
  const primaryUri = item?.sketchImageUrl ?? item?.uploadedImageUrl ?? null;

  return (
    <Modal animationType="none" transparent visible onRequestClose={dismissAndClose}>
      {/* Backdrop: absolute fill, only opacity animates — never slides */}
      <Animated.View
        pointerEvents="none"
        style={{
          backgroundColor: 'rgba(24, 18, 14, 0.52)',
          bottom: 0,
          left: 0,
          opacity: backdropOpacity,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      />
      {/* Sheet: only translateY animates */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            backgroundColor: '#FFFDFC',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '92%',
            overflow: 'hidden',
            transform: [{ translateY: sheetTranslateY }],
          }}>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xl * 2 }}>

              {/* Header */}
              <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
                  {isEditing ? 'Edit Item' : 'View Item'}
                </AppText>
                <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }}>
                  {!isEditing ? (
                    <>
                      <Pressable hitSlop={8} onPress={() => setIsEditing(true)}>
                        <Ionicons color={theme.colors.mutedText} name="pencil-outline" size={20} />
                      </Pressable>
                      <Pressable hitSlop={8} onPress={() => setConfirmDelete(true)}>
                        <Ionicons color="#D26A5C" name="trash-outline" size={20} />
                      </Pressable>
                    </>
                  ) : null}
                  {isEditing ? (
                    <Pressable hitSlop={8} onPress={() => { setIsEditing(false); setError(null); }}>
                      <AppText style={{ color: theme.colors.mutedText, fontSize: 15, fontFamily: theme.fonts.sans }}>Cancel</AppText>
                    </Pressable>
                  ) : (
                    <Pressable hitSlop={8} onPress={dismissAndClose}>
                      <Ionicons color={theme.colors.mutedText} name="close" size={22} />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Item image */}
              <View
                onLayout={(e) => setCellWidth(e.nativeEvent.layout.width)}
                style={{
                  height: 280,
                  backgroundColor: theme.colors.card,
                  borderRadius: 20,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {hasBoth && cellWidth > 0 ? (
                  <>
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={{ width: cellWidth, flex: 1 }}>
                      <Image contentFit="contain" source={{ uri: item!.sketchImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
                      <Image contentFit="contain" source={{ uri: item!.uploadedImageUrl! }} style={{ width: cellWidth, flex: 1 }} />
                    </ScrollView>
                    <View style={{ bottom: 10, flexDirection: 'row', gap: 5, position: 'absolute', alignSelf: 'center' }}>
                      <View style={{ backgroundColor: theme.colors.accent, borderRadius: 999, height: 6, width: 6, opacity: 0.9 }} />
                      <View style={{ backgroundColor: theme.colors.accent, borderRadius: 999, height: 6, width: 6, opacity: 0.45 }} />
                    </View>
                  </>
                ) : primaryUri ? (
                  <Image contentFit="contain" source={{ uri: primaryUri }} style={{ height: '100%', width: '100%' }} />
                ) : item?.sketchStatus === 'pending' ? (
                  <View style={{ alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons color={theme.colors.subtleText} name="time-outline" size={32} />
                    <AppText tone="muted" style={{ fontSize: 12, textAlign: 'center' }}>Sketch generating...</AppText>
                  </View>
                ) : (
                  <Ionicons color={theme.colors.subtleText} name="shirt-outline" size={40} />
                )}
              </View>

              {/* Anchor to Outfit button */}
              {!isEditing && !confirmDelete ? (
                <Pressable
                  onPress={handleAnchorToOutfit}
                  style={{
                    alignItems: 'center',
                    backgroundColor: theme.colors.accent,
                    borderRadius: 999,
                    flexDirection: 'row',
                    gap: spacing.sm,
                    justifyContent: 'center',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  }}>
                  <Ionicons color="#FFF" name="shirt-outline" size={16} />
                  <AppText variant="eyebrow" style={{ color: '#FFF', letterSpacing: 1.4 }}>
                    Anchor to Outfit
                  </AppText>
                </Pressable>
              ) : null}

              {/* Delete confirmation */}
              {confirmDelete ? (
                <View style={{ gap: spacing.md }}>
                  <View
                    style={{
                      backgroundColor: '#FDF2F0',
                      borderColor: '#D26A5C',
                      borderRadius: 16,
                      borderWidth: 1,
                      gap: spacing.xs,
                      padding: spacing.md,
                    }}>
                    <AppText variant="sectionTitle" style={{ color: '#C95F4A' }}>Remove from closet?</AppText>
                    <AppText tone="muted" style={{ fontSize: 13 }}>
                      This will permanently delete "{item?.title}" from your wardrobe.
                    </AppText>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <PrimaryButton label="Cancel" onPress={() => setConfirmDelete(false)} variant="secondary" style={{ flex: 1 }} />
                    <PrimaryButton
                      label={isDeleting ? 'Removing...' : 'Remove'}
                      onPress={() => void handleDelete()}
                      disabled={isDeleting}
                      style={{ flex: 1, backgroundColor: '#C95F4A' }}
                    />
                  </View>
                </View>

              ) : isEditing ? (
                /* Edit mode — text inputs */
                <View style={{ gap: spacing.md }}>
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Title</AppText>
                    <TextInput value={title} onChangeText={setTitle} returnKeyType="next" style={inputStyle} />
                  </View>
                  <View style={{ gap: spacing.xs }}>
                    <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Category</AppText>
                    <TextInput value={category} onChangeText={setCategory} returnKeyType="next" style={inputStyle} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Brand</AppText>
                      <TextInput value={brand} onChangeText={setBrand} returnKeyType="next" style={inputStyle} />
                    </View>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>Size</AppText>
                      <TextInput value={size} onChangeText={setSize} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} style={inputStyle} />
                    </View>
                  </View>
                  <FitStatusPicker value={fitStatus} onChange={setFitStatus} />
                  {error ? <AppText style={{ color: '#D26A5C', fontSize: 13 }}>{error}</AppText> : null}
                  <PrimaryButton
                    label={isSaving ? 'Saving...' : 'Save Changes'}
                    onPress={() => void handleSave()}
                    disabled={isSaving || !title.trim()}
                  />
                </View>

              ) : (
                /* View mode — plain labels */
                <View style={{ gap: spacing.md }}>
                  <LabelRow label="Title" value={item?.title} />
                  <LabelRow label="Category" value={item?.category} />
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}><LabelRow label="Brand" value={item?.brand || '—'} /></View>
                    <View style={{ flex: 1 }}><LabelRow label="Size" value={item?.size || '—'} /></View>
                  </View>
                  <LabelRow
                    label="How It Fits"
                    value={CLOSET_FIT_STATUS_OPTIONS.find((o) => o.value === item?.fitStatus)?.label || '—'}
                  />
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
    </Modal>
  );
}

function LabelRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.6 }}>{label}</AppText>
      <AppText style={{ fontSize: 15, color: theme.colors.text, fontFamily: theme.fonts.sans }}>{value ?? '—'}</AppText>
    </View>
  );
}

// ── Category filter modal ─────────────────────────────────────────────────────

type CategoryEntry = { label: string; count: number };

type CategoryFilterModalProps = {
  visible: boolean;
  categories: CategoryEntry[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  onClose: () => void;
};

function CategoryFilterModal({ visible, categories, selected, onSelect, onClose }: CategoryFilterModalProps) {
  const { height: screenHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const itemYOffsets = useRef<number[]>([]);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      const idx = selected === null ? 0 : (categories.findIndex((c) => c.label === selected) + 1);
      const y = itemYOffsets.current[idx] ?? 0;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.sm), animated: false });
    }, 50);
    return () => clearTimeout(timeout);
  }, [visible, selected, categories]);

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
        {/* Stop taps on the card from closing the modal */}
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: '#FFFDFC',
            borderRadius: 28,
            maxWidth: 420,
            overflow: 'hidden',
            width: '100%',
          }}>
          {/* Fixed header */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
            <AppText variant="eyebrow" style={{ color: theme.colors.mutedText, letterSpacing: 1.8 }}>
              Filter by Category
            </AppText>
          </View>

          {/* Scrollable category list — capped so it never overflows the screen */}
          <ScrollView
            ref={scrollRef}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: screenHeight * 0.52 }}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <Pressable
              onLayout={(e) => { itemYOffsets.current[0] = e.nativeEvent.layout.y; }}
              onPress={() => onSelect(null)}
              style={[filterRowStyle, !selected ? filterRowActiveStyle : null]}>
              <AppText variant="sectionTitle" style={!selected ? { color: theme.colors.accent } : undefined}>All Items</AppText>
              <AppText tone="muted">{categories.reduce((sum, c) => sum + c.count, 0)}</AppText>
            </Pressable>

            {categories.map((cat, idx) => (
              <Pressable
                key={cat.label}
                onLayout={(e) => { itemYOffsets.current[idx + 1] = e.nativeEvent.layout.y; }}
                onPress={() => onSelect(cat.label)}
                style={[filterRowStyle, selected === cat.label ? filterRowActiveStyle : null]}>
                <AppText variant="sectionTitle" style={selected === cat.label ? { color: theme.colors.accent } : undefined}>
                  {cat.label}
                </AppText>
                <AppText tone="muted">{cat.count}</AppText>
              </Pressable>
            ))}
          </ScrollView>

          {/* Fixed footer */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg }}>
            <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByCategory(items: ClosetItem[]): Record<string, ClosetItem[]> {
  const groups: Record<string, ClosetItem[]> = {};
  for (const item of items) {
    const cat = item.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
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

const filterRowActiveStyle = { borderColor: theme.colors.accent } as const;

const inputStyle = {
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.border,
  borderRadius: 14,
  borderWidth: 1,
  color: theme.colors.text,
  fontFamily: theme.fonts.sans,
  fontSize: 15,
  minHeight: 48,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
} as const;
