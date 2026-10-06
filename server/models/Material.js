const mongoose = require('mongoose');
const softDelete = require('./plugins/softDelete');

const MATERIAL_CATEGORIES = ['WOOD', 'BOARD', 'FOAM', 'FABRIC', 'LEATHER', 'FINISH', 'ADHESIVE', 'HARDWARE', 'PACKAGING', 'OTHER'];

const materialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, uppercase: true, trim: true, maxlength: 40 },
    category: { type: String, enum: MATERIAL_CATEGORIES, default: 'OTHER', index: true },
    unit: { type: String, required: true, trim: true, maxlength: 20 },
    quantity: { type: Number, default: 0, min: 0 },
    // Stock held at each branch; `quantity` is the company-wide total and always equals their sum.
    branchStock: [{ _id: false, branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true }, quantity: { type: Number, default: 0, min: 0 } }],
    minStock: { type: Number, default: 0, min: 0 },
    // How much to buy when stock runs low (0 = top up to twice the minimum).
    reorderQuantity: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    purchaseDate: Date,
    expirationDate: Date,
    location: { type: String, trim: true, maxlength: 80 },
    notes: { type: String, maxlength: 1000 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

materialSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { deletedAt: { $type: 'null' }, code: { $type: 'string' } } });
materialSchema.index({ name: 1 });
materialSchema.virtual('isLowStock').get(function isLowStock() {
  return this.quantity <= this.minStock;
});
materialSchema.plugin(softDelete);

module.exports = mongoose.model('Material', materialSchema);
module.exports.MATERIAL_CATEGORIES = MATERIAL_CATEGORIES;
