import { useState } from 'react';

import type { LookTierSlug } from '@/types/look-request';

export function useGenerateOutfits() {
  const [isOpen, setIsOpen] = useState(false);
  const [formality, setFormality] = useState<LookTierSlug>('smart-casual');

  function open() {
    setFormality('smart-casual');
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

  return { isOpen, open, close, formality, setFormality };
}
