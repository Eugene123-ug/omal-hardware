import { describe, it, expect } from 'vitest';
import { createLogger } from '../src/common/logger';

describe('Phase 1: Structured Logger & Sensitive Data Redaction Tests', () => {
  it('1.7. Automatically redacts passwords, tokens, PINs, and authorization headers from logs', () => {
    let output = '';
    const destination = {
      write(msg: string) {
        output += msg;
      },
    };

    const logger = createLogger(
      {
        logLevel: 'info',
        isProduction: true,
        isTest: false,
        appName: 'OMAL ERP Test',
      },
      destination as any,
    );

    logger.info(
      {
        user: 'kwame@omal.com',
        password: 'raw_cashier_password_secret',
        token: 'eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTIzfQ',
        pin: '1234',
        authorization: 'Bearer super_secret_token_value',
      },
      'User login event recorded',
    );

    expect(output).toContain('kwame@omal.com');
    expect(output).not.toContain('raw_cashier_password_secret');
    expect(output).not.toContain('eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(output).not.toContain('super_secret_token_value');
    expect(output).toContain('[REDACTED]');
  });
});
