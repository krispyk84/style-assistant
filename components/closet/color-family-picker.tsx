import { PillPicker } from '@/components/closet/pill-picker';
import { CLOSET_COLOR_FAMILY_OPTIONS, type ClosetItemColorFamily } from '@/types/closet';

type ColorFamilyPickerProps = {
  value: ClosetItemColorFamily | undefined;
  onChange: (value: ClosetItemColorFamily | undefined) => void;
};

export function ColorFamilyPicker({ value, onChange }: ColorFamilyPickerProps) {
  return <PillPicker label="Color Family" options={CLOSET_COLOR_FAMILY_OPTIONS} value={value} onChange={onChange} />;
}
