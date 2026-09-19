import type { StylistId } from '@/types/look-request';

export type { StylistId };

export type Stylist = {
  id: StylistId;
  name: string;
  title: string;
  keywords: string[];
  /** One-line styling point of view — used by the "Ask a Stylist" picker (StylistPicker), distinct from the keyword chips second-opinion's chooser uses. */
  description: string;
  image: number;
};

export const STYLISTS: Stylist[] = [
  {
    id: 'vittorio',
    name: 'Vittorio',
    title: 'Sartori',
    keywords: ['Refined', 'Classic', 'Elegant', 'Commanding'],
    description: 'Refined, tailored and timeless.',
    image: require('../assets/images/vittorio.png'),
  },
  {
    id: 'alessandra',
    name: 'Alessandra',
    title: 'Sartori',
    keywords: ['Cultural', 'Cool', 'Current', 'Social'],
    description: 'Current, expressive and a little unexpected.',
    image: require('../assets/images/alessandra.png'),
  },
];
