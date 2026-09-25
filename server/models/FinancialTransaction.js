const mongoose = require('mongoose');
const { TRANSACTION_TYPES, PAYMENT_METHODS } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

// The general ledger. Entries are never edited or deleted; corrections are new entries.
const financialTransactionSchema = new mongoose.Schema(
  {
    transactionNumber: { type: String, unique: true, required: true },
    type: { type: String, enum: Object.values(TRANSACTION_TYPES), required: true, index: true },
    direction: { type: String, enum: ['IN', 'OUT', 'NONE'], required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now, index: true },
    method: { type: String, enum: [...Object.values(PAYMENT_METHODS), null], default: null },
    customer: { type: ObjectId, ref: 'Customer', index: true },
    order: { type: ObjectId, ref: 'Order', index: true },
    supplier: { type: ObjectId, ref: 'Supplier' },
    worker: { type: ObjectId, ref: 'Worker' },
    payment: { type: ObjectId, ref: 'Payment' },
    expense: { type: ObjectId, ref: 'Expense' },
    purchaseOrder: { type: ObjectId, ref: 'PurchaseOrder' },
    category: String,
    description: { type: String, required: true, maxlength: 1000 },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

financialTransactionSchema.index({ direction: 1, date: -1 });

module.exports = mongoose.model('FinancialTransaction', financialTransactionSchema);
