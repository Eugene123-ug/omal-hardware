import type { Knex } from 'knex';

/**
 * Phase 1 - foundation schema.
 *
 * Conventions used by every later migration:
 *  - Primary keys: BIGINT identity (`bigserial`).
 *  - Money: NUMERIC(14,2). Unit costs: NUMERIC(14,4). Quantities: NUMERIC(14,3). Never FLOAT.
 *  - Every timestamp is TIMESTAMPTZ. `created_at` / `updated_at` on mutable tables.
 *  - Foreign keys are RESTRICT by default: business records are deactivated, not deleted.
 *  - Natural keys (codes, emails) have UNIQUE constraints; email/username are case-insensitive.
 */
export async function up(knex: Knex): Promise<void> {
  // Keeps updated_at truthful no matter which code path writes the row.
  await knex.raw(`
    create function omal_set_updated_at() returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql;
  `);

  // Audit history is append-only: no update, delete or truncate by anyone using the app.
  await knex.raw(`
    create function omal_forbid_modification() returns trigger as $$
    begin
      raise exception '% on % is not allowed: this table is append-only', tg_op, tg_table_name
        using errcode = 'restrict_violation';
    end;
    $$ language plpgsql;
  `);

  await knex.schema.createTable('branches', (t) => {
    t.bigIncrements('id');
    t.string('code', 20).notNullable().unique();
    t.string('name', 120).notNullable().unique();
    t.text('address');
    t.string('phone', 30);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(`alter table branches add constraint branches_code_format check (code ~ '^[A-Z0-9_-]{2,20}$')`);

  await knex.schema.createTable('warehouses', (t) => {
    t.bigIncrements('id');
    t.bigInteger('branch_id').notNullable().references('id').inTable('branches').onDelete('RESTRICT');
    t.string('code', 30).notNullable().unique();
    t.string('name', 120).notNullable();
    t.string('kind', 20).notNullable().defaultTo('store');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['branch_id', 'name']);
    t.index(['branch_id']);
  });
  await knex.raw(`alter table warehouses add constraint warehouses_kind_valid check (kind in ('showroom','depot','store'))`);

  await knex.schema.createTable('roles', (t) => {
    t.bigIncrements('id');
    t.string('key', 40).notNullable().unique();
    t.string('name', 80).notNullable();
    t.text('description');
    t.boolean('is_system').notNullable().defaultTo(false);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('permissions', (t) => {
    t.bigIncrements('id');
    t.string('key', 80).notNullable().unique();
    t.string('module', 40).notNullable();
    t.text('description');
    t.index(['module']);
  });

  await knex.schema.createTable('role_permissions', (t) => {
    t.bigInteger('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
    t.bigInteger('permission_id').notNullable().references('id').inTable('permissions').onDelete('CASCADE');
    t.timestamp('granted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.primary(['role_id', 'permission_id']);
    t.index(['permission_id']);
  });

  await knex.schema.createTable('users', (t) => {
    t.bigIncrements('id');
    t.string('username', 50);
    t.string('email', 254).notNullable();
    t.text('password_hash').notNullable();
    t.string('full_name', 120).notNullable();
    t.string('phone', 30);
    t.bigInteger('role_id').notNullable().references('id').inTable('roles').onDelete('RESTRICT');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('last_login_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['role_id']);
  });
  // Case-insensitive uniqueness: "Kofi@x.com" and "kofi@x.com" are the same person.
  await knex.raw('create unique index users_email_lower_unique on users (lower(email))');
  await knex.raw('create unique index users_username_lower_unique on users (lower(username)) where username is not null');

  await knex.schema.createTable('user_branches', (t) => {
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('branch_id').notNullable().references('id').inTable('branches').onDelete('RESTRICT');
    t.boolean('is_primary').notNullable().defaultTo(false);
    t.timestamp('assigned_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.primary(['user_id', 'branch_id']);
    t.index(['branch_id']);
  });
  await knex.raw('create unique index user_branches_one_primary on user_branches (user_id) where is_primary');

  await knex.schema.createTable('audit_logs', (t) => {
    t.bigIncrements('id');
    t.timestamp('occurred_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.bigInteger('actor_user_id').references('id').inTable('users').onDelete('RESTRICT');
    t.string('actor_label', 160);
    t.string('action', 80).notNullable();
    t.string('entity_type', 60);
    t.string('entity_id', 60);
    t.bigInteger('branch_id').references('id').inTable('branches').onDelete('RESTRICT');
    t.string('result', 20).notNullable().defaultTo('success');
    t.jsonb('before_data');
    t.jsonb('after_data');
    t.jsonb('metadata');
    t.string('ip_address', 64);
    t.text('user_agent');
    t.string('request_id', 64);
    t.index(['occurred_at']);
    t.index(['actor_user_id', 'occurred_at']);
    t.index(['entity_type', 'entity_id']);
    t.index(['action', 'occurred_at']);
    t.index(['branch_id', 'occurred_at']);
  });
  await knex.raw(`alter table audit_logs add constraint audit_logs_result_valid check (result in ('success','denied','failed'))`);

  await knex.schema.createTable('settings', (t) => {
    t.string('key', 100).primary();
    t.jsonb('value').notNullable();
    t.text('description');
    t.bigInteger('updated_by').references('id').inTable('users').onDelete('RESTRICT');
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  for (const table of ['branches', 'warehouses', 'roles', 'users', 'settings']) {
    await knex.raw(
      `create trigger ${table}_set_updated_at before update on ${table} for each row execute function omal_set_updated_at()`,
    );
  }
  await knex.raw(
    `create trigger audit_logs_no_update_delete before update or delete on audit_logs for each row execute function omal_forbid_modification()`,
  );
  await knex.raw(
    `create trigger audit_logs_no_truncate before truncate on audit_logs for each statement execute function omal_forbid_modification()`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('drop trigger if exists audit_logs_no_truncate on audit_logs');
  await knex.raw('drop trigger if exists audit_logs_no_update_delete on audit_logs');
  for (const table of [
    'settings',
    'audit_logs',
    'user_branches',
    'users',
    'role_permissions',
    'permissions',
    'roles',
    'warehouses',
    'branches',
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
  await knex.raw('drop function if exists omal_forbid_modification()');
  await knex.raw('drop function if exists omal_set_updated_at()');
}
