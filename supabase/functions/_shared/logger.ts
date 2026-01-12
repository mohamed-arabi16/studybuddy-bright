/**
 * Structured logging utility for Edge Functions
 * Provides consistent, JSON-formatted log output for observability
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  function_name?: string;
  user_id?: string;
  course_id?: string;
  job_id?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Creates a logger instance for a specific Edge Function
 */
export function createLogger(functionName: string) {
  return {
    debug: (event: string, data?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'event' | 'function_name'>>) => 
      log('debug', functionName, event, data),
    info: (event: string, data?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'event' | 'function_name'>>) => 
      log('info', functionName, event, data),
    warn: (event: string, data?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'event' | 'function_name'>>) => 
      log('warn', functionName, event, data),
    error: (event: string, data?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'event' | 'function_name'>>) => 
      log('error', functionName, event, data),
  };
}

/**
 * Core logging function - outputs structured JSON to console
 */
function log(
  level: LogLevel, 
  functionName: string, 
  event: string, 
  data?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'event' | 'function_name'>>
) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    function_name: functionName,
    ...data,
  };

  // Format error objects properly
  if (data?.error && data.error instanceof Error) {
    entry.error = {
      message: data.error.message,
      stack: data.error.stack,
      code: (data.error as Error & { code?: string }).code,
    };
  }

  console.log(JSON.stringify(entry));
}

/**
 * Creates a timing utility for measuring operation duration
 */
export function createTimer() {
  const startTime = Date.now();
  return {
    elapsed: () => Date.now() - startTime,
    stop: () => Date.now() - startTime,
  };
}
