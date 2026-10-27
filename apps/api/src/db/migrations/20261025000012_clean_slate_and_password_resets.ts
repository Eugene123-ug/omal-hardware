import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create password_resets table for forgot password email resets
  const hasPasswordResets = await knex.schema.hasTable('password_resets');
  if (!hasPasswordResets) {
    await knex.schema.createTable('password_resets', (t) => {
      t.increments('id').primary();
      t.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
      t.string('email', 255).notNullable().index();
      t.string('token_hash', 255).notNullable();
      t.timestamp('expires_at', { useTz: true }).notNullable();
      t.boolean('is_used').notNullable().defaultTo(false);
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  // 2. Keep only Administrator user active
  const adminUser = await knex('users')
    .join('roles', 'roles.id', 'users.role_id')
    .where('roles.key', 'administrator')
    .orWhere('users.username', 'admin')
    .select('users.id')
    .first();

  if (adminUser) {
    await knex('users').whereNot('id', adminUser.id).update({ is_active: false });
  }

  // 3. Log clean slate initialization
  await knex('audit_logs').insert({
    action: 'system.clean_slate',
    actor_label: 'System Maintenance',
    result: 'success',
    metadata: JSON.stringify({ message: 'Production clean slate initialized on Supabase.' }),
    ip_address: '127.0.0.1',
    user_agent: 'Database Migration',
  });
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('password_resets')) {
    await knex.schema.dropTableIfExists('password_resets');
  }
}
