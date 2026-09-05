/**
 * Helper to ensure database UTC timestamp strings are reliably parsed as UTC
 * and rendered in the user's local system time.
 */

export const parseUtcDate = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  let s = String(dateStr).trim();
  if (!s) return null;

  // If format is "YYYY-MM-DD HH:MM:SS", convert to "YYYY-MM-DDTHH:MM:SSZ"
  if (!s.includes('T') && s.includes(' ')) {
    s = s.replace(' ', 'T') + 'Z';
  } else if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-', 10)) {
    s = s + 'Z';
  }

  const d = new Date(s);
  if (isNaN(d.getTime())) {
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  return d;
};

/**
 * Formats a UTC timestamp into local system time: "11:28:33 AM"
 */
export const formatLocalTime = (dateStr: string | undefined | null): string => {
  const date = parseUtcDate(dateStr);
  if (!date) return '—';

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

/**
 * Formats a UTC timestamp into full local system date & time: "Sep 5, 2026, 11:28:33 AM"
 */
export const formatLocalDateTime = (dateStr: string | undefined | null): string => {
  const date = parseUtcDate(dateStr);
  if (!date) return '—';

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};
