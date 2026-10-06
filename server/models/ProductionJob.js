const mongoose = require('mongoose');
const { PRODUCTION_STAGES, QC_STATUS, PRIORITIES } = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

const requiredMaterialSchema = new mongoose.Schema(
  {
    material: { type: ObjectId, ref: 'Material', required: true },
    name: String,
    unit: String,
    quantityRequired: { type: Number, required: true, min: 0 },
    quantityIssued: { type: Number, default: 0, min: 0 },
    quantityReturned: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 2000 },
  by: { type: ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now },
});

const problemSchema = new mongoose.Schema({
  description: { type: String, required: true, maxlength: 2000 },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  reportedBy: { type: ObjectId, ref: 'User' },
  reportedAt: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolvedBy: { type: ObjectId, ref: 'User' },
  resolvedAt: Date,
  resolution: String,
});

const materialRequestSchema = new mongoose.Schema({
  material: { type: ObjectId, ref: 'Material', required: true },
  quantity: { type: Number, required: true, min: 0.0001 },
  reason: { type: String, maxlength: 500 },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'ISSUED'], default: 'PENDING' },
  requestedBy: { type: ObjectId, ref: 'User' },
  requestedAt: { type: Date, default: Date.now },
  handledBy: { type: ObjectId, ref: 'User' },
  handledAt: Date,
});

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  caption: String,
  stage: String,
  by: { type: ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now },
});

const productionJobSchema = new mongoose.Schema(
  {
    jobNumber: { type: String, unique: true, required: true },
    order: { type: ObjectId, ref: 'Order', required: true, index: true },
    orderItemId: { type: ObjectId },
    customer: { type: ObjectId, ref: 'Customer', required: true },
    product: { type: ObjectId, ref: 'Product', default: null },
    customRequest: { type: ObjectId, ref: 'CustomFurnitureRequest', default: null },
    title: { type: String, required: true, maxlength: 200 },
    quantity: { type: Number, required: true, min: 1 },
    specifications: {
      color: String,
      size: String,
      material: String,
      fabric: String,
      dimensions: { type: mongoose.Schema.Types.Mixed },
      options: String,
    },
    instructions: { type: String, maxlength: 5000 },
    assignedWorkers: [{ type: ObjectId, ref: 'User', index: true }],
    supervisor: { type: ObjectId, ref: 'User', default: null },
    requiredMaterials: [requiredMaterialSchema],
    stage: { type: String, enum: Object.values(PRODUCTION_STAGES), default: PRODUCTION_STAGES.PENDING, index: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    priority: { type: String, enum: Object.values(PRIORITIES), default: PRIORITIES.NORMAL },
    startDate: Date,
    expectedCompletionDate: { type: Date, index: true },
    actualCompletionDate: Date,
    qcStatus: { type: String, enum: Object.values(QC_STATUS), default: QC_STATUS.PENDING },
    reworkCount: { type: Number, default: 0 },
    notes: [noteSchema],
    images: [imageSchema],
    problems: [problemSchema],
    materialRequests: [materialRequestSchema],
    stageHistory: [
      {
        _id: false,
        from: String,
        to: String,
        by: { type: ObjectId, ref: 'User' },
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
    // Hours each worker spent on the job (feeds hourly pay and labour costing).
    laborLog: [
      {
        worker: { type: ObjectId, ref: 'User', required: true },
        hours: { type: Number, required: true, min: 0.25, max: 24 },
        date: { type: Date, default: Date.now },
        note: { type: String, maxlength: 300 },
        by: { type: ObjectId, ref: 'User' },
      },
    ],
    delayNotifiedAt: Date,
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

productionJobSchema.index({ stage: 1, expectedCompletionDate: 1 });

module.exports = mongoose.model('ProductionJob', productionJobSchema);
