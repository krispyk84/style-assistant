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
    keywords: ['Milanese tailoring', 'Restrained luxury', 'Silhouette precision'],
    image: require('../assets/images/vittorio.png'),
  },
  {
    id: 'alessandra',
    name: 'Alessandra',
    title: 'Sartori',
    keywords: ['Conceptual dressing', 'Bold silhouettes', 'Italian edge'],
    image: require('../assets/images/alessandra.png'),
  },
];
