const { z, email, password, phone, address, trimmed } = require('./common');

const register = z.object({
  name: trimmed(120).min(2, 'Name is required'),
  email,
  phone,
  password,
  address,
});

const login = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});

const changePassword = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});

const forgotPassword = z.object({ email });
const changeEmail = z.object({ email, currentPassword: z.string().min(1, 'Enter your current password').max(128) });
const resetPassword = z.object({ token: z.string().regex(/^[a-f\d]{64}$/, 'Invalid reset link'), password });
const verifyEmail = z.object({ token: z.string().regex(/^[a-f\d]{64}$/, 'Invalid verification link') });

const updateProfile = z.object({
  name: trimmed(120).min(2).optional(),
  phone,
  address,
  company: trimmed(120).optional(),
  notificationPrefs: z.object({ email: z.boolean(), sms: z.boolean(), telegram: z.boolean(), whatsapp: z.boolean() }).partial().optional(),
});

module.exports = { register, login, changePassword, changeEmail, updateProfile, forgotPassword, resetPassword, verifyEmail };
