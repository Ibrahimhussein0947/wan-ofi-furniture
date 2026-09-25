const mongoose = require('mongoose');
const softDelete = require('./plugins/softDelete');

/**
 * A showroom or workshop location. Orders, expenses and staff belong to a branch so
 * sales and costs can be reported per location. Stock is shared company-wide.
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
