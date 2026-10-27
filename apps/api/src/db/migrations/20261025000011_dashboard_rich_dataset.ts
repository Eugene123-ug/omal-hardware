import type { Knex } from 'knex';

export async function up(_knex: Knex): Promise<void> {
  // Clean enterprise dataset - no dummy mock products or fake sales
}

export async function down(_knex: Knex): Promise<void> {
  // No-op
}
