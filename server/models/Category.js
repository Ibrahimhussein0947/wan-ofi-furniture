const mongoose = require('mongoose');
const softDelete = require('./plugins/softDelete');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, maxlength: 1000 },
    image: String,
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deletedAt: { $type: 'null' } } });
categorySchema.plugin(softDelete);

module.exports = mongoose.model('Category', categorySchema);
