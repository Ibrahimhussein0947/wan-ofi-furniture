const mongoose = require('mongoose');
const { TASK_STATUS, PRODUCTION_STAGES } = require('../config/constants');

const productionTaskSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionJob', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    stage: { type: String, enum: Object.values(PRODUCTION_STAGES) },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    status: { type: String, enum: Object.values(TASK_STATUS), default: TASK_STATUS.TODO, index: true },
    dueDate: Date,
    startedAt: Date,
    completedAt: Date,
    // Hours the worker logged on this task (used for hourly pay and productivity).
    hoursWorked: { type: Number, min: 0, max: 200 },
    deadlineNotifiedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProductionTask', productionTaskSchema);
