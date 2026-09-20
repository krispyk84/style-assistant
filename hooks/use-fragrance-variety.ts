import { useEffect, useState } from 'react';

import { loadAppSettings } from '@/lib/app-settings-storage';

/** Loads fragranceVariety (0–100) from app settings once on mount. */
export function useFragranceVariety(): number {
  const [fragranceVariety, setFragranceVariety] = useState(50);

  useEffect(() => {
    void loadAppSettings().then((s) => setFragranceVariety(s.fragranceVariety));
  }, []);

  return fragranceVariety;
}
