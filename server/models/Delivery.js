const mongoose = require('mongoose');
const { DELIVERY_STATUS } = require('../config/constants');
const { addressSchema } = require('./Customer');

const deliverySchema = new mongoose.Schema(
  {
    deliveryNumber: { type: String, unique: true, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    address: addressSchema,
    phone: String,
    scheduledDate: Date,
    deliveredAt: Date,
    deliveryPerson: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    vehicle: String,
    status: { type: String, enum: Object.values(DELIVERY_STATUS), default: DELIVERY_STATUS.PENDING, index: true },
    notes: { type: String, maxlength: 2000 },
    proofImages: [String],
    signatureImage: String,
    receivedBy: String,
    failureReason: String,
    history: [
      {
        _id: false,
        status: String,
        note: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Delivery', deliverySchema);
