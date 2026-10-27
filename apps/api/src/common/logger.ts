import pino, { type Logger, type DestinationStream } from 'pino';
import type { AppConfig } from '../config/env';

/** Fields that must never reach a log file, in any nesting position we use. */
export const REDACT_PATHS = [
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'pin',
  'otp',
  'authorization',
  'cookie',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.passwordHash',
  '*.password_hash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.pin',
  '*.otp',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

export function createLogger(
  config: Pick<AppConfig, 'logLevel' | 'isProduction' | 'isTest' | 'appName'>,
  destination?: DestinationStream,
): Logger {
  const options = {
    level: config.logLevel,
    base: { service: 'omal-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  };

  if (destination) return pino(options, destination);

  if (!config.isProduction && !config.isTest) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
      },
    });
  }
  return pino(options);
}

export type { Logger };
