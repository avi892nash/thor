import fs from 'fs';
import { join } from 'path';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const LOG_DIR = process.env['LOG_DIR'] || join(process.cwd(), 'logs');
const LOG_FILE = join(LOG_DIR, 'server.log');

let stream: fs.WriteStream | null = null;

const getStream = (): fs.WriteStream | null => {
  if (stream) return stream;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    stream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
    stream.on('error', (err) => {
      process.stderr.write(`[logger] file write error: ${err.message}\n`);
      stream = null;
    });
  } catch (err) {
    process.stderr.write(`[logger] could not open log file at ${LOG_FILE}: ${err}\n`);
  }
  return stream;
};

const write = (level: LogLevel, message: string, extra?: unknown): void => {
  const ts = new Date().toISOString();
  let extraStr = '';
  if (extra !== undefined) {
    extraStr = ' ' + (
      extra instanceof Error
        ? (extra.stack || extra.message)
        : JSON.stringify(extra)
    );
  }
  const line = `[${ts}] [${level}] ${message}${extraStr}\n`;

  if (level === 'ERROR') process.stderr.write(line);
  else process.stdout.write(line);

  getStream()?.write(line);
};

export const logger = {
  info:  (msg: string, extra?: unknown): void => write('INFO',  msg, extra),
  warn:  (msg: string, extra?: unknown): void => write('WARN',  msg, extra),
  error: (msg: string, extra?: unknown): void => write('ERROR', msg, extra),
  logFile: LOG_FILE,
};
