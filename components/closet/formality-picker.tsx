import { PillPicker } from '@/components/closet/pill-picker';
import { CLOSET_FORMALITY_OPTIONS } from '@/types/closet';

type FormalityPickerProps = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
};

export function FormalityPicker({ value, onChange }: FormalityPickerProps) {
  return <PillPicker label="Formality" options={CLOSET_FORMALITY_OPTIONS} value={value} onChange={onChange} />;
}
