import type { Knex } from 'knex';

/**
 * Phase 1 - reference data that is part of how the business is structured.
 * This is configuration, not sample business activity: no users, products,
 * stock, sales or money are created here.
 */
const ROLES = [
  { key: 'owner', name: 'Owner / Super Admin', description: 'Company-wide access to authorised operations, finance, staff, approvals, audit and settings.' },
  { key: 'administrator', name: 'Administrator / IT Manager', description: 'Manages products, suppliers, stock operations and permitted operational reports.' },
  { key: 'cashier', name: 'Salesperson / Cashier', description: 'Point of sale, approved prices, available stock, receipts and own shift records.' },
  { key: 'accountant', name: 'Accountant / Auditor', description: 'Authorised finance records and reports only.' },
  { key: 'branch_manager', name: 'Branch Manager', description: 'Operations limited to assigned branches and explicitly granted permissions.' },
];

const BRANCHES = [
  { code: 'ACC', name: 'Accra Showroom' },
  { code: 'TEM', name: 'Tema Depot' },
];

const WAREHOUSES = [
  { branch: 'ACC', code: 'ACC-SHOWROOM', name: 'Accra Showroom', kind: 'showroom' },
  { branch: 'TEM', code: 'TEM-DEPOT', name: 'Tema Depot', kind: 'depot' },
];

const SETTINGS = [
  { key: 'company.name', value: JSON.stringify('OMAL ERP'), description: 'Company display name' },
  { key: 'company.currency', value: JSON.stringify('GHS'), description: 'ISO currency code (Ghana cedi, GH₵)' },
  { key: 'company.timezone', value: JSON.stringify('Africa/Accra'), description: 'Timezone used for business dates and reports' },
];

export async function up(knex: Knex): Promise<void> {
  await knex('roles')
    .insert(ROLES.map((r) => ({ ...r, is_system: true })))
    .onConflict('key')
    .ignore();

  await knex('branches').insert(BRANCHES).onConflict('code').ignore();

  const branchRows = await knex('branches').select('id', 'code');
  const branchId = new Map(branchRows.map((b: { id: number; code: string }) => [b.code, b.id]));
  await knex('warehouses')
    .insert(
      WAREHOUSES.map((w) => ({
        branch_id: branchId.get(w.branch),
        code: w.code,
        name: w.name,
        kind: w.kind,
      })),
    )
    .onConflict('code')
    .ignore();

  await knex('settings').insert(SETTINGS).onConflict('key').ignore();
}

export async function down(knex: Knex): Promise<void> {
  await knex('settings').whereIn('key', SETTINGS.map((s) => s.key)).del();
  await knex('warehouses').whereIn('code', WAREHOUSES.map((w) => w.code)).del();
  await knex('branches').whereIn('code', BRANCHES.map((b) => b.code)).del();
  await knex('roles').whereIn('key', ROLES.map((r) => r.key)).del();
}
