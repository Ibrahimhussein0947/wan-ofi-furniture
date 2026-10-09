const mongoose = require('mongoose');
const { PAYMENT_METHODS, PAYMENT_CATEGORIES } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

// A payment doubles as its receipt: receiptNumber is what the customer/supplier sees.
const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, unique: true, required: true },
    receiptNumber: { type: String, unique: true, sparse: true },
    category: {
      type: String,
      enum: Object.values(PAYMENT_CATEGORIES),
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: Object.values(PAYMENT_METHODS), required: true },
    reference: { type: String, trim: true, maxlength: 120 },
    order: { type: ObjectId, ref: 'Order', index: true },
    invoice: { type: ObjectId, ref: 'Invoice' },
    customer: { type: ObjectId, ref: 'Customer', index: true },
    supplier: { type: ObjectId, ref: 'Supplier', index: true },
    purchaseOrder: { type: ObjectId, ref: 'PurchaseOrder' },
    worker: { type: ObjectId, ref: 'Worker', index: true },
    kind: {
      type: String,
      enum: [
        'DEPOSIT',
        'INSTALLMENT',
        'FINAL',
        'FULL',
        'WAGE',
        'BONUS',
        'ADVANCE',
        'SUPPLIER',
        'REFUND',
      ],
    },
    // Payroll month (YYYY-MM) a worker payment covers.
    payPeriod: { type: String, match: /^\d{4}-\d{2}$/, index: true },
    paidAt: { type: Date, default: Date.now, index: true },
    notes: { type: String, maxlength: 1000 },
    receivedBy: { type: ObjectId, ref: 'User' },
    // Online payments submitted by customers wait for staff verification.
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING_VERIFICATION', 'REJECTED'],
      default: 'COMPLETED',
      index: true,
    },
    submittedByCustomer: { type: Boolean, default: false },
    // Share of the order total the customer chose to pay (10/25/50/75; 100 = the whole remaining balance).
    percent: { type: Number, min: 1, max: 100 },
    // Transfer receipt screenshot the customer uploaded with their payment proof.
    screenshot: { type: String, trim: true, maxlength: 300 },
    // Why staff rejected a customer-submitted payment (shown to the customer).
    rejectionReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Payment', paymentSchema);
