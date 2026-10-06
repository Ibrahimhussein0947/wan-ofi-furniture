const mongoose = require('mongoose');
const softDelete = require('./plugins/softDelete');

/**
 * A showroom or workshop location. Orders, expenses, staff and stock belong to a branch so
 * sales, costs and inventory can be managed per location.
 */
const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 12 },
    address: { type: String, trim: true, maxlength: 300 },
    phone: { type: String, trim: true, maxlength: 30 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

branchSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { deletedAt: { $type: 'null' } } });
branchSchema.plugin(softDelete);

module.exports = mongoose.model('Branch', branchSchema);
