// Disable ESLint rule for console usage in this file
/* eslint-disable no-console */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LoggerOptions {
  enabled?: boolean;
  level?: LogLevel;
}

// In Node (MCP stdio server), stdout is reserved for JSON-RPC traffic.
// Any other bytes on stdout corrupt the protocol and the MCP client
// drops the server. Detect Node by the presence of process.stderr and
// route every log line through stderr there. In the browser, fall back
// to the standard console.* methods.
const IS_NODE_WITH_STDERR = typeof process !== 'undefined'
  && typeof (process as any).stderr?.write === 'function';

function formatArg(arg: any): string {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === 'string') return arg;
  try { return JSON.stringify(arg); } catch { return String(arg); }
}

function writeToStderr(message: string, args: any[]): void {
  const extras = args.length > 0 ? ` ${args.map(formatArg).join(' ')}` : '';
  (process as any).stderr.write(`${message}${extras}\n`);
}

// Simple logger utility with log levels
export class Logger {
  private enabled: boolean = true;

  private level: LogLevel = LogLevel.INFO;

  constructor({
    enabled = true,
    level = LogLevel.INFO,
  }: LoggerOptions = {}) {
    this.enabled = enabled;
    this.level = level;
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.enabled || level < this.level) {
      return;
    }

    if (IS_NODE_WITH_STDERR) {
      writeToStderr(message, args);
      return;
    }

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(message, ...args);
        break;
      case LogLevel.INFO:
        console.info(message, ...args);
        break;
      case LogLevel.WARN:
        console.warn(message, ...args);
        break;
      case LogLevel.ERROR:
        console.error(message, ...args);
        break;
      default:
        console.log(message, ...args);
        break;
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
