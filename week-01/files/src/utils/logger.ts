const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const levels: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function shouldLog(level: LogLevel): boolean {
  return levels[level] <= levels[LOG_LEVEL as LogLevel];
}

function formatLog(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  error: (message: string) => {
    if (shouldLog('error')) console.error(formatLog('error', message));
  },
  warn: (message: string) => {
    if (shouldLog('warn')) console.warn(formatLog('warn', message));
  },
  info: (message: string) => {
    if (shouldLog('info')) console.log(formatLog('info', message));
  },
  debug: (message: string) => {
    if (shouldLog('debug')) console.log(formatLog('debug', message));
  },
};