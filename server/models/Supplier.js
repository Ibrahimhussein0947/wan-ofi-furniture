const mongoose = require('mongoose');
const softDelete = require('./plugins/softDelete');

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    contactPerson: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    email: { type: String, lowercase: true, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 300 },
    materialsSupplied: [{ type: String, trim: true, maxlength: 60 }],
    paymentTerms: { type: String, trim: true, maxlength: 120 },
    // Amount the company owes this supplier; changed only by received purchases and supplier payments.
    balance: { type: Number, default: 0 },
    notes: { type: String, maxlength: 2000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.index({ name: 1 });
supplierSchema.plugin(softDelete);

module.exports = mongoose.model('Supplier', supplierSchema);
