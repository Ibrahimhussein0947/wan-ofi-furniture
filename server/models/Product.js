const mongoose = require('mongoose');
const softDelete = require('./plugins/softDelete');
const { PRODUCT_STATUS } = require('../config/constants');

const dimensionsSchema = new mongoose.Schema(
  {
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    length: { type: Number, min: 0 },
    depth: { type: Number, min: 0 },
    unit: { type: String, enum: ['cm', 'm', 'in', 'ft', 'mm'], default: 'cm' },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    sku: { type: String, required: true, uppercase: true, trim: true, maxlength: 40 },
    slug: { type: String, lowercase: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    description: { type: String, maxlength: 5000 },
    images: [{ type: String }],
    // List price shown crossed out when a lower sellingPrice applies.
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    soldQuantity: { type: Number, default: 0, min: 0 },
    damagedQuantity: { type: Number, default: 0, min: 0 },
    materials: [{ type: String, trim: true, maxlength: 60 }],
    dimensions: dimensionsSchema,
    colors: [{ type: String, trim: true, maxlength: 40 }],
    sizes: [{ type: String, trim: true, maxlength: 40 }],
    productionTimeDays: { type: Number, min: 0, default: 7 },
    status: { type: String, enum: Object.values(PRODUCT_STATUS), default: PRODUCT_STATUS.ACTIVE, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    // Made-to-order products can be ordered even when out of stock.
    madeToOrder: { type: Boolean, default: true },
    rating: { type: Number, min: 0, max: 5, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.index({ sku: 1 }, { unique: true, partialFilterExpression: { deletedAt: { $type: 'null' } } });
productSchema.index({ name: 'text', description: 'text', sku: 'text' });
productSchema.index({ sellingPrice: 1 });
productSchema.virtual('isLowStock').get(function isLowStock() {
  return this.quantity <= this.minStock;
});
productSchema.plugin(softDelete);

module.exports = mongoose.model('Product', productSchema);
module.exports.dimensionsSchema = dimensionsSchema;
