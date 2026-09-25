const mongoose = require('mongoose');
const { QC_STATUS, QC_CHECK_ITEMS } = require('../config/constants');

const checkResultSchema = new mongoose.Schema(
  {
    passed: { type: Boolean, default: null },
    note: { type: String, maxlength: 500 },
  },
  { _id: false }
);

const checklistDefinition = Object.fromEntries(QC_CHECK_ITEMS.map((item) => [item, { type: checkResultSchema, default: () => ({}) }]));

const qualityCheckSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionJob', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    attempt: { type: Number, default: 1 },
    inspector: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checklist: checklistDefinition,
    status: { type: String, enum: Object.values(QC_STATUS), default: QC_STATUS.PENDING, index: true },
    notes: { type: String, maxlength: 2000 },
    images: [String],
    inspectedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('QualityCheck', qualityCheckSchema);
