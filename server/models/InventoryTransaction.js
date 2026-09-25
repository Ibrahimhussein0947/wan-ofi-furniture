const mongoose = require('mongoose');
const { INVENTORY_TX_TYPES } = require('../config/constants');

// Immutable ledger: every stock movement for products and materials is recorded here.
const inventoryTransactionSchema = new mongoose.Schema(
  {
    itemType: { type: String, enum: ['PRODUCT', 'MATERIAL'], required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material' },
    type: { type: String, enum: Object.values(INVENTORY_TX_TYPES), required: true, index: true },
    // Signed change: positive adds stock, negative removes it.
    quantity: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    unitCost: { type: Number, min: 0 },
    referenceModel: { type: String, enum: ['Order', 'PurchaseOrder', 'ProductionJob', null] },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    referenceNumber: String,
    note: { type: String, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

inventoryTransactionSchema.index({ product: 1, createdAt: -1 });
inventoryTransactionSchema.index({ material: 1, createdAt: -1 });
inventoryTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
