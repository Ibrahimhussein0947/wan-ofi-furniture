const mongoose = require('mongoose');
const softDelete = require('./plugins/softDelete');

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    region: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, maxlength: 20 },
  },
  { _id: false },
);

const customerSchema = new mongoose.Schema(
  {
    // Null for walk-in customers created by staff who never registered online.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    customerCode: { type: String, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, lowercase: true, trim: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 30 },
    address: addressSchema,
    company: { type: String, trim: true, maxlength: 120 },
    notes: { type: String, maxlength: 2000 },
    source: { type: String, enum: ['ONLINE', 'WALK_IN', 'REFERRAL', 'OTHER'], default: 'ONLINE' },
    // Saved favourites (newest first), capped by the wishlist service.
    wishlist: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    // The customer's own bank accounts, recorded by staff (used e.g. for refunds).
    bankAccounts: [
      {
        _id: false,
        bankName: { type: String, trim: true, maxlength: 120 },
        accountName: { type: String, trim: true, maxlength: 120 },
        accountNumber: { type: String, trim: true, maxlength: 60 },
        branch: { type: String, trim: true, maxlength: 120 },
        notes: { type: String, trim: true, maxlength: 300 },
      },
    ],
  },
  { timestamps: true },
);

customerSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } },
);
customerSchema.index({ name: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ email: 1 });
customerSchema.plugin(softDelete);

module.exports = mongoose.model('Customer', customerSchema);
module.exports.addressSchema = addressSchema;
