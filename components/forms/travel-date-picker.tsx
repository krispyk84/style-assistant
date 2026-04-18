import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

// ── Constants ────────────────────────────────────────────────────────────────

const CELL_HEIGHT = 42;
const CIRCLE_SIZE = 36;
// Vertical offset so the range bar is centred in the cell
const BAR_TOP = (CELL_HEIGHT - CIRCLE_SIZE) / 2;

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ── Pure helpers ─────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function buildCalendarWeeks(year: number, month: number): (number | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay(); // 0 = Sunday
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, wi) =>
    cells.slice(wi * 7, wi * 7 + 7)
  );
}

function nightsLabel(dep: Date, ret: Date): string {
  const nights = Math.round((ret.getTime() - dep.getTime()) / 86_400_000);
  if (nights === 0) return 'Same-day trip';
  return nights === 1 ? '1 night' : `${nights} nights`;
}

// ── Types ────────────────────────────────────────────────────────────────────

type SelectionMode = 'departure' | 'return';

type Props = {
  departureDate: Date | null;
  returnDate: Date | null;
  onDepartureChange: (date: Date | null) => void;
  onReturnChange: (date: Date | null) => void;
};

// ── Component ────────────────────────────────────────────────────────────────

export function TravelDatePicker({ departureDate, returnDate, onDepartureChange, onReturnChange }: Props) {
  const { theme } = useTheme();

  const [today] = useState(() => startOfDay(new Date()));
  const [viewYear, setViewYear] = useState(() => (departureDate ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (departureDate ?? today).getMonth());
  const [mode, setMode] = useState<SelectionMode>(() => (departureDate ? 'return' : 'departure'));
  const [isOpen, setIsOpen] = useState(() => !departureDate || !returnDate);

  const dep = departureDate ? startOfDay(departureDate) : null;
  const ret = returnDate ? startOfDay(returnDate) : null;
  const hasBothEnds = dep !== null && ret !== null;
  const isSameDay = hasBothEnds && dep.getTime() === ret.getTime();

  const rangeHighlight = theme.dark ? 'rgba(165,106,31,0.22)' : 'rgba(165,106,31,0.11)';
  const weeks = useMemo(() => buildCalendarWeeks(viewYear, viewMonth), [viewYear, viewMonth]);

  const isDepartureActive = isOpen && mode === 'departure';
  const isReturnActive = isOpen && mode === 'return';

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openFor(m: SelectionMode) {
    // Don't enter return mode without a departure — redirect user to departure first.
    if (m === 'return' && dep === null) {
      setMode('departure');
      setIsOpen(true);
      return;
    }
    setMode(m);
    setIsOpen(true);
    // Navigate calendar to the relevant month.
    const anchor = m === 'departure' ? dep ?? today : dep ?? today;
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth());
  }

  function handleDayPress(date: Date) {
    if (mode === 'departure') {
      onDepartureChange(date);
      // If current return is now before new departure, clear it.
      if (ret !== null && date > ret) onReturnChange(null);
      setMode('return');
    } else {
      onReturnChange(date);
      setIsOpen(false);
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // ── Day cell renderer ──────────────────────────────────────────────────────

  function renderDayCell(day: number | null, wi: number, di: number) {
    if (day === null) {
      return <View key={`e-${wi}-${di}`} style={{ flex: 1, height: CELL_HEIGHT }} />;
    }

    const cellDate = startOfDay(new Date(viewYear, viewMonth, day));
    const ts = cellDate.getTime();

    const isToday = ts === today.getTime();
    const isDep = dep !== null && ts === dep.getTime();
    const isRet = ret !== null && ts === ret.getTime();
    const isSelected = isDep || isRet;
    const isInRange = hasBothEnds && !isSameDay && cellDate > dep! && cellDate < ret!;

    const isPast = cellDate < today;
    const isDisabled = mode === 'departure'
      ? isPast
      : dep === null || cellDate < dep;

    // Range bar halves: left half coloured for in-range or return day; right half for in-range or departure day.
    const leftBar = hasBothEnds && !isSameDay && (isInRange || isRet);
    const rightBar = hasBothEnds && !isSameDay && (isInRange || isDep);

    const circleColor = isSelected
      ? theme.colors.text
      : isToday
      ? theme.colors.card
      : 'transparent';

    const textColor = isSelected
      ? theme.colors.inverseText
      : isDisabled
      ? theme.colors.border
      : theme.colors.text;

    return (
      <View
        key={`d-${wi}-${di}`}
        style={{ flex: 1, height: CELL_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
        {/* Range bar — left half */}
        {leftBar ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              width: '50%',
              top: BAR_TOP,
              height: CIRCLE_SIZE,
              backgroundColor: rangeHighlight,
            }}
          />
        ) : null}
        {/* Range bar — right half */}
        {rightBar ? (
          <View
            style={{
              position: 'absolute',
              right: 0,
              width: '50%',
              top: BAR_TOP,
              height: CIRCLE_SIZE,
              backgroundColor: rangeHighlight,
            }}
          />
        ) : null}
        {/* Day circle */}
        <Pressable
          disabled={isDisabled}
          hitSlop={4}
          onPress={() => handleDayPress(cellDate)}
          style={{
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: CIRCLE_SIZE / 2,
            backgroundColor: circleColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppText
            style={{
              fontSize: 13,
              color: textColor,
              fontFamily: isSelected ? theme.fonts.sansMedium : theme.fonts.sans,
            }}>
            {day}
          </AppText>
          {/* Today accent dot */}
          {isToday && !isSelected ? (
            <View
              style={{
                position: 'absolute',
                bottom: 4,
                width: 3,
                height: 3,
                borderRadius: 1.5,
                backgroundColor: theme.colors.accent,
              }}
            />
          ) : null}
        </Pressable>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ gap: spacing.sm }}>

      {/* Date card row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {/* Departure card */}
        <Pressable
          onPress={() => openFor('departure')}
          style={{
            flex: 1,
            backgroundColor: isDepartureActive ? theme.colors.subtleSurface : theme.colors.surface,
            borderColor: isDepartureActive ? theme.colors.accent : theme.colors.border,
            borderRadius: 16,
            borderWidth: 1,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
          }}>
          <AppText
            style={{
              color: theme.colors.mutedText,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 10,
              letterSpacing: 1.4,
              marginBottom: 4,
              textTransform: 'uppercase',
            }}>
            Departure
          </AppText>
          <AppText
            style={{
              color: dep ? theme.colors.text : theme.colors.subtleText,
              fontFamily: dep ? theme.fonts.sansMedium : theme.fonts.sans,
              fontSize: 14,
            }}>
            {dep ? formatDisplayDate(dep) : 'Select date'}
          </AppText>
        </Pressable>

        <AppIcon color={theme.colors.subtleText} name="arrow-right" size={12} />

        {/* Return card */}
        <Pressable
          onPress={() => openFor('return')}
          style={{
            flex: 1,
            backgroundColor: isReturnActive ? theme.colors.subtleSurface : theme.colors.surface,
            borderColor: isReturnActive ? theme.colors.accent : theme.colors.border,
            borderRadius: 16,
            borderWidth: 1,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
          }}>
          <AppText
            style={{
              color: theme.colors.mutedText,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 10,
              letterSpacing: 1.4,
              marginBottom: 4,
              textTransform: 'uppercase',
            }}>
            Return
          </AppText>
          <AppText
            style={{
              color: ret ? theme.colors.text : theme.colors.subtleText,
              fontFamily: ret ? theme.fonts.sansMedium : theme.fonts.sans,
              fontSize: 14,
            }}>
            {ret ? formatDisplayDate(ret) : 'Select date'}
          </AppText>
        </Pressable>
      </View>

      {/* Duration + change hint — shown only when both dates are set and calendar is closed */}
      {hasBothEnds && !isOpen ? (
        <AppText style={{ color: theme.colors.mutedText, fontSize: 13, textAlign: 'center' }}>
          {nightsLabel(dep!, ret!)} · Tap a date to change
        </AppText>
      ) : null}

      {/* Calendar */}
      {isOpen ? (
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 20,
            borderWidth: 1,
            paddingHorizontal: spacing.sm,
            paddingBottom: spacing.md,
            paddingTop: spacing.sm,
          }}>

          {/* Mode label */}
          <AppText
            style={{
              color: theme.colors.accent,
              fontFamily: theme.fonts.sansMedium,
              fontSize: 10,
              letterSpacing: 1.6,
              marginBottom: spacing.sm,
              textAlign: 'center',
              textTransform: 'uppercase',
            }}>
            {mode === 'departure' ? 'Choose departure' : 'Choose return'}
          </AppText>

          {/* Month navigation */}
          <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: spacing.xs }}>
            <Pressable hitSlop={12} onPress={prevMonth} style={{ padding: spacing.xs }}>
              <AppIcon color={theme.colors.text} name="chevron-left" size={18} />
            </Pressable>
            <AppText
              style={{
                flex: 1,
                fontFamily: theme.fonts.sansMedium,
                fontSize: 15,
                textAlign: 'center',
              }}>
              {formatMonthYear(viewYear, viewMonth)}
            </AppText>
            <Pressable hitSlop={12} onPress={nextMonth} style={{ padding: spacing.xs }}>
              <AppIcon color={theme.colors.text} name="chevron-right" size={18} />
            </Pressable>
          </View>

          {/* Day-of-week headers */}
          <View style={{ flexDirection: 'row', marginBottom: 2 }}>
            {DAY_LABELS.map((label) => (
              <View key={label} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                <AppText
                  style={{
                    color: theme.colors.subtleText,
                    fontFamily: theme.fonts.sansMedium,
                    fontSize: 11,
                    letterSpacing: 0.4,
                  }}>
                  {label}
                </AppText>
              </View>
            ))}
          </View>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map((day, di) => renderDayCell(day, wi, di))}
            </View>
          ))}
        </View>
      ) : null}

    </View>
  );
}
