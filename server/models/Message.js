const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    // Sorted pair of user ids, so both directions of a chat share one key.
    conversationKey: { type: String, required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, trim: true, maxlength: 4000, default: '' },
    attachments: [{ type: String }],
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: true }
);

messageSchema.index({ conversationKey: 1, createdAt: -1 });
messageSchema.statics.keyFor = (a, b) => [String(a), String(b)].sort().join(':');

module.exports = mongoose.model('Message', messageSchema);
