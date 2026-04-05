import { PillPicker } from '@/components/closet/pill-picker';
import { CLOSET_PATTERN_OPTIONS } from '@/types/closet';

type PatternPickerProps = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
};

export function PatternPicker({ value, onChange }: PatternPickerProps) {
  return <PillPicker label="Pattern" options={CLOSET_PATTERN_OPTIONS} value={value} onChange={onChange} />;
}
