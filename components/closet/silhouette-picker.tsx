import { PillPicker } from '@/components/closet/pill-picker';
import { CLOSET_SILHOUETTE_OPTIONS, type ClosetItemSilhouette } from '@/types/closet';

type SilhouettePickerProps = {
  value: ClosetItemSilhouette | undefined;
  onChange: (value: ClosetItemSilhouette | undefined) => void;
};

export function SilhouettePicker({ value, onChange }: SilhouettePickerProps) {
  return <PillPicker label="Silhouette" options={CLOSET_SILHOUETTE_OPTIONS} value={value} onChange={onChange} />;
}
