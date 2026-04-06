import { type ReactNode } from 'react';
import { type ImageSourcePropType, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { SelectorCard } from '@/components/ui/selector-card';

export type SelectorOption<T extends string> = {
  value: T;
  label?: string;
  image?: ImageSourcePropType;
  thumbnailContent?: ReactNode;
};

type SelectorGridProps<T extends string> = {
  options: readonly T[] | SelectorOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  thumbnailHeight?: number;
};

const GAP = spacing.sm;

export function SelectorGrid<T extends string>({
  options,
  value,
  onChange,
  thumbnailHeight,
}: SelectorGridProps<T>) {
  const normalized: SelectorOption<T>[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt as T } : (opt as SelectorOption<T>)
  );

  // Split into rows of 2
  const rows: SelectorOption<T>[][] = [];
  for (let i = 0; i < normalized.length; i += 2) {
    rows.push(normalized.slice(i, i + 2));
  }

  return (
    <View style={{ gap: GAP }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: GAP }}>
          {row.map((option) => (
            <SelectorCard
              key={option.value}
              label={option.label ?? option.value}
              selected={value === option.value}
              onPress={() => onChange(option.value)}
              image={option.image}
              thumbnailContent={option.thumbnailContent}
              thumbnailHeight={thumbnailHeight}
            />
          ))}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}
