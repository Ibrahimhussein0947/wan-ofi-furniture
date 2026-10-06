const { Worker, WorkerDocument, ProductionJob, Payment, User } = require('../models');
const { audit, actorFrom, diff } = require('../services/audit.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, pickFilters, escapeRegex } = require('../utils/query');
const { assertFound } = require('./helpers');
const { AUDIT_ACTIONS, PRODUCTION_STAGES: S } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const userService = require('../services/user.service');

const CLOSED = [S.READY_FOR_DELIVERY, S.DELIVERED, S.CANCELLED];

exports.list = asyncHandler(async (req, res) => {
  const filter = pickFilters(req.query, ['position']);
  if (req.query.isActive) filter.isActive = req.query.isActive === 'true';
  if (req.query.search) {
    const users = await User.find({ role: 'WORKER', name: new RegExp(escapeRegex(req.query.search), 'i') }).select('_id').lean();
    filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { employeeCode: new RegExp(escapeRegex(req.query.search), 'i') }];
  }
  const { items, pagination } = await paginate(Worker, filter, req.query, {
    populate: { path: 'user', select: 'name email phone isActive lastLoginAt workerRole' },
    allowedSort: ['employeeCode', 'position', 'createdAt'],
  });
  const workload = await ProductionJob.aggregate([
    { $match: { assignedWorkers: { $in: items.map((w) => w.user?._id).filter(Boolean) }, stage: { $nin: CLOSED } } },
    { $unwind: '$assignedWorkers' },
    { $group: { _id: '$assignedWorkers', activeJobs: { $sum: 1 } } },
  ]);
  const byUser = new Map(workload.map((w) => [String(w._id), w.activeJobs]));
  sendSuccess(res, { data: items.map((w) => ({ ...w, activeJobs: byUser.get(String(w.user?._id)) || 0 })), pagination });
});

exports.get = asyncHandler(async (req, res) => {
  const worker = assertFound(await Worker.findById(req.params.id).populate('user', 'name email phone isActive lastLoginAt').lean(), 'Worker not found.');
  const [jobs, payments, performance] = await Promise.all([
    ProductionJob.find({ assignedWorkers: worker.user._id }).sort({ updatedAt: -1 }).limit(30).select('jobNumber title stage progress expectedCompletionDate actualCompletionDate reworkCount').lean(),
    Payment.find({ worker: worker._id })
      .sort({ paidAt: -1 })
      .limit(200)
      .select('paymentNumber receiptNumber paidAt amount method kind notes reference payPeriod receivedBy')
      .populate('receivedBy', 'name')
      .lean(),
    ProductionJob.aggregate([
      { $match: { assignedWorkers: worker.user._id, stage: { $ne: S.CANCELLED } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $in: ['$stage', CLOSED] }, 0, 1] } },
          completed: { $sum: { $cond: [{ $in: ['$stage', [S.READY_FOR_DELIVERY, S.DELIVERED]] }, 1, 0] } },
          onTime: {
            $sum: { $cond: [{ $and: [{ $ne: ['$actualCompletionDate', null] }, { $lte: ['$actualCompletionDate', '$expectedCompletionDate'] }] }, 1, 0] },
          },
          reworks: { $sum: '$reworkCount' },
        },
      },
    ]),
  ]);
  const p = performance[0] || { total: 0, active: 0, completed: 0, onTime: 0, reworks: 0 };
  sendSuccess(res, {
    data: {
      ...worker,
      jobs,
      payments,
      performance: { ...p, _id: undefined, onTimeRate: p.completed ? Math.round((p.onTime / p.completed) * 100) : null },
    },
  });
});

/** Removes a worker: their login is disabled and they leave the active team; payments and work history stay. */
exports.remove = asyncHandler(async (req, res) => {
  const worker = await Worker.findById(req.params.id).select('user').lean();
  if (!worker) throw ApiError.notFound('Worker not found.');
  const activeJobs = await ProductionJob.countDocuments({ assignedWorkers: worker.user, stage: { $nin: CLOSED } });
  if (activeJobs) throw ApiError.conflict(`This worker is on ${activeJobs} unfinished production job(s). Reassign those jobs first.`);
  await userService.deleteUser(worker.user, actorFrom(req));
  sendSuccess(res, { message: 'Worker removed' });
});

exports.update = asyncHandler(async (req, res) => {
  const worker = assertFound(await Worker.findById(req.params.id), 'Worker not found.');
  const before = worker.toObject();
  Object.assign(worker, req.body);
  await worker.save();
  const userChanges = {};
  if (req.body.position) userChanges.workerRole = req.body.position;
  if (req.body.isActive !== undefined) userChanges.isActive = req.body.isActive;
  if (Object.keys(userChanges).length) await User.updateOne({ _id: worker.user }, { $set: userChanges });
  await audit(actorFrom(req), {
    action: req.body.position && req.body.position !== before.position ? AUDIT_ACTIONS.PERMISSION_CHANGE : AUDIT_ACTIONS.UPDATE,
    entity: 'Worker',
    entityId: worker._id,
    reference: worker.employeeCode,
    changes: diff(before, worker.toObject(), ['position', 'wageType', 'wageRate', 'taxRate', 'isActive', 'skills']),
  });
  sendSuccess(res, { data: worker, message: 'Worker updated' });
});

// ── Worker documents ────────────────────────────────────────────────────

const DOC_FIELDS = 'title category fileName mimetype size notes uploadedBy createdAt';

async function workerOr404(id) {
  const worker = await Worker.findById(id).select('employeeCode').lean();
  if (!worker) throw ApiError.notFound('Worker not found.');
  return worker;
}

exports.listDocuments = asyncHandler(async (req, res) => {
  await workerOr404(req.params.id);
  const docs = await WorkerDocument.find({ worker: req.params.id }).select(DOC_FIELDS).populate('uploadedBy', 'name').sort({ createdAt: -1 }).lean();
  sendSuccess(res, { data: docs });
});

exports.uploadDocument = asyncHandler(async (req, res) => {
  const worker = await workerOr404(req.params.id);
  const { originalname, mimetype, size, buffer } = req.file;
  const doc = await WorkerDocument.create({
    worker: worker._id,
    ...req.body,
    // Keep only a safe display name; the stored file is never written to disk under this name.
    fileName: originalname.replace(/[^\w.\- ()]/g, '_').slice(-200),
    mimetype,
    size,
    data: buffer,
    uploadedBy: req.user._id,
  });
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.CREATE,
    entity: 'Worker',
    entityId: worker._id,
    reference: worker.employeeCode,
    description: `Uploaded document "${doc.title}" (${doc.category.toLowerCase()})`,
  });
  const { data: _file, ...rest } = doc.toObject();
  sendCreated(res, rest, 'Document uploaded');
});

/** Sends the file to authorised staff only; `?download=1` saves it instead of opening it. */
exports.documentFile = asyncHandler(async (req, res) => {
  // Not lean: Mongoose turns the stored binary back into a Buffer.
  const doc = await WorkerDocument.findOne({ _id: req.params.docId, worker: req.params.id }).select('+data fileName mimetype');
  if (!doc) throw ApiError.notFound('Document not found.');
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.set({
    'Content-Type': doc.mimetype,
    'Content-Length': doc.data.length,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(doc.data);
});

exports.removeDocument = asyncHandler(async (req, res) => {
  const worker = await workerOr404(req.params.id);
  const doc = await WorkerDocument.findOneAndDelete({ _id: req.params.docId, worker: worker._id }).select('title').lean();
  if (!doc) throw ApiError.notFound('Document not found.');
  await audit(actorFrom(req), {
    action: AUDIT_ACTIONS.DELETE,
    entity: 'Worker',
    entityId: worker._id,
    reference: worker.employeeCode,
    description: `Deleted document "${doc.title}"`,
  });
  sendSuccess(res, { message: 'Document deleted' });
});
