const mongoose = require('mongoose');
const { PURCHASE_STATUS, PAYMENT_STATUS } = require('../config/constants');

const purchaseItemSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  materialName: String,
  quantity: { type: Number, required: true, min: 0.0001 },
  unitCost: { type: Number, required: true, min: 0 },
  receivedQuantity: { type: Number, default: 0, min: 0 },
});

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, unique: true, required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    items: { type: [purchaseItemSchema], validate: (v) => v.length > 0 },
    total: { type: Number, required: true, min: 0 },
    // Value of goods actually received — this is what the supplier is owed.
    receivedValue: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: Object.values(PURCHASE_STATUS), default: PURCHASE_STATUS.ORDERED, index: true },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.UNPAID },
    orderDate: { type: Date, default: Date.now },
    expectedDate: Date,
    receivedDate: Date,
    notes: { type: String, maxlength: 2000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
