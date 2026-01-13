/**
 * Interface representing time left until a target date
 */
export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

/**
 * Calculate time left until a target date
 * @param targetDate - The target date to calculate time left until
 * @returns TimeLeft object with days, hours, minutes, seconds, and total milliseconds
 */
export function getTimeLeft(targetDate: Date): TimeLeft {
  const difference = targetDate.getTime() - new Date().getTime();
  
  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    total: difference,
  };
}

/**
 * Get urgency level based on days left and total time
 * @param days - Number of days left
 * @param total - Total milliseconds left
 * @returns Urgency level string
 */
export function getUrgencyLevel(days: number, total: number): 'safe' | 'warning' | 'urgent' | 'critical' | 'past' {
  if (total <= 0) return 'past';
  if (days < 1) return 'critical';
  if (days < 2) return 'urgent';
  if (days < 4) return 'warning';
  return 'safe';
}
