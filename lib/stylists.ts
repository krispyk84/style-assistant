export type StylistId = 'vittorio' | 'alessandra';

export type Stylist = {
  id: StylistId;
  name: string;
  title: string;
  keywords: string[];
  image: number;
};

export const STYLISTS: Stylist[] = [
  {
    id: 'vittorio',
    name: 'Vittorio',
    title: 'Sartori',
    keywords: ['Refined', 'Classic', 'Elegant', 'Commanding'],
    image: require('../assets/images/vittorio.png'),
  },
  {
    id: 'alessandra',
    name: 'Alessandra',
    title: 'Sartori',
    keywords: ['Cultural', 'Cool', 'Current', 'Social'],
    image: require('../assets/images/alessandra.png'),
  },
];
