const { z } = require('zod');

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email address required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['super_admin', 'admin', 'sales', 'accountant']),
  admin_pin: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  branch: z.string().optional().default('Main Showroom'),
  staff_code: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  employment_status: z.enum(['active', 'probation', 'on_leave', 'terminated']).optional().default('active'),
  hired_date: z.string().optional().nullable(),
  emergency_contact: z.string().optional().nullable()
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['super_admin', 'admin', 'sales', 'accountant']).optional(),
  admin_pin: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  branch: z.string().optional(),
  status: z.enum(['active', 'inactive', 'locked']).optional(),
  password: z.string().min(6).optional(),
  staff_code: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  employment_status: z.enum(['active', 'probation', 'on_leave', 'terminated']).optional(),
  hired_date: z.string().optional().nullable(),
  emergency_contact: z.string().optional().nullable()
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'locked'])
});

const updatePermissionsSchema = z.object({
  permissions: z.array(z.object({
    permission: z.string(),
    granted: z.boolean()
  })).min(1, 'At least one permission must be specified')
});

const adminResetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters')
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  updatePermissionsSchema,
  adminResetPasswordSchema
};
