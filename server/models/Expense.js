const mongoose = require('mongoose');
const softDelete = require('./plugins/softDelete');
const { EXPENSE_CATEGORIES, EXPENSE_STATUS, PAYMENT_METHODS } = require('../config/constants');

const expenseSchema = new mongoose.Schema(
  {
    expenseNumber: { type: String, unique: true, required: true },
    category: { type: String, enum: Object.values(EXPENSE_CATEGORIES), required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, default: Date.now, index: true },
    description: { type: String, required: true, maxlength: 1000 },
    vendor: { type: String, maxlength: 150 },
    method: { type: String, enum: Object.values(PAYMENT_METHODS), default: 'CASH' },
    reference: { type: String, maxlength: 120 },
    receiptImage: String,
    // Expenses above the configured threshold wait for owner approval before hitting the books.
    status: { type: String, enum: Object.values(EXPENSE_STATUS), default: EXPENSE_STATUS.APPROVED, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectionReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

expenseSchema.plugin(softDelete);

module.exports = mongoose.model('Expense', expenseSchema);
