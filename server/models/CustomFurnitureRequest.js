const mongoose = require('mongoose');
const { CUSTOM_REQUEST_STATUS } = require('../config/constants');
const { dimensionsSchema } = require('./Product');

const customFurnitureRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, unique: true, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    furnitureType: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, maxlength: 5000 },
    dimensions: dimensionsSchema,
    preferredMaterial: { type: String, maxlength: 120 },
    preferredColor: { type: String, maxlength: 60 },
    fabric: { type: String, maxlength: 120 },
    designRequirements: { type: String, maxlength: 5000 },
    quantity: { type: Number, min: 1, default: 1 },
    budget: { type: Number, min: 0 },
    requiredDate: Date,
    referenceImages: [String],
    additionalNotes: { type: String, maxlength: 2000 },
    deliveryMethod: { type: String, enum: ['DELIVERY', 'PICKUP'], default: 'DELIVERY' },
    status: {
      type: String,
      enum: Object.values(CUSTOM_REQUEST_STATUS),
      default: CUSTOM_REQUEST_STATUS.SUBMITTED,
      index: true,
    },
    estimate: {
      materialCost: { type: Number, min: 0, default: 0 },
      laborCost: { type: Number, min: 0, default: 0 },
      otherCost: { type: Number, min: 0, default: 0 },
      totalCost: { type: Number, min: 0, default: 0 },
      productionDays: { type: Number, min: 0 },
      notes: String,
    },
    quotedPrice: { type: Number, min: 0 },
    depositRequired: { type: Number, min: 0 },
    quoteNotes: { type: String, maxlength: 2000 },
    quoteValidUntil: Date,
    customerResponseNote: { type: String, maxlength: 1000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    history: [
      {
        _id: false,
        status: String,
        note: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('CustomFurnitureRequest', customFurnitureRequestSchema);
