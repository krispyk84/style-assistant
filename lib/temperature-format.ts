import type { TemperatureUnit } from '@/types/profile';

function toFahrenheit(celsius: number) {
  return (celsius * 9) / 5 + 32;
}

export function formatTemperature(valueC: number, unit: TemperatureUnit) {
  const value = unit === 'fahrenheit' ? toFahrenheit(valueC) : valueC;
  return `${Math.round(value)}°${unit === 'fahrenheit' ? 'F' : 'C'}`;
}

export function formatTemperatureRange(highC: number, lowC: number, unit: TemperatureUnit) {
  return `${formatTemperature(highC, unit)} / ${formatTemperature(lowC, unit)}`;
}
