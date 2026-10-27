import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigError } from '../src/config/env';

describe('Phase 1: Environment & Configuration Tests', () => {
  const baseValidDev = {
    NODE_ENV: 'development',
    HOST: '0.0.0.0',
    PORT: '4000',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USER: 'postgres',
    DB_PASSWORD: '',
    DB_NAME: 'omal_business_dev',
    JWT_SECRET: 'a_very_long_random_development_secret_entropy_minimum_32_characters_long',
    CORS_ORIGINS: 'http://localhost:3000',
  };

  it('1.1. Successfully parses and types a valid development configuration', () => {
    const config = loadConfig(baseValidDev);
    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(4000);
    expect(config.db.database).toBe('omal_business_dev');
    expect(config.isProduction).toBe(false);
    expect(config.isTest).toBe(false);
    expect(config.currency).toBe('GHS');
    expect(config.timezone).toBe('Africa/Accra');
  });

  it('1.2. Successfully parses and types a valid test configuration with _test database', () => {
    const config = loadConfig({
      ...baseValidDev,
      NODE_ENV: 'test',
      DB_NAME: 'omal_business_test',
      PORT: '0',
    });
    expect(config.nodeEnv).toBe('test');
    expect(config.isTest).toBe(true);
    expect(config.db.database).toBe('omal_business_test');
  });

  it('1.3. Rejects test environment when DB_NAME does not end with _test', () => {
    expect(() =>
      loadConfig({
        ...baseValidDev,
        NODE_ENV: 'test',
        DB_NAME: 'omal_business_dev', // invalid for test!
      }),
    ).toThrow(ConfigError);
  });

  it('1.4. Rejects JWT_SECRET shorter than 32 characters', () => {
    expect(() =>
      loadConfig({
        ...baseValidDev,
        JWT_SECRET: 'short_secret',
      }),
    ).toThrow(ConfigError);
  });

  it('1.5. In production, strictly rejects placeholder secrets and missing DB_PASSWORD', () => {
    expect(() =>
      loadConfig({
        ...baseValidDev,
        NODE_ENV: 'production',
        DB_NAME: 'omal_business_prod',
        DB_PASSWORD: '', // empty password not allowed in production!
        JWT_SECRET: 'change_me_placeholder_secret_key_that_is_32_chars_long',
        CORS_ORIGINS: 'https://erp.omalbusiness.com',
      }),
    ).toThrow(ConfigError);
  });

  it('1.6. In production, strictly rejects wildcard CORS origin "*"', () => {
    expect(() =>
      loadConfig({
        ...baseValidDev,
        NODE_ENV: 'production',
        DB_NAME: 'omal_business_prod',
        DB_PASSWORD: 'real_vault_password_12345678',
        JWT_SECRET: 'real_production_secret_key_with_at_least_32_random_entropy_characters',
        CORS_ORIGINS: '*', // wildcard not allowed in production!
      }),
    ).toThrow(ConfigError);
  });
});
