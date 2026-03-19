/**
 * Strukturiertes Logging für den A11y Scanner
 * Unterstützt verschiedene Log-Levels und kontextreiche Ausgaben
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private minLevel: LogLevel = 'info';
  private enableConsole: boolean = true;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  configure(options: { minLevel?: LogLevel; enableConsole?: boolean }) {
    if (options.minLevel) this.minLevel = options.minLevel;
    if (options.enableConsole !== undefined) this.enableConsole = options.enableConsole;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatLog(entry: LogEntry): string {
    const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      return `${base} ${JSON.stringify(entry.context)}`;
    }
    
    return base;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    if (this.enableConsole) {
      const formatted = this.formatLog(entry);
      
      switch (level) {
        case 'debug':
          console.debug(formatted);
          break;
        case 'info':
          console.info(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
          console.error(formatted);
          if (error?.stack) {
            console.error(error.stack);
          }
          break;
      }
    }

    // In production, send to external service
    if (process.env.NODE_ENV === 'production' && level === 'error') {
      this.sendToErrorTracking(entry);
    }
  }

  private sendToErrorTracking(entry: LogEntry) {
    // Sentry integration will be added here
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureMessage(entry.message, {
        level: entry.level,
        extra: entry.context,
      });
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, context, error);
  }

  // Specialized logging methods
  scanStarted(url: string, mode: string) {
    this.info('Scan started', { url, mode });
  }

  scanCompleted(url: string, duration: number, violations: number) {
    this.info('Scan completed', { url, duration, violations });
  }

  scanFailed(url: string, error: Error) {
    this.error('Scan failed', error, { url });
  }

  browserPoolEvent(event: string, details?: LogContext) {
    this.debug(`BrowserPool: ${event}`, details);
  }
}

export const logger = Logger.getInstance();

// Server-side error wrapper
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operationName: string
): T {
  return (async (...args: any[]) => {
    try {
      logger.debug(`${operationName} started`, { args: args.map(a => typeof a) });
      const result = await fn(...args);
      logger.debug(`${operationName} completed`);
      return result;
    } catch (error) {
      logger.error(`${operationName} failed`, error as Error, { args: args.map(a => typeof a) });
      throw error;
    }
  }) as T;
}

// API route error handler
export function handleApiError(error: unknown): { message: string; status: number } {
  if (error instanceof Error) {
    // Known error types
    if (error.message.includes('timeout')) {
      return { message: 'Request timeout', status: 504 };
    }
    if (error.message.includes('navigation')) {
      return { message: 'Failed to navigate to URL', status: 400 };
    }
    if (error.message.includes('browser')) {
      return { message: 'Browser initialization failed', status: 503 };
    }
    
    logger.error('API error', error);
    return { message: error.message, status: 500 };
  }
  
  logger.error('Unknown error', new Error(String(error)));
  return { message: 'An unknown error occurred', status: 500 };
}
