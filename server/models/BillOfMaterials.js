const mongoose = require('mongoose');

const bomItemSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    // Quantity needed to build ONE unit of the product.
    quantity: { type: Number, required: true, min: 0.0001 },
    wastePercent: { type: Number, min: 0, max: 100, default: 0 },
    notes: { type: String, maxlength: 300 },
  },
  { _id: false }
);

const billOfMaterialsSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    items: [bomItemSchema],
    laborHours: { type: Number, min: 0, default: 0 },
    notes: { type: String, maxlength: 2000 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BillOfMaterials', billOfMaterialsSchema);
