const mongoose = require('mongoose');

/**
 * An online (mobile-money) payment attempt. Money only reaches the order when the
 * provider confirms it through the webhook; the intent records every step.
 */
const paymentIntentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'TZS' },
    gateway: { type: String, enum: ['sandbox', 'azampay'], required: true },
    network: { type: String, enum: ['MPESA', 'TIGO', 'AIRTEL', 'HALOPESA', 'AZAMPESA'], required: true },
    phone: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'], default: 'PENDING', index: true },
    providerReference: String,
    failureReason: String,
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    callbackPayload: mongoose.Schema.Types.Mixed,
    completedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
