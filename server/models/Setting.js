const mongoose = require('mongoose');

// Single-document business configuration, editable by the owner.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    companyName: { type: String, default: 'Wan Ofi Furniture' },
    companyEmail: { type: String, default: 'info@wanofi.com' },
    companyPhone: { type: String, default: '+251 900 000 000' },
    companyAddress: { type: String, default: 'Addis Ababa, Ethiopia' },
    // Contact channels shown on the storefront; empty ones are hidden.
    // Facebook/Instagram: page link or username. Telegram: @username or t.me link. WhatsApp: phone number.
    socialLinks: {
      facebook: { type: String, trim: true, maxlength: 200, default: '' },
      telegram: { type: String, trim: true, maxlength: 200, default: '' },
      whatsapp: { type: String, trim: true, maxlength: 200, default: '' },
      instagram: { type: String, trim: true, maxlength: 200, default: '' },
    },
    currency: { type: String, default: 'ETB' },
    // Used when grouping reports by day/week/month.
    timezone: { type: String, default: 'Africa/Addis_Ababa' },
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
    depositPercent: { type: Number, min: 0, max: 100, default: 40 },
    largeExpenseThreshold: { type: Number, min: 0, default: 1000000 },
    allowOverpayment: { type: Boolean, default: false },
    // Customers must confirm their email before ordering online.
    requireEmailVerification: { type: Boolean, default: true },
    defaultBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    requireFullPaymentBeforeDelivery: { type: Boolean, default: true },
    defaultDeliveryFee: { type: Number, min: 0, default: 0 },
    invoiceDueDays: { type: Number, min: 0, default: 14 },
    // Warranty for custom-made pieces (catalogue products carry their own).
    customWarrantyMonths: { type: Number, min: 0, max: 120, default: 12 },
    paymentInstructions: {
      type: String,
      default: 'Bank: Commercial Bank of Ethiopia, Account: 0150-000000-00, Name: Wan Ofi Furniture Ltd. Mobile: Telebirr 000000.',
    },
    // Bank / mobile-money accounts the admin wants customers to transfer to.
    // Only active accounts are exposed to the storefront and invoices.
    bankAccounts: [
      {
        _id: false,
        type: { type: String, enum: ['BANK', 'MOBILE_WALLET'], default: 'BANK' },
        bankName: { type: String, trim: true, maxlength: 120 },
        accountName: { type: String, trim: true, maxlength: 120 },
        accountNumber: { type: String, trim: true, maxlength: 60 },
        branch: { type: String, trim: true, maxlength: 120 },
        notes: { type: String, trim: true, maxlength: 300 },
        isActive: { type: Boolean, default: true },
      },
    ],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
