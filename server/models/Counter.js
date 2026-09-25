const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Generates human-readable document numbers such as WO-2026-0012.
 * Runs outside any transaction on purpose: a gap in numbering is acceptable,
 * a write conflict on the counter document is not.
 */
async function nextNumber(prefix, { yearly = true, pad = 4 } = {}) {
  const year = new Date().getFullYear();
  const key = yearly ? `${prefix}-${year}` : prefix;
  const { seq } = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${key}-${String(seq).padStart(pad, '0')}`;
}

module.exports = Counter;
module.exports.nextNumber = nextNumber;
