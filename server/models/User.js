const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const softDelete = require('./plugins/softDelete');
const { ROLES, WORKER_ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 30 },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true, index: true },
    workerRole: { type: String, enum: [...Object.values(WORKER_ROLES), null], default: null },
    // Extra permissions granted individually by the owner, on top of the role defaults.
    permissions: [{ type: String }],
    avatar: String,
    isActive: { type: Boolean, default: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    // Staff accounts are created verified; self-registered customers confirm by email.
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    notificationPrefs: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      telegram: { type: Boolean, default: true },
      // WhatsApp requires an explicit opt-in.
      whatsapp: { type: Boolean, default: false },
    },
    // Set when the user links their account to the Telegram bot.
    telegramChatId: { type: String, select: false },
    telegramLinkCode: { type: String, select: false, index: { sparse: true } },
    telegramLinkExpires: { type: Date, select: false },
    lastLoginAt: Date,
    passwordChangedAt: Date,
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deletedAt: { $type: 'null' } } });
userSchema.index({ name: 'text', email: 'text' });
userSchema.plugin(softDelete);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.failedLoginAttempts;
    delete ret.lockUntil;
    delete ret.emailVerificationTokenHash;
    delete ret.emailVerificationExpires;
    delete ret.passwordResetTokenHash;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
