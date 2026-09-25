const mongoose = require('mongoose');
const orderItemSchema = require('./OrderItem');
const { addressSchema } = require('./Customer');
const {
  ORDER_STATUS,
  PAYMENT_STATUS,
  DELIVERY_STATUS,
  DELIVERY_METHODS,
  PRODUCTION_STAGES,
} = require('../config/constants');

const statusHistorySchema = new mongoose.Schema(
  {
    status: String,
    note: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    orderType: { type: String, enum: ['STANDARD', 'CUSTOM'], default: 'STANDARD' },
    customRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomFurnitureRequest', default: null },
    items: { type: [orderItemSchema], validate: [(v) => v.length > 0, 'An order needs at least one item.'] },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    // Tax rate in force when the order was placed, so later setting changes don't alter it.
    taxRate: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    depositRequired: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.UNPAID, index: true },
    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PENDING, index: true },
    productionStatus: { type: String, enum: [...Object.values(PRODUCTION_STAGES), 'NOT_REQUIRED'], default: 'PENDING' },
    deliveryStatus: { type: String, enum: Object.values(DELIVERY_STATUS), default: DELIVERY_STATUS.PENDING },
    deliveryMethod: { type: String, enum: Object.values(DELIVERY_METHODS), default: DELIVERY_METHODS.DELIVERY },
    deliveryAddress: addressSchema,
    contactPhone: String,
    orderDate: { type: Date, default: Date.now, index: true },
    expectedCompletionDate: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    notes: { type: String, maxlength: 2000 },
    internalNotes: { type: String, maxlength: 2000 },
    source: { type: String, enum: ['ONLINE', 'STAFF'], default: 'ONLINE' },
    statusHistory: [statusHistorySchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, orderDate: -1 });
orderSchema.index({ customer: 1, orderDate: -1 });
orderSchema.index({ balance: 1 });

module.exports = mongoose.model('Order', orderSchema);
