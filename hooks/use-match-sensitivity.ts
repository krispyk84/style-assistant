import { useEffect, useState } from 'react';

import { loadAppSettings } from '@/lib/app-settings-storage';

/** Loads closetMatchSensitivity (0–100) from app settings once on mount. */
export function useMatchSensitivity(): number {
  const [sensitivity, setSensitivity] = useState(50);

  useEffect(() => {
    void loadAppSettings().then((s) => setSensitivity(s.closetMatchSensitivity));
  }, []);

  return sensitivity;
}
