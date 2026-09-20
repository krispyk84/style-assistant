import { useCallback, useEffect, useState } from 'react';

import { fragrancesService } from '@/services/fragrances';
import type { UserFragrance } from '@/types/fragrance';

export function useFragranceClosetData() {
  const [items, setItems] = useState<UserFragrance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    const response = await fragrancesService.listUserFragrances();
    if (response.success && response.data) {
      setItems(response.data.fragrances);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return { items, setItems, isLoading, loadItems };
}
