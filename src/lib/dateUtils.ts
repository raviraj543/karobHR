
import { differenceInMilliseconds, parseISO, getDay } from 'date-fns';

/**
 * Formats a duration in milliseconds into a string like "Xh Ym".
 * @param ms The duration in milliseconds.
 * @returns A string representation of the duration.
 */
export const formatDuration = (ms: number): string => {
  if (ms <= 0) return '0m';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  let durationString = '';
  if (hours > 0) durationString += `${hours}h `;
  // Always show minutes, even if 0 and hours > 0, or if hours === 0
  durationString += `${minutes}m`;
  return durationString.trim() || '0m'; // Ensure "0m" if somehow both are zero after logic
};

/**
 * Checks if a given date is a Sunday.
 * @param date The date to check (can be a Date object or an ISO string).
 * @returns True if the date is a Sunday, false otherwise.
 */
export const isSunday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return getDay(dateObj) === 0; // Sunday is 0 in date-fns (0 for Sunday, 1 for Monday, etc.)
};
