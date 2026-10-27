/**
 * Migration: Phase 8, 9, 10 - Finance Records, Expenses, Cash Reconciliation,
 * Staff Management, Approval Workflows, Enhanced Audit Trail & Analytics
 */

exports.up = async function(knex) {
  // 1. Enhance EXPENSES table
  const hasExpensesApproval = await knex.schema.hasColumn('expenses', 'approval_status');
  if (!hasExpensesApproval) {
    await knex.schema.alterTable('expenses', (table) => {
      table.string('approval_status', 50).defaultTo('approved'); // pending, approved, rejected
      table.integer('approved_by_id').unsigned().references('id').inTable('users').nullable();
      table.timestamp('approved_at').nullable();
      table.text('rejection_reason').nullable();
      table.string('payment_method', 50).defaultTo('CASH'); // CASH, BANK, MOMO, CHEQUE
      table.string('reference_no', 100).nullable();
      table.date('expense_date').defaultTo(knex.fn.now());
      table.text('supporting_document_url').nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['approval_status']);
      table.index(['category']);
      table.index(['expense_date']);
    });
  }

  // 2. Enhance DAILY_CASH_CLOSINGS table
  const hasShiftStatus = await knex.schema.hasColumn('daily_cash_closings', 'shift_status');
  if (!hasShiftStatus) {
    await knex.schema.alterTable('daily_cash_closings', (table) => {
      table.string('shift_status', 50).defaultTo('closed'); // open, closed, reconciled
      table.timestamp('opened_at').nullable();
      table.timestamp('closed_at').nullable();
      table.integer('reconciled_by_id').unsigned().references('id').inTable('users').nullable();
      table.decimal('cash_refunds', 12, 2).defaultTo(0);
      table.decimal('cash_collections', 12, 2).defaultTo(0);
      table.decimal('cash_drops', 12, 2).defaultTo(0);
      table.text('explanation').nullable();

      table.index(['closing_date']);
      table.index(['shift_status']);
    });
  }

  // 3. Create CASH_MOVEMENTS table (Intra-shift cash float drops and pay-outs)
  const hasCashMovements = await knex.schema.hasTable('cash_movements');
  if (!hasCashMovements) {
    await knex.schema.createTable('cash_movements', (table) => {
      table.increments('id').primary();
      table.integer('closing_id').unsigned().references('id').inTable('daily_cash_closings').onDelete('CASCADE').nullable();
      table.integer('staff_id').unsigned().references('id').inTable('users').notNullable();
      table.integer('authorized_by_id').unsigned().references('id').inTable('users').nullable();
      table.string('movement_type', 50).notNullable(); // FLOAT_IN, CASH_DROP, PAY_OUT
      table.decimal('amount', 12, 2).notNullable();
      table.text('reason').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['closing_id']);
      table.index(['staff_id']);
      table.index(['movement_type']);
    });
  }

  // 4. Create BANK_RECONCILIATIONS table
  const hasBankRecon = await knex.schema.hasTable('bank_reconciliations');
  if (!hasBankRecon) {
    await knex.schema.createTable('bank_reconciliations', (table) => {
      table.increments('id').primary();
      table.string('account_name', 100).notNullable();
      table.date('statement_date').notNullable();
      table.decimal('statement_balance', 14, 2).notNullable();
      table.decimal('book_balance', 14, 2).notNullable();
      table.decimal('unreconciled_difference', 14, 2).defaultTo(0);
      table.integer('reconciled_by_id').unsigned().references('id').inTable('users').notNullable();
      table.string('status', 50).defaultTo('reconciled'); // pending, reconciled
      table.text('notes').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['statement_date']);
      table.index(['account_name']);
    });
  }

  // 5. Enhance USERS table for Employee Management
  const hasStaffCode = await knex.schema.hasColumn('users', 'staff_code');
  if (!hasStaffCode) {
    await knex.schema.alterTable('users', (table) => {
      table.string('staff_code', 50).nullable().unique();
      table.string('job_title', 100).nullable();
      table.string('employment_status', 50).defaultTo('active'); // active, probation, on_leave, terminated
      table.date('hired_date').nullable();
      table.string('emergency_contact', 100).nullable();

      table.index(['staff_code']);
      table.index(['employment_status']);
    });
  }

  // 6. Create APPROVAL_REQUESTS table (Centralized Multi-Tier Workflow Queue)
  const hasApprovalRequests = await knex.schema.hasTable('approval_requests');
  if (!hasApprovalRequests) {
    await knex.schema.createTable('approval_requests', (table) => {
      table.increments('id').primary();
      table.string('request_type', 50).notNullable(); // DISCOUNT, REFUND, PRICE_CHANGE, STOCK_ADJUSTMENT, EXPENSE, CREDIT_OVERRIDE
      table.integer('reference_id').nullable();
      table.string('reference_table', 50).nullable();
      table.decimal('amount', 12, 2).nullable();
      table.text('reason').notNullable();
      table.integer('requester_id').unsigned().references('id').inTable('users').notNullable();
      table.integer('approver_id').unsigned().references('id').inTable('users').nullable();
      table.string('status', 50).defaultTo('pending'); // pending, approved, rejected
      table.text('decision_notes').nullable();
      table.timestamp('decided_at').nullable();
      table.jsonb('metadata').nullable();
      table.timestamps(true, true);

      table.index(['request_type']);
      table.index(['status']);
      table.index(['requester_id']);
    });
  }

  // 7. Enhance AUDIT_LOGS table for Append-Only Tamper-Evident Trail
  const hasAffectedTable = await knex.schema.hasColumn('audit_logs', 'affected_table');
  if (!hasAffectedTable) {
    await knex.schema.alterTable('audit_logs', (table) => {
      table.string('affected_table', 50).nullable();
      table.integer('affected_id').nullable();
      table.jsonb('before_values').nullable();
      table.jsonb('after_values').nullable();
      table.string('transaction_reference', 100).nullable();

      table.index(['affected_table']);
    });
  }

  // 8. Register new Granular Permissions
  const newPermissions = [
    { name: 'finance.reconcile', module: 'finance', description: 'Reconcile bank accounts, statements and cash registers' },
    { name: 'finance.approve_expense', module: 'finance', description: 'Authorize operational expenses and petty cash' },
    { name: 'approvals.view', module: 'approvals', description: 'View centralized pending approvals queue' },
    { name: 'approvals.decide', module: 'approvals', description: 'Approve or reject queued authorization requests' },
    { name: 'reports.growth', module: 'reports', description: 'View business growth, trends, and MoM/YoY analytics' }
  ];

  for (const perm of newPermissions) {
    const existing = await knex('permissions').where({ name: perm.name }).first();
    let permId;
    if (!existing) {
      const [inserted] = await knex('permissions').insert(perm).returning('*');
      permId = inserted.id;
    } else {
      permId = existing.id;
    }

    // Assign to super_admin and admin
    for (const role of ['super_admin', 'admin']) {
      const rolePerm = await knex('role_permissions').where({ role, permission_id: permId }).first();
      if (!rolePerm) {
        await knex('role_permissions').insert({ role, permission_id: permId });
      }
    }

    if (perm.name === 'finance.reconcile' || perm.name === 'finance.approve_expense') {
      const accPerm = await knex('role_permissions').where({ role: 'accountant', permission_id: permId }).first();
      if (!accPerm) {
        await knex('role_permissions').insert({ role: 'accountant', permission_id: permId });
      }
    }
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('bank_reconciliations');
  await knex.schema.dropTableIfExists('cash_movements');
  await knex.schema.dropTableIfExists('approval_requests');

  const hasStaffCode = await knex.schema.hasColumn('users', 'staff_code');
  if (hasStaffCode) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('emergency_contact');
      table.dropColumn('hired_date');
      table.dropColumn('employment_status');
      table.dropColumn('job_title');
      table.dropColumn('staff_code');
    });
  }

  const hasShiftStatus = await knex.schema.hasColumn('daily_cash_closings', 'shift_status');
  if (hasShiftStatus) {
    await knex.schema.alterTable('daily_cash_closings', (table) => {
      table.dropColumn('explanation');
      table.dropColumn('cash_drops');
      table.dropColumn('cash_collections');
      table.dropColumn('cash_refunds');
      table.dropColumn('reconciled_by_id');
      table.dropColumn('closed_at');
      table.dropColumn('opened_at');
      table.dropColumn('shift_status');
    });
  }

  const hasExpensesApproval = await knex.schema.hasColumn('expenses', 'approval_status');
  if (hasExpensesApproval) {
    await knex.schema.alterTable('expenses', (table) => {
      table.dropColumn('updated_at');
      table.dropColumn('supporting_document_url');
      table.dropColumn('expense_date');
      table.dropColumn('reference_no');
      table.dropColumn('payment_method');
      table.dropColumn('rejection_reason');
      table.dropColumn('approved_at');
      table.dropColumn('approved_by_id');
      table.dropColumn('approval_status');
    });
  }

  const hasAffectedTable = await knex.schema.hasColumn('audit_logs', 'affected_table');
  if (hasAffectedTable) {
    await knex.schema.alterTable('audit_logs', (table) => {
      table.dropColumn('transaction_reference');
      table.dropColumn('after_values');
      table.dropColumn('before_values');
      table.dropColumn('affected_id');
      table.dropColumn('affected_table');
    });
  }
};
