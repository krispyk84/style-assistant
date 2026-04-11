import type { WeatherSeason } from '@/types/weather';

export function buildStylingHint(temperatureC: number, season: WeatherSeason, summary: string): string {
  if (temperatureC <= 5 || season === 'winter') {
    return 'Lean into winter layers, warmer textures, and weather-ready shoes.';
  }

  if (temperatureC >= 25 || season === 'summer') {
    return 'Favor breathable fabrics, lighter colors, and warm-weather proportions.';
  }

  if (season === 'spring') {
    return 'Use transitional layers, lighter outerwear, and spring-friendly color contrast.';
  }

  if (season === 'fall') {
    return 'Use richer textures, layered depth, and cooler-weather tailoring.';
  }

  return `Dress for ${summary.toLowerCase()} conditions with practical seasonal layering.`;
}
