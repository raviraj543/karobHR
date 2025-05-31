
import { differenceInMilliseconds, parseISO } from 'date-fns';

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
