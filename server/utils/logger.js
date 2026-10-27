const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Redact sensitive fields (passwords, PINs, tokens)
const redactSensitiveFields = winston.format((info) => {
  const sensitiveKeys = ['password', 'admin_pin', 'token', 'authorization', 'secret'];
  
  const mask = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        obj[key] = '***REDACTED***';
      } else if (typeof obj[key] === 'object') {
        mask(obj[key]);
      }
    }
    return obj;
  };

  return mask(info);
});

const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const transports = [
  new winston.transports.Console({
    format: process.env.LOG_FORMAT === 'pretty'
      ? winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] [${level}] ${message}${metaStr}`;
          })
        )
      : winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json())
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: winston.format.combine(winston.format.timestamp(), winston.format.json())
  })
];

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    redactSensitiveFields(),
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'omal-pos-backend', env: process.env.NODE_ENV || 'development' },
  transports
});

module.exports = logger;
