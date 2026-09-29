const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Format a date, timestamp or ISO string as a clean, human-readable date label.
 * Returns '—' for null, undefined, empty, or invalid dates.
 */
export function dateOnlyLabel(value: unknown): string {
  if (!value) return '—';
  try {
    if (typeof value === 'string') {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match && !value.includes('T')) {
        const [, y, m, d] = match;
        const monthIndex = parseInt(m, 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          return `${d} ${MONTH_NAMES[monthIndex]} ${y}`;
        }
      }
    }

    const dateObj = value instanceof Date ? value : new Date(String(value));
    if (isNaN(dateObj.getTime())) return '—';

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return '—';
  }
}

export const formatDateOnly = dateOnlyLabel;

/**
 * Validates and normalizes submission start and end dates.
 * Sets start date to the beginning of the day (00:00:00) and deadline to end of the day (23:59:59.999).
 */
export function submissionDateBounds(
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined
): { openAt: string; deadline: string } {
  const start = String(startDateStr || '').trim();
  const end = String(endDateStr || '').trim();

  if (!start) {
    throw new Error('Submission start date is required');
  }
  if (!end) {
    throw new Error('Submission last date is required');
  }

  const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
  const startIso = dateOnlyRegex.test(start) ? `${start}T00:00:00` : start;
  const endIso = dateOnlyRegex.test(end) ? `${end}T23:59:59.999` : end;

  const startObj = new Date(startIso);
  const endObj = new Date(endIso);

  if (isNaN(startObj.getTime())) {
    throw new Error('Invalid submission start date');
  }
  if (isNaN(endObj.getTime())) {
    throw new Error('Invalid submission last date');
  }

  if (startObj.getTime() > endObj.getTime()) {
    throw new Error('Submission last date must be on or after submission start date');
  }

  return {
    openAt: startObj.toISOString(),
    deadline: endObj.toISOString(),
  };
}
