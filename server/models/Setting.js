const mongoose = require('mongoose');

// Single-document business configuration, editable by the owner.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    companyName: { type: String, default: 'Wan Ofi Furniture' },
    companyEmail: { type: String, default: 'info@wanofi.com' },
    companyPhone: { type: String, default: '+255 700 000 000' },
    companyAddress: { type: String, default: 'Dar es Salaam, Tanzania' },
    currency: { type: String, default: 'TZS' },
    // Used when grouping reports by day/week/month.
    timezone: { type: String, default: 'Africa/Dar_es_Salaam' },
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
    paymentInstructions: {
      type: String,
      default: 'Bank: CRDB Bank, Account: 0150-000000-00, Name: Wan Ofi Furniture Ltd. Mobile: M-Pesa Lipa 000000.',
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
