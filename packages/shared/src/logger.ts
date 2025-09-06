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
