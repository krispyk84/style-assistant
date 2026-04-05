import { PillPicker } from '@/components/closet/pill-picker';
import { CLOSET_SEASON_OPTIONS } from '@/types/closet';

type SeasonPickerProps = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
};

export function SeasonPicker({ value, onChange }: SeasonPickerProps) {
  return <PillPicker label="Season" options={CLOSET_SEASON_OPTIONS} value={value} onChange={onChange} />;
}
