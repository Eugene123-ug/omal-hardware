const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

const mfaVerifySchema = z.object({
  temp_token: z.string().min(1, 'Temporary MFA token is required'),
  code: z.string().min(4, 'MFA code or recovery code is required')
});

const mfaEnableSchema = z.object({
  secret: z.string().min(10, 'MFA secret is required'),
  code: z.string().min(6, 'Verification code is required')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  new_password: z.string().min(6, 'New password must be at least 6 characters')
});

const verifyPinSchema = z.object({
  pin: z.string().min(4, 'PIN must be at least 4 digits').max(10, 'PIN cannot exceed 10 digits')
});

module.exports = {
  loginSchema,
  mfaVerifySchema,
  mfaEnableSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyPinSchema
};
