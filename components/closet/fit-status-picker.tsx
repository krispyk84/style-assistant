import { PillPicker } from '@/components/closet/pill-picker';
import { CLOSET_FIT_STATUS_OPTIONS, type ClosetItemFitStatus } from '@/types/closet';

type FitStatusPickerProps = {
  value: ClosetItemFitStatus | undefined;
  onChange: (value: ClosetItemFitStatus | undefined) => void;
};

export function FitStatusPicker({ value, onChange }: FitStatusPickerProps) {
  return <PillPicker label="Personal Fit" options={CLOSET_FIT_STATUS_OPTIONS} value={value} onChange={onChange} />;
}
