import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { closetService } from '@/services/closet';
import type { ClosetItem } from '@/types/closet';
import {
  buildCategories, chunkIntoRows, groupByCategory,
  type ClosetSection,
} from './closet-grid-utils';

const POLL_INTERVAL_MS = 5000;

export function useClosetData() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Only the genuinely first load shows the full loading bar — a refocus
  // with data already on screen refreshes silently in the background so
  // switching back into this tab never flickers back to a loading state.
  const hasLoadedOnceRef = useRef(false);

  const loadItems = useCallback(async () => {
    try {
      const response = await closetService.getItems();
      if (response.success && response.data) {
        setItems(response.data.items);
      }
    } finally {
      setIsLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, []);

  // Fires once as soon as this screen mounts — paired with the Tabs
  // navigator's lazy:false, every tab mounts immediately at app start, so
  // this starts loading in the background well before the user actually
  // switches to Closet. By the time they tap the tab, the data is usually
  // already there instead of popping in after the switch.
  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) setIsLoading(true);
      void loadItems();
    }, [loadItems]),
  );

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

  // Memoised derived state — computed once per items change, not on every render
  const categories = useMemo(() => buildCategories(items), [items]);
  const sections = useMemo((): ClosetSection[] => {
    const grouped = groupByCategory(items);
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((cat) => ({ title: cat, data: chunkIntoRows(grouped[cat]!) }));
  }, [items]);

  return {
    items,
    setItems,
    isLoading,
    loadItems,
    categories,
    sections,
  };
}
