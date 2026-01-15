import { useState, useEffect, useRef, useMemo } from 'react';
import { TimeLeft, getTimeLeft } from '@/lib/timeUtils';

/**
 * A shared countdown hook that efficiently manages multiple countdowns
 * using a single timer. This prevents creating multiple intervals when
 * multiple components need countdown functionality.
 */

// Global state to track all active countdowns
const subscribers = new Map<string, Set<(time: TimeLeft) => void>>();
const timeCache = new Map<string, TimeLeft>();
let globalTimer: ReturnType<typeof setInterval> | null = null;

function tick() {
  subscribers.forEach((callbacks, dateKey) => {
    const date = new Date(dateKey);
    const time = getTimeLeft(date);
    timeCache.set(dateKey, time);
    callbacks.forEach(callback => callback(time));
  });
}

function startGlobalTimer() {
  if (globalTimer === null && subscribers.size > 0) {
    tick(); // Initial tick
    globalTimer = setInterval(tick, 1000);
  }
}

function stopGlobalTimer() {
  if (globalTimer !== null && subscribers.size === 0) {
    clearInterval(globalTimer);
    globalTimer = null;
  }
}

/**
 * Hook to subscribe to countdown updates for a specific date
 * @param targetDate - The target date to count down to
 * @returns TimeLeft object with days, hours, minutes, seconds remaining
 */
export function useCountdown(targetDate: Date | string | null): TimeLeft {
  // Memoize the ISO string to avoid reference comparison issues with Date objects
  const dateKey = useMemo(() => {
    if (!targetDate) return null;
    const date = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    return date.toISOString();
  }, [typeof targetDate === 'string' ? targetDate : targetDate?.getTime()]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => {
    if (!dateKey) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    return getTimeLeft(new Date(dateKey));
  });

  useEffect(() => {
    if (!dateKey) return;

    // Subscribe to updates for this date
    if (!subscribers.has(dateKey)) {
      subscribers.set(dateKey, new Set());
    }
    subscribers.get(dateKey)!.add(setTimeLeft);
    
    // Start the global timer if not already running
    startGlobalTimer();

    // Get cached value if available
    const cached = timeCache.get(dateKey);
    if (cached) {
      setTimeLeft(cached);
    }

    return () => {
      // Unsubscribe
      const callbacks = subscribers.get(dateKey);
      if (callbacks) {
        callbacks.delete(setTimeLeft);
        if (callbacks.size === 0) {
          subscribers.delete(dateKey);
          timeCache.delete(dateKey);
        }
      }
      // Stop global timer if no more subscribers
      stopGlobalTimer();
    };
  }, [dateKey]);

  return timeLeft;
}
