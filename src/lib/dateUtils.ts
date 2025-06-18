
import { differenceInMilliseconds, parseISO, getDay, getDaysInMonth, setDate, startOfMonth } from 'date-fns';

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
 * Formats a total number of hours (can be a decimal) into a string like "Xh Ym".
 * @param totalHours The total hours.
 * @returns A string representation of the hours and minutes.
 */
export const formatHoursAndMinutes = (totalHours: number): string => {
    if (totalHours < 0) return '0h 0m';
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    return `${hours}h ${minutes}m`;
};


/**
 * Checks if a given date is a Sunday.
 * @param date The date to check (can be a Date object or an ISO string).
 * @returns True if the date is a Sunday, false otherwise.
 */
export const isSunday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  try {
    return getDay(dateObj) === 0; // Sunday is 0 in date-fns (0 for Sunday, 1 for Monday, etc.)
  } catch (e) {
    // console.warn(`isSunday: Invalid date provided: ${date}`, e);
    return false; // Or handle error as appropriate
  }
};

/**
 * Calculates the number of working days (Mon-Sat) in a given month and year.
 * @param year The year.
 * @param month The month (0 for January, 11 for December).
 * @param holidays An array of holiday dates (ISO strings or Date objects) to exclude.
 * @returns The number of working days in the month.
 */
export const getWorkingDaysInMonth = (year: number, month: number, holidays: (Date | string)[] = []): number => {
  const daysInMonth = getDaysInMonth(new Date(year, month));
  let workingDays = 0;
  const holidayTimestamps = holidays.map(h => parseISO(h instanceof Date ? h.toISOString() : h).setHours(0,0,0,0));

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    if (getDay(currentDate) !== 0) { // Not a Sunday
      const currentDayTimestamp = currentDate.setHours(0,0,0,0);
      if (!holidayTimestamps.includes(currentDayTimestamp)) { // Not a holiday
        workingDays++;
      }
    }
  }
  return workingDays;
};
