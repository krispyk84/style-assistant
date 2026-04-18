/**
 * AppIcon — unified Streamline icon component for the whole app.
 *
 * All icons are from the Streamline 3.0 free set (CC-BY-4.0).
 * ViewBox: 0 0 14 14. SVG paths are embedded directly — no runtime JSON parsing.
 *
 * Usage:
 *   <AppIcon name="home" size={22} color={theme.colors.text} />
 *   <AppIcon name="chevron-left" size={20} strokeWidth={1.5} />
 */

import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { theme as staticTheme } from '@/constants/theme';

// ── Icon name catalogue ──────────────────────────────────────────────────────

export type AppIconName =
  // Navigation & tabs
  | 'home' | 'calendar' | 'person' | 'closet' | 'settings'
  | 'chevron-left' | 'chevron-right' | 'chevron-up' | 'chevron-down'
  | 'arrow-left' | 'arrow-right'
  // Actions
  | 'close' | 'add' | 'add-circle' | 'trash' | 'bookmark' | 'pencil'
  | 'camera' | 'camera-flip' | 'upload' | 'image' | 'archive' | 'refresh'
  // Feedback
  | 'heart' | 'thumbs-up' | 'thumbs-down' | 'star'
  // State / validation
  | 'check' | 'check-circle' | 'circle'
  // Auth
  | 'apple' | 'google'
  // AI / special
  | 'magic-wand' | 'sparkles'
  // Utility
  | 'eye' | 'eye-off' | 'layers' | 'clock' | 'warning' | 'tag'
  | 'chat' | 'search' | 'briefcase' | 'coffee' | 'swap'
  // Weather
  | 'sun' | 'partly-cloudy' | 'cloud' | 'cloud-rain' | 'snow'
  | 'thunderstorm' | 'wind'
  // Closet-specific
  | 'shirt'
  // Informational
  | 'info'
  // More / navigation
  | 'more-horizontal' | 'suitcase' | 'log-out'
  // Tab-specific Streamline icons
  | 'clothes-pattern' | 'nav-menu-vertical'

// ── Shared stroke shorthand ──────────────────────────────────────────────────

const S = {
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// ── Icon render map ──────────────────────────────────────────────────────────
//
// Each entry is a function (color, strokeWidth) => ReactNode rendered
// inside a 14×14 viewBox SVG.
//
// Streamline 3.0 free set, CC-BY-4.0. See @iconify-json/streamline for data.

type Render = (c: string, sw: number) => React.ReactNode;

const ICONS: Record<AppIconName, Render> = {
  // ── Tabs ─────────────────────────────────────────────────────────────────

  home: (c, sw) => (
    // home-3 — house with centre line for door
    <Path
      d="M13.5 6.94a1 1 0 0 0-.32-.74L7 .5L.82 6.2a1 1 0 0 0-.32.74v5.56a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1zM7 13.5v-4"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  calendar: (c, sw) => (
    // blank-calendar — calendar grid
    <Path
      d="M1.5 2a1 1 0 0 0-1 1v9.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-2M.5 5.5h13m-10-5v3m7-3v3M3.5 2h5"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  person: (c, sw) => (
    // person — circle head + shoulder arc
    <G {...S} stroke={c} strokeWidth={sw}>
      <Circle cx={7} cy={3.75} r={3.25} />
      <Path d="M13.18 13.5a6.49 6.49 0 0 0-12.36 0Z" />
    </G>
  ),

  closet: (c, sw) => (
    // closet — wardrobe with two doors + handles
    <Path
      d="M11.5.5h-9a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1M7 .5v13m2.5-7v1m-5-1v1"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  settings: (c, sw) => (
    // horizontal sliders (3 faders) — editorial, modern
    <G {...S} stroke={c} strokeWidth={sw}>
      <Circle cx={2} cy={2} r={1.5} />
      <Path d="M3.5 2h10" />
      <Circle cx={7} cy={7} r={1.5} />
      <Path d="M.5 7h5m3 0h5" />
      <Circle cx={12} cy={12} r={1.5} />
      <Path d="M10.5 12H.5" />
    </G>
  ),

  // ── Navigation arrows / chevrons ─────────────────────────────────────────

  'chevron-left': (c, sw) => (
    // clean chevron left
    <Path
      d="M10.15.5L4 6.65a.48.48 0 0 0 0 .7l6.15 6.15"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'chevron-right': (c, sw) => (
    <Path
      d="M3.85.5L10 6.65a.48.48 0 0 1 0 .7L3.85 13.5"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'chevron-up': (c, sw) => (
    <Path
      d="M.5 10.15L6.65 4a.48.48 0 0 1 .7 0l6.15 6.15"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'chevron-down': (c, sw) => (
    <Path
      d="M.5 3.85L6.65 10a.48.48 0 0 0 .7 0l6.15-6.15"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'arrow-left': (c, sw) => (
    // full arrow with horizontal bar
    <Path
      d="M13.5 7H.5M4 3.5L.5 7L4 10.5"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'arrow-right': (c, sw) => (
    <Path
      d="M.5 7h13M10 10.5L13.5 7L10 3.5"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  // ── Actions ───────────────────────────────────────────────────────────────

  close: (c, sw) => (
    // clean X (delete-1)
    <Path
      d="m13.5.5l-13 13m0-13l13 13"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  add: (c, sw) => (
    // plus sign (add-1)
    <Path
      d="M7 .5v13M.5 6.96h13"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'add-circle': (c, sw) => (
    // plus in circle
    <Path
      d="M7 13.5a6.5 6.5 0 1 0 0-13a6.5 6.5 0 0 0 0 13M7 4v6M4 7h6"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  trash: (c, sw) => (
    // bin with lid
    <Path
      d="m11.5 5.5l-1 8h-7l-1-8M1 3.5h12m-8.54-.29V1.48a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  bookmark: (c, sw) => (
    <Path
      d="m11 13.5l-4-4l-4 4v-12a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  pencil: (c, sw) => (
    <Path
      d="M5 12.24L.5 13.5L1.76 9L10 .8a1 1 0 0 1 1.43 0l1.77 1.78a1 1 0 0 1 0 1.42z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  camera: (c, sw) => (
    // camera body + circle lens
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M13.5 5a1 1 0 0 0-1-1h-2L9 2H5L3.5 4h-2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1z" />
      <Circle cx={7} cy={7.5} r={2.25} />
    </G>
  ),

  'camera-flip': (c, sw) => (
    // phone/camera flip icon
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M7 3.5A.25.25 0 0 1 7 3m0 .5A.25.25 0 0 0 7 3" />
      <Path d="M10.5.5h-7a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1" />
    </G>
  ),

  upload: (c, sw) => (
    // upload circle — arrow up inside circle
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="m4 7l3-3.5L10 7M7 3.5v7" />
      <Path d="M7 13.5a6.5 6.5 0 1 0 0-13a6.5 6.5 0 0 0 0 13" />
    </G>
  ),

  image: (c, sw) => (
    // photo/image with lens circle
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M13.5 5a1 1 0 0 0-1-1h-2L9 2H5L3.5 4h-2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1Z" />
      <Circle cx={7} cy={7.5} r={2.25} />
    </G>
  ),

  archive: (c, sw) => (
    // archive box
    <Path
      d="M1.5 5h11v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1zm12-1V2a1 1 0 0 0-1-1h-11a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1m-8 4h3"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  refresh: (c, sw) => (
    // two-arrow reload (horizontal)
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M9 .5L11.5 3L9 5.5" />
      <Path d="M.5 6V4a1 1 0 0 1 1-1h10M5 13.5L2.5 11L5 8.5" />
      <Path d="M13.5 8v2a1 1 0 0 1-1 1h-10" />
    </G>
  ),

  swap: (c, sw) => (
    // bidirectional horizontal swap
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M9.25 8.5L7 10.75L9.25 13m-4.5-7.5L7 3.25L4.75 1" />
      <Path d="M7 10.75h4.5a2 2 0 0 0 2-2v-3.5a2 2 0 0 0-2-2H10m-3 0H2.5a2 2 0 0 0-2 2v3.5a2 2 0 0 0 2 2H4" />
    </G>
  ),

  // ── Feedback ─────────────────────────────────────────────────────────────

  heart: (c, sw) => (
    <Path
      d="M7.004 12.383L1.53 7.424c-2.975-2.975 1.398-8.688 5.474-4.066c4.076-4.622 8.43 1.11 5.475 4.066z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'thumbs-up': (c, sw) => (
    // thumbs up
    <Path
      d="m3.37 5.85l2.54-4.06a1.09 1.09 0 0 1 .94-.52h0A1.11 1.11 0 0 1 8 2.37v2.91h4.39a1.15 1.15 0 0 1 1.1 1.32l-.8 5.16a1.14 1.14 0 0 1-1.13 1H5a2 2 0 0 1-.9-.21l-.72-.36m-.01-6.34v6.31M1 5.85h2.37v6.31h0H1a.5.5 0 0 1-.5-.5V6.35a.5.5 0 0 1 .5-.5Z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'thumbs-down': (c, sw) => (
    // thumbs down
    <Path
      d="m3.37 8.15l2.54 4.06a1.09 1.09 0 0 0 .94.52h0A1.11 1.11 0 0 0 8 11.63V8.72h4.39a1.15 1.15 0 0 0 1.1-1.32l-.8-5.16a1.14 1.14 0 0 0-1.13-1H5a2 2 0 0 0-.9.21l-.72.36m-.01 6.34V1.84M1 1.84h2.37v6.31h0H1a.5.5 0 0 1-.5-.5V2.34a.5.5 0 0 1 .5-.5Z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  star: (c, sw) => (
    <Path
      d="M7.49 1.09L9.08 4.3a.51.51 0 0 0 .41.3l3.51.52a.54.54 0 0 1 .3.93l-2.53 2.51a.53.53 0 0 0-.16.48l.61 3.53a.55.55 0 0 1-.8.58l-3.16-1.67a.59.59 0 0 0-.52 0l-3.16 1.67a.55.55 0 0 1-.8-.58L3.39 9a.53.53 0 0 0-.16-.48L.7 5.99a.54.54 0 0 1 .3-.93l3.51-.52a.51.51 0 0 0 .41-.3z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  // ── State / validation ────────────────────────────────────────────────────

  check: (c, sw) => (
    <Path
      d="m.5 8.55l2.73 3.51a1 1 0 0 0 1.56.03L13.5 1.55"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'check-circle': (c, sw) => (
    // check inside circle
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="m4 8l2.05 1.64a.48.48 0 0 0 .4.1a.5.5 0 0 0 .34-.24L10 4" />
      <Circle cx={7} cy={7} r={6.5} />
    </G>
  ),

  circle: (c, sw) => (
    // hollow circle — used for unselected indicators
    <Circle cx={7} cy={7} r={6.5} {...S} stroke={c} strokeWidth={sw} />
  ),

  // ── Auth ──────────────────────────────────────────────────────────────────

  apple: (c, sw) => (
    <Path
      d="M10.182 7.49a2.49 2.49 0 0 1 1.737-2.366a2.906 2.906 0 0 0-4.214-.999a1 1 0 0 1-.999 0a3.086 3.086 0 0 0-4.404 1.208a5.12 5.12 0 0 0-.54 3.356A7.24 7.24 0 0 0 3.2 11.8c.51.7 1.02 1.2 1.68 1.2s.84-.28 1.44-.28s.78.28 1.44.28s1.16-.5 1.68-1.2A7.24 7.24 0 0 0 10.88 9.5a2.49 2.49 0 0 1-.698-2.01M8.5 2.5a2.5 2.5 0 0 0-2 2.5"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  google: (c, sw) => (
    <Path
      d="M11.36 5.83H7.87a.51.51 0 0 0-.51.52v1.41a.51.51 0 0 0 .51.51h2.29a2.75 2.75 0 0 1-3 2.79c-2.24 0-3.32-1.9-3.32-4.06S5 2.94 7.16 2.94a4.07 4.07 0 0 1 2.64.86a.4.4 0 0 0 .52 0L11.5 2.6a.38.38 0 0 0 0-.55A6.52 6.52 0 0 0 7.16 1a6 6 0 1 0 4.2 10.3a5.5 5.5 0 0 0 1.59-3.91a5.2 5.2 0 0 0-.12-1.11a.52.52 0 0 0-.47-.45z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  // ── AI / Special ──────────────────────────────────────────────────────────

  'magic-wand': (c, sw) => (
    // magic wand with star sparkles
    <Path
      d="m12.64 1.87l-.84 2.48a.41.41 0 0 0 0 .37l1.57 2.1a.4.4 0 0 1-.33.64h-2.62a.43.43 0 0 0-.33.17l-1.46 2.1a.4.4 0 0 1-.71-.11l-.78-2.5a.38.38 0 0 0-.26-.26l-2.5-.78a.4.4 0 0 1-.11-.71l2.14-1.51a.43.43 0 0 0 .17-.33V.79a.4.4 0 0 1 .64-.33l2.1 1.57a.41.41 0 0 0 .37 0l2.48-.84a.4.4 0 0 1 .46.68M.5 13.5l5.18-5.19"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  sparkles: (c, sw) => (
    // AI edit spark — wand + sparkles
    <Path
      d="m6.926 13.202l-3 .26l.26-3l6.24-6.2a1 1 0 0 1 1.43 0l1.27 1.28a1 1 0 0 1 0 1.42zM.842 3.972c-.351-.061-.351-.565 0-.626A3.18 3.18 0 0 0 3.4.896l.021-.097c.076-.346.57-.349.65-.002l.025.112A3.19 3.19 0 0 0 6.66 3.351c.351.061.351.565 0 .626A3.19 3.19 0 0 0 4.096 6.42l-.025.112c-.08.347-.574.344-.65-.002L3.4 6.43A3.18 3.18 0 0 0 .842 3.972z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  // ── Utility ───────────────────────────────────────────────────────────────

  eye: (c, sw) => (
    // eye open
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M13.23 6.33a1 1 0 0 1 0 1.34C12.18 8.8 9.79 11 7 11S1.82 8.8.77 7.67a1 1 0 0 1 0-1.34C1.82 5.2 4.21 3 7 3s5.18 2.2 6.23 3.33Z" />
      <Circle cx={7} cy={7} r={2} />
    </G>
  ),

  'eye-off': (c, sw) => (
    // eye with diagonal slash
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M3.63 3.624C4.621 2.98 5.771 2.5 7 2.5c2.79 0 5.18 2.475 6.23 3.746c.166.207.258.476.258.754s-.092.547-.258.754c-.579.7-1.565 1.767-2.8 2.583m-1.93.933c-.482.146-.984.23-1.5.23c-2.79 0-5.18-2.475-6.23-3.746C.604 7.547.512 7.279.512 7s.092-.547.258-.754c.333-.402.8-.926 1.372-1.454" />
      <Path d="M8.414 8.414a2 2 0 0 0-2.828-2.828M13.5 13.5L.5.5" />
    </G>
  ),

  layers: (c, sw) => (
    // stacked layers — used for outfit tiers
    <Path
      d="M7.47 6.9a1.18 1.18 0 0 1-.94 0L.83 4.26a.56.56 0 0 1 0-1L6.53.6a1.18 1.18 0 0 1 .94 0l5.7 2.64a.56.56 0 0 1 0 1Zm6.03.45l-6.1 2.81a1 1 0 0 1-.83 0L.5 7.35m13 3.25l-6.1 2.81a1 1 0 0 1-.83 0L.5 10.6"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  clock: (c, sw) => (
    // alarm clock
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M7 13.5a5.5 5.5 0 1 0 0-11a5.5 5.5 0 0 0 0 11M.5 2.5A8.7 8.7 0 0 1 3 .5m10.5 2a8.7 8.7 0 0 0-2.5-2" />
      <Path d="M7 5v3h2.5" />
    </G>
  ),

  warning: (c, sw) => (
    // warning triangle with exclamation
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M7.89 1.05a1 1 0 0 0-1.78 0l-5.5 11a1 1 0 0 0 .89 1.45h11a1 1 0 0 0 .89-1.45zM7 5v3.25" />
      <Path d="M7 11a.25.25 0 1 1 0-.5m0 .5a.25.25 0 1 0 0-.5" />
    </G>
  ),

  tag: (c, sw) => (
    // price tag (rotated bookmark-tag)
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="m13.28 9.39l-3.89 3.89a.75.75 0 0 1-1.06 0L.61 5.56a.36.36 0 0 1-.11-.29l.59-3.83a.37.37 0 0 1 .35-.35L5.27.5a.36.36 0 0 1 .29.11l7.72 7.72a.75.75 0 0 1 0 1.06z" />
      <Circle cx={3.5} cy={3.5} r={0.75} fill={c} stroke={c} strokeWidth={0} />
    </G>
  ),

  chat: (c, sw) => (
    // speech bubble oval
    <Path
      d="M4.145 12.84a6.5 6.5 0 1 0-2.556-2.238m2.556 2.239L.5 13.5l1.089-2.897m2.556 2.238l.005-.001m-2.561-2.237l.001-.003"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  search: (c, sw) => (
    // magnifying glass
    <G {...S} stroke={c} strokeWidth={sw}>
      <Circle cx={5.92} cy={5.92} r={5.42} />
      <Path d="M13.5 13.5L9.75 9.75" />
    </G>
  ),

  briefcase: (c, sw) => (
    // briefcase (rect body + handle, no dollar sign)
    <G {...S} stroke={c} strokeWidth={sw}>
      <Rect x={0.5} y={3.5} width={13} height={10} rx={1} />
      <Path d="M5 .5h4a1 1 0 0 1 1 1v2h0h-6h0v-2a1 1 0 0 1 1-1ZM3.5 7h7m-7 3h7" />
    </G>
  ),

  coffee: (c, sw) => (
    // coffee mug
    <Path
      d="M3 5.5h5a1 1 0 0 1 1 1v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5a1 1 0 0 1 1-1m6 1h.5a2.5 2.5 0 0 1 0 5H9M4 .5v2m3-2v2"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  // ── Closet-specific ───────────────────────────────────────────────────────

  shirt: (c, sw) => (
    // wardrobe/closet (same as 'closet' — used as clothing placeholder)
    <Path
      d="M11.5.5h-9a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1M7 .5v13m2.5-7v1m-5-1v1"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  // ── Weather ───────────────────────────────────────────────────────────────

  sun: (c, sw) => (
    // sun with rays
    <G {...S} stroke={c} strokeWidth={sw}>
      <Circle cx={7} cy={7} r={2.5} />
      <Path d="m13.5 7l-2.34 1.72l.44 2.88l-2.88-.44L7 13.5l-1.72-2.34l-2.88.44l.44-2.88L.5 7l2.34-1.72L2.4 2.4l2.88.44L7 .5l1.72 2.34l2.88-.44l-.44 2.88L13.5 7z" />
    </G>
  ),

  'partly-cloudy': (c, sw) => (
    // sun with cloud
    <Path
      d="M9 1.93a3 3 0 0 1 4.5 2.57a3.12 3.12 0 0 1-.21 1.11m-2.317 1.56a3.421 3.421 0 0 0-.46 0a3.43 3.43 0 0 0-6.71 0c-.15-.01-.3-.01-.45 0a2.67 2.67 0 1 0 0 5.33h7.62a2.67 2.67 0 0 0 0-5.33v0Z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  cloud: (c, sw) => (
    // cloud
    <Path
      d="M11 6.5a2.5 2.5 0 0 0-1.5.5A4.5 4.5 0 1 0 5 11.5h6a2.5 2.5 0 0 0 0-5"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'cloud-rain': (c, sw) => (
    // rain cloud with drops
    <Path
      d="m4 11.5l.5-1m4 1l.5-1m-3.25 3l.5-1m-5 1l.5-1m8.5 1l.5-1m-.5-4.5a2.5 2.5 0 0 0 0-5a2.54 2.54 0 0 0-1.57.55A3.75 3.75 0 1 0 5 8z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  snow: (c, sw) => (
    // snowflake
    <Path
      d="m5 .5l2 2l2-2M.5 9l2-2l-2-2M9 13.5l-2-2l-2 2M13.5 5l-2 2l2 2m-10-5.5L5 5m0 4l-1.5 1.5m7-7L9 5m0 4l1.5 1.5M7 2.5v9M2.5 7h9"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  thunderstorm: (c, sw) => (
    // lightning cloud
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M8.5 7L6 10.5h3l-2 3" />
      <Path d="M11 8a2.5 2.5 0 1 0-.62-4.92a3.5 3.5 0 0 0-6.76 0A2.5 2.5 0 1 0 3 8h1.5" />
    </G>
  ),

  wind: (c, sw) => (
    // wind lines
    <Path
      d="M7.5.5a1.75 1.75 0 0 1 0 3.5h-7m11.25 6.5a1.75 1.75 0 0 0 0-3.5H2m5.25 6.5a1.75 1.75 0 0 0 0-3.5H1.5"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  info: (c, sw) => (
    // info circle with dot and vertical bar
    <G {...S} stroke={c} strokeWidth={sw}>
      <Circle cx={7} cy={7} r={6.5} />
      <Path d="M7 6.5v4" />
      <Circle cx={7} cy={4.25} r={0.5} fill={c} stroke={c} strokeWidth={0} />
    </G>
  ),

  'more-horizontal': (c) => (
    // three filled horizontal dots
    <G>
      <Circle cx={2} cy={7} r={1.25} fill={c} />
      <Circle cx={7} cy={7} r={1.25} fill={c} />
      <Circle cx={12} cy={7} r={1.25} fill={c} />
    </G>
  ),

  suitcase: (c, sw) => (
    // travel suitcase — rect body + handle arc + horizontal divider
    <G {...S} stroke={c} strokeWidth={sw}>
      <Rect x={1} y={4.5} width={12} height={9} rx={1} />
      <Path d="M4.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
      <Path d="M1 8.5h12" />
    </G>
  ),

  'log-out': (c, sw) => (
    // door frame + arrow pointing right
    <G {...S} stroke={c} strokeWidth={sw}>
      <Path d="M5.5 13.5H2a1 1 0 0 1-1-1V1.5A1 1 0 0 1 2 .5h3.5" />
      <Path d="M9.5 10.5L13.5 7l-4-3.5" />
      <Path d="M5.5 7h8" />
    </G>
  ),

  'clothes-pattern': (c, sw) => (
    // T-shirt silhouette — Streamline shopping-categories-shirt
    <Path
      d="M10.5 1.5l3 3l-2 2l-1-1v6a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-6l-1 1l-2-2l3-3Z"
      {...S} stroke={c} strokeWidth={sw}
    />
  ),

  'nav-menu-vertical': (c) => (
    // Three vertical dots — Navigation Menu Vertical 2
    <G>
      <Circle cx={7} cy={2} r={1.5} fill={c} />
      <Circle cx={7} cy={7} r={1.5} fill={c} />
      <Circle cx={7} cy={12} r={1.5} fill={c} />
    </G>
  ),
};

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  name: AppIconName;
  size?: number;
  color?: string;
  /** Stroke width. Default 1.25 — matches Streamline's editorial line weight at typical sizes. */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function AppIcon({
  name,
  size = 20,
  color = staticTheme.colors.text,
  strokeWidth = 1.25,
  style,
  accessibilityLabel,
}: Props) {
  const render = ICONS[name];

  return (
    <View
      style={style}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 14 14">
        {render(color, strokeWidth)}
      </Svg>
    </View>
  );
}

// ── Weather helper ────────────────────────────────────────────────────────────

/**
 * Maps a WMO weather code to an AppIconName.
 * Replaces the Ionicons-based weatherIconName in lib/outfit-utils.ts.
 */
export function weatherIcon(code: number): AppIconName {
  if (code === 0) return 'sun';
  if ([1, 2, 3].includes(code)) return 'partly-cloudy';
  if ([45, 48].includes(code)) return 'cloud';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'cloud-rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  return 'cloud';
}
