#!/usr/bin/env node

import { Command, InvalidArgumentError } from 'commander';
import { LogLevel } from '@dom-pointer-mcp/shared/logger';
import start from './start';
import configCommand from './config';
import CLICommand from './commands';
import logger from './logger';
import doctor from './doctor';
import parsePort from './utils/port';
import serverVersion from './version';

function parseLogLevel(level: string): LogLevel {
  const levelMap: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
  };

  const parsedLevel = levelMap[level.toLowerCase()];

  if (parsedLevel === undefined) {
    logger.error(`Invalid log level: ${level}. Use debug|info|warn|error`);
    process.exit(1);
  }

  return parsedLevel;
}

function parsePortOption(value: string): number {
  try {
    return parsePort(value);
  } catch (error) {
    throw new InvalidArgumentError((error as Error).message);
  }
}

const program = new Command();

program
  .option('-l, --log-level <level>', 'log level (debug|info|warn|error)', 'info')
  .option('-s, --silent', 'disable all logging', false);

program.on('option:log-level', (logLevelOption) => {
  const logLevel = parseLogLevel(logLevelOption);
  logger.setLevel(logLevel);
});

program.on('option:silent', () => {
  logger.setEnabled(false);
});

program
  .name('dom-pointer-mcp')
  .description('👆 DOM Pointer MCP Server')
  .version(serverVersion);

program
  .command(CLICommand.START)
  .description('👆 Start pointing at elements (start server)')
  .option('-p, --port <port>', 'WebSocket port', parsePortOption, 7007)
  .action(start);

program
  .command(`${CLICommand.CONFIG} [tool]`)
  .option('--scope <scope>', 'Install scope: user or project (interactive if omitted)')
  .option('--uninstall', 'Remove DOM Pointer MCP instead of installing')
  .option('--global', 'Use globally installed binary instead of npx')
  .option('--lang <lang>', 'UI language: zh or en (default: zh)')
  .description('Configure DOM Pointer MCP for AI tools (interactive when no tool is given)')
  .action(configCommand);

program
  .command(CLICommand.DOCTOR)
  .description('Check DOM Pointer MCP local setup and recent shared state')
  .option('-p, --port <port>', 'WebSocket port', parsePortOption, 7007)
  .action(doctor);

program.parse();
