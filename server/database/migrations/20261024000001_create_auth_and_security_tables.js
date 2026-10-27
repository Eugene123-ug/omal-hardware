/**
 * Phase 2 Migration: Authentication, User Management, Sessions, MFA & Granular Permissions
 * Target Database: PostgreSQL 17
 */

exports.up = async function(knex) {
  // 1. ALTER USERS TABLE: Add branch, MFA, failed logins, lockout, password reset
  await knex.schema.alterTable('users', (table) => {
    table.string('branch', 100).defaultTo('Main Showroom');
    table.boolean('mfa_enabled').defaultTo(false);
    table.string('mfa_secret', 255).nullable();
    table.text('mfa_backup_codes').nullable(); // JSON array of hashed recovery codes
    table.integer('failed_login_attempts').defaultTo(0);
    table.timestamp('locked_until').nullable();
    table.string('password_reset_token', 255).nullable();
    table.timestamp('password_reset_expires').nullable();
  });

  // 2. USER SESSIONS TABLE (For active tracking and instant revocation)
  await knex.schema.createTable('user_sessions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.string('token_jti', 100).unique().notNullable();
    table.string('ip_address', 50).nullable();
    table.text('user_agent').nullable();
    table.boolean('is_revoked').defaultTo(false).notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('revoked_at').nullable();

    table.index(['user_id']);
    table.index(['token_jti']);
    table.index(['is_revoked']);
  });

  // 3. LOGIN HISTORY TABLE (Audit of all authentication attempts)
  await knex.schema.createTable('login_history', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable();
    table.string('email', 255).notNullable();
    table.string('ip_address', 50).nullable();
    table.text('user_agent').nullable();
    table.string('status', 50).notNullable(); // SUCCESS, FAILED, LOCKED, MFA_REQUIRED, MFA_FAILED
    table.string('failure_reason', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['user_id']);
    table.index(['email']);
    table.index(['status']);
    table.index(['created_at']);
  });

  // 4. USER PERMISSIONS TABLE (Custom per-user capability overrides)
  await knex.schema.createTable('user_permissions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.integer('permission_id').unsigned().references('id').inTable('permissions').onDelete('CASCADE').notNullable();
    table.boolean('is_granted').defaultTo(true).notNullable();
    table.integer('granted_by_id').unsigned().references('id').inTable('users').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['user_id', 'permission_id']);
  });

  // 5. SECURITY NOTIFICATIONS TABLE (For suspicious login activity & security alerts)
  await knex.schema.createTable('security_notifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').nullable();
    table.string('type', 100).notNullable(); // SUSPICIOUS_LOGIN, ACCOUNT_LOCKED, PASSWORD_RESET, MFA_CHANGED
    table.string('severity', 20).defaultTo('INFO'); // INFO, WARNING, CRITICAL
    table.string('title', 255).notNullable();
    table.text('message').notNullable();
    table.string('ip_address', 50).nullable();
    table.boolean('is_read').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['type']);
    table.index(['severity']);
    table.index(['is_read']);
    table.index(['created_at']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('security_notifications');
  await knex.schema.dropTableIfExists('user_permissions');
  await knex.schema.dropTableIfExists('login_history');
  await knex.schema.dropTableIfExists('user_sessions');

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('password_reset_expires');
    table.dropColumn('password_reset_token');
    table.dropColumn('locked_until');
    table.dropColumn('failed_login_attempts');
    table.dropColumn('mfa_backup_codes');
    table.dropColumn('mfa_secret');
    table.dropColumn('mfa_enabled');
    table.dropColumn('branch');
  });
};
