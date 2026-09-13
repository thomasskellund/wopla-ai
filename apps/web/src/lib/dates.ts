/**
 * Formats a Date as YYYY-MM-DD using its LOCAL calendar date, not
 * `toISOString()` (which converts to UTC first). Using toISOString() for
 * "today" or "the Monday of this week" silently rolls back to the previous
 * day for any viewer whose local time is ahead of UTC (e.g. Denmark) —
 * local midnight is still the evening before in UTC.
 */
export function localISODate(d: Date = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
