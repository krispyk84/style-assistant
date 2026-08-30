import { spacing } from '@/constants/theme';

// Shared between HomeScreen's header (which actually renders the logo at
// this size/position) and the root layout's splash-to-Home shrink transition
// (which needs to know exactly where to land without depending on a runtime
// cross-component measurement, which proved unreliable — the target now
// matches HomeScreen's layout by construction instead of by measuring it).
export const HOME_HEADER_LOGO_RECT_CONSTANTS = {
  width: 78,
  height: 32,
  /** Height of the header row the logo is vertically centered within. */
  rowHeight: 40,
  /** Matches AppScreen's default topInset content padding (paddingTop: spacing.md). */
  topPadding: spacing.md,
} as const;
