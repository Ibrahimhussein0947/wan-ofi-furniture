const mongoose = require('mongoose');

/**
 * Order lines are embedded in their order (read together, written together, and kept
 * consistent in one atomic document write). The schema lives in its own module so
 * invoices and production can reuse the same shape.
 */
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  customRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomFurnitureRequest', default: null },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  sku: String,
  image: String,
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  unitCost: { type: Number, min: 0, default: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
  color: { type: String, maxlength: 40 },
  size: { type: String, maxlength: 40 },
  options: { type: String, maxlength: 500 },
  // STOCK = shipped from finished-goods inventory, PRODUCTION = built in the workshop.
  fulfillment: { type: String, enum: ['STOCK', 'PRODUCTION'], default: 'PRODUCTION' },
  stockDeducted: { type: Boolean, default: false },
  productionJob: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionJob', default: null },
});

module.exports = orderItemSchema;
