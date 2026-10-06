const mongoose = require('mongoose');

/**
 * A promo code customers (or staff) enter at checkout. Usage is counted from the
 * non-cancelled orders that used it, so cancelling an order frees the use again.
 */
const promotionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 30 },
    description: { type: String, trim: true, maxlength: 300 },
    type: { type: String, enum: ['PERCENT', 'FIXED'], required: true },
    // Percent (1–100) or a fixed amount in the shop currency.
    value: { type: Number, required: true, min: 0 },
    // Caps a percentage discount (0 = no cap).
    maxDiscount: { type: Number, min: 0, default: 0 },
    minSubtotal: { type: Number, min: 0, default: 0 },
    startsAt: Date,
    endsAt: Date,
    // 0 = unlimited.
    usageLimit: { type: Number, min: 0, default: 0 },
    perCustomerLimit: { type: Number, min: 0, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

promotionSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('Promotion', promotionSchema);
