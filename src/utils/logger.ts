import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current __filename and __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const logLevels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Get current log level from environment variable, default to 'info'
const currentLogLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel || 'info';
const numericLogLevel = logLevels[currentLogLevel] || 1;

// Create logs directory if it doesn't exist
const logsDir = path.join(projectRoot, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log file with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `localviz-${timestamp}.log`);

// Helper function to format messages
function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

// Write message to log file
function writeToLogFile(message: string): void {
  fs.appendFileSync(logFile, message + '\n');
}

// Logger object
const logger = {
  debug(message: string, ...args: any[]): void {
    if (numericLogLevel <= logLevels.debug) {
      const formattedMessage = formatMessage('debug', message);
      console.debug(formattedMessage, ...args);
      writeToLogFile(formattedMessage + (args.length ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : ''));
    }
  },
  
  info(message: string, ...args: any[]): void {
    if (numericLogLevel <= logLevels.info) {
      const formattedMessage = formatMessage('info', message);
      console.log(formattedMessage, ...args);
      writeToLogFile(formattedMessage + (args.length ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : ''));
    }
  },
  
  warn(message: string, ...args: any[]): void {
    if (numericLogLevel <= logLevels.warn) {
      const formattedMessage = formatMessage('warn', message);
      console.warn(formattedMessage, ...args);
      writeToLogFile(formattedMessage + (args.length ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : ''));
    }
  },
  
  error(message: string, ...args: any[]): void {
    if (numericLogLevel <= logLevels.error) {
      const formattedMessage = formatMessage('error', message);
      console.error(formattedMessage, ...args);
      writeToLogFile(formattedMessage + (args.length ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : ''));
    }
  }
};

// Display initial log message
logger.info(`Logger initialized with level: ${currentLogLevel}`);
logger.info(`Log file created at: ${logFile}`);

export default logger;