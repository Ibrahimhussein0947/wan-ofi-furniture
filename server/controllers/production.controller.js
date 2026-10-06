const { ProductionJob, ProductionTask, QualityCheck } = require('../models');
const production = require('../services/production.service');
const quality = require('../services/quality.service');
const { actorFrom } = require('../services/audit.service');
const notify = require('../services/notification.service');
const { asyncHandler, sendSuccess, sendCreated } = require('../utils/http');
const { paginate, searchFilter } = require('../utils/query');
const ApiError = require('../utils/ApiError');
const { assertFound } = require('./helpers');
const { ROLES } = require('../config/constants');

// ---------- Jobs ----------
exports.list = asyncHandler(async (req, res) => {
  const filter = { ...production.jobFilterFor(req.user, req.query), ...searchFilter(req.query.search, ['jobNumber', 'title']) };
  const { items, pagination } = await paginate(ProductionJob, filter, req.query, {
    populate: [
      { path: 'order', select: 'orderNumber' },
      { path: 'customer', select: 'name' },
      { path: 'assignedWorkers', select: 'name workerRole' },
    ],
    select: '-notes -stageHistory -images',
    allowedSort: ['expectedCompletionDate', 'createdAt', 'progress', 'jobNumber'],
    sort: { expectedCompletionDate: 1 },
  });
  sendSuccess(res, { data: items, pagination });
});

exports.board = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await production.getBoard(req.user, req.query) });
});

exports.get = asyncHandler(async (req, res) => {
  const job = await production.getJob(req.params.id, req.user);
  job.tasks = await ProductionTask.find({ job: job._id }).populate('assignedTo', 'name').sort({ dueDate: 1 }).lean();
  sendSuccess(res, { data: job });
});

exports.update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await production.updateJobDetails(req.params.id, req.body, actorFrom(req)), message: 'Job updated' });
});

exports.stage = asyncHandler(async (req, res) => {
  const job = await production.updateStage(req.params.id, req.body, actorFrom(req));
  sendSuccess(res, { data: job, message: `Moved to ${job.stage.replace(/_/g, ' ').toLowerCase()}` });
});

exports.assign = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await production.assignWorkers(req.params.id, req.body, actorFrom(req)), message: 'Workers assigned' });
});

exports.issueMaterials = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await production.issueMaterials(req.params.id, req.body, actorFrom(req)), message: 'Materials issued' });
});

exports.returnMaterials = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await production.returnMaterials(req.params.id, req.body, actorFrom(req)), message: 'Materials returned to stock' });
});

exports.requestMaterials = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await production.requestMaterials(req.params.id, req.body, actorFrom(req)), message: 'Material request sent to your supervisor' });
});

exports.handleMaterialRequest = asyncHandler(async (req, res) => {
  const job = await production.handleMaterialRequest(req.params.id, req.params.requestId, req.body, actorFrom(req));
  sendSuccess(res, { data: job, message: req.body.approve ? 'Request approved and materials issued' : 'Request rejected' });
});

exports.addNote = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await production.addNote(req.params.id, req.body.text, actorFrom(req)), message: 'Note added' });
});

exports.logHours = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await production.logHours(req.params.id, req.body, actorFrom(req)), message: 'Hours logged' });
});

exports.addImages = asyncHandler(async (req, res) => {
  if (!req.uploadedFiles?.length) throw ApiError.badRequest('Please attach at least one image.');
  sendSuccess(res, { data: await production.addImages(req.params.id, req.uploadedFiles, req.body.caption, actorFrom(req)), message: 'Images uploaded' });
});

exports.reportProblem = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await production.reportProblem(req.params.id, req.body, actorFrom(req)), message: 'Problem reported to your supervisor' });
});

exports.resolveProblem = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await production.resolveProblem(req.params.id, req.params.problemId, req.body.resolution, actorFrom(req)), message: 'Problem resolved' });
});

// ---------- Tasks ----------
exports.listTasks = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.job) filter.job = req.query.job;
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (!production.isManager(req.user) || req.query.mine === 'true') filter.assignedTo = req.user._id;
  const { items, pagination } = await paginate(ProductionTask, filter, req.query, {
    populate: [
      { path: 'job', select: 'jobNumber title stage' },
      { path: 'assignedTo', select: 'name workerRole' },
    ],
    sort: { dueDate: 1 },
  });
  sendSuccess(res, { data: items, pagination });
});

exports.createTask = asyncHandler(async (req, res) => {
  const job = assertFound(await ProductionJob.findById(req.body.job).lean(), 'Production job not found.');
  if (req.body.assignedTo && !job.assignedWorkers.map(String).includes(String(req.body.assignedTo))) {
    throw ApiError.badRequest('Assign the worker to the job before giving them tasks.');
  }
  const task = await ProductionTask.create({ ...req.body, createdBy: req.user._id });
  if (task.assignedTo) {
    await notify.notifyUsers([task.assignedTo], {
      type: 'JOB_ASSIGNED',
      title: `New task: ${task.title}`,
      message: `${job.jobNumber}${task.dueDate ? ` — due ${task.dueDate.toDateString()}` : ''}`,
      link: `/app/production/${job._id}`,
    });
  }
  sendCreated(res, task, 'Task created');
});

exports.updateTask = asyncHandler(async (req, res) => {
  const task = assertFound(await ProductionTask.findById(req.params.id), 'Task not found.');
  const manager = production.isManager(req.user);
  if (!manager) {
    if (String(task.assignedTo) !== String(req.user._id)) throw ApiError.forbidden('This task is not assigned to you.');
    const extra = Object.keys(req.body).filter((k) => !['status', 'hoursWorked'].includes(k) && req.body[k] !== undefined);
    if (extra.length) throw ApiError.forbidden('You can only update the status and hours of your tasks.');
  }
  Object.assign(task, req.body);
  if (req.body.status === 'IN_PROGRESS' && !task.startedAt) task.startedAt = new Date();
  if (req.body.status === 'DONE') task.completedAt = new Date();
  await task.save();
  sendSuccess(res, { data: task, message: 'Task updated' });
});

exports.deleteTask = asyncHandler(async (req, res) => {
  assertFound(await ProductionTask.findByIdAndDelete(req.params.id), 'Task not found.');
  sendSuccess(res, { message: 'Task deleted' });
});

// ---------- Quality control ----------
exports.listQuality = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  const { items, pagination } = await paginate(QualityCheck, filter, req.query, {
    populate: [
      { path: 'job', select: 'jobNumber title quantity specifications product assignedWorkers', populate: [{ path: 'assignedWorkers', select: 'name' }, { path: 'product', select: 'name dimensions' }] },
      { path: 'order', select: 'orderNumber' },
      { path: 'inspector', select: 'name' },
    ],
  });
  sendSuccess(res, { data: items, pagination });
});

exports.getQuality = asyncHandler(async (req, res) => {
  const qc = assertFound(
    await QualityCheck.findById(req.params.id)
      .populate({ path: 'job', populate: [{ path: 'product', select: 'name dimensions colors' }, { path: 'customRequest' }, { path: 'assignedWorkers', select: 'name' }] })
      .populate('order', 'orderNumber')
      .populate('inspector', 'name')
      .lean(),
    'Quality check not found.'
  );
  sendSuccess(res, { data: qc });
});

exports.inspect = asyncHandler(async (req, res) => {
  const { qc } = await quality.submitInspection(req.params.id, { ...req.body, images: req.uploadedFiles || [] }, actorFrom(req));
  sendSuccess(res, { data: qc, message: qc.status === 'PASSED' ? 'Passed — item is ready for delivery' : 'Sent back to production for rework' });
});

exports.myWorkload = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.WORKER) throw ApiError.forbidden();
  const jobs = await ProductionJob.find({ assignedWorkers: req.user._id, stage: { $nin: ['DELIVERED', 'CANCELLED'] } })
    .select('jobNumber title stage progress expectedCompletionDate priority')
    .sort({ expectedCompletionDate: 1 })
    .lean();
  sendSuccess(res, { data: jobs });
});
