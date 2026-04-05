import { PillPicker } from '@/components/closet/pill-picker';
import { CLOSET_WEIGHT_OPTIONS } from '@/types/closet';

type WeightPickerProps = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
};

export function WeightPicker({ value, onChange }: WeightPickerProps) {
  return <PillPicker label="Weight" options={CLOSET_WEIGHT_OPTIONS} value={value} onChange={onChange} />;
}
