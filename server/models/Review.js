const mongoose = require('mongoose');

/**
 * A customer's review of a product they received. One per customer per product;
 * staff can hide a review, which removes it from the product's average rating.
 */
const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    // The delivered order that made the customer eligible to review.
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    comment: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['PUBLISHED', 'HIDDEN'], default: 'PUBLISHED', index: true },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, customer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
