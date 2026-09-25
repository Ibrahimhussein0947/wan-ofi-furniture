const mongoose = require('mongoose');
const softDelete = require('./plugins/softDelete');
const { WORKER_ROLES } = require('../config/constants');

const workerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeCode: { type: String, unique: true },
    position: { type: String, enum: Object.values(WORKER_ROLES), required: true, index: true },
    skills: [{ type: String, trim: true, maxlength: 60 }],
    phone: { type: String, trim: true, maxlength: 30 },
    hireDate: Date,
    wageType: { type: String, enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'PER_JOB'], default: 'MONTHLY' },
    wageRate: { type: Number, min: 0, default: 0 },
    // Running total of wages recorded as paid (updated with each worker payment).
    totalPaid: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    notes: { type: String, maxlength: 2000 },
  },
  { timestamps: true }
);

workerSchema.plugin(softDelete);

module.exports = mongoose.model('Worker', workerSchema);
