const { ProductionJob, BillOfMaterials, Order, Material, QualityCheck, User } = require('../models');
const { nextNumber } = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');
const { withTransaction } = require('../utils/transaction');
const { PRODUCTION_STAGES: S, ORDER_STATUS, AUDIT_ACTIONS, INVENTORY_TX_TYPES, ROLES } = require('../config/constants');
const { PERMISSIONS, hasPermission, canMoveToStage } = require('../config/permissions');
const { adjustStock, alertIfCrossed } = require('./inventory.service');
const { audit } = require('./audit.service');
const notify = require('./notification.service');

// Pipeline order used to compute progress and an order's overall production status.
const STAGE_ORDER = [
  S.PENDING,
  S.APPROVED,
  S.MATERIALS_REQUIRED,
  S.MATERIALS_READY,
  S.IN_PRODUCTION,
  S.ASSEMBLY,
  S.FINISHING,
  S.QUALITY_CHECK,
  S.READY_FOR_DELIVERY,
  S.DELIVERED,
];
const stageIndex = (stage) => STAGE_ORDER.indexOf(stage);

const STAGE_PROGRESS = {
  PENDING: 0,
  APPROVED: 5,
  MATERIALS_REQUIRED: 10,
  MATERIALS_READY: 20,
  IN_PRODUCTION: 40,
  ASSEMBLY: 60,
  FINISHING: 75,
  QUALITY_CHECK: 90,
  READY_FOR_DELIVERY: 100,
  DELIVERED: 100,
  CANCELLED: 0,
};

// Stage moves allowed through the generic stage endpoint.
// READY_FOR_DELIVERY is reached only by passing quality control; DELIVERED only via delivery.
const TRANSITIONS = {
  PENDING: [S.APPROVED, S.CANCELLED],
  APPROVED: [S.MATERIALS_REQUIRED, S.MATERIALS_READY, S.IN_PRODUCTION, S.CANCELLED],
  MATERIALS_REQUIRED: [S.MATERIALS_READY, S.CANCELLED],
  MATERIALS_READY: [S.IN_PRODUCTION, S.CANCELLED],
  IN_PRODUCTION: [S.ASSEMBLY, S.FINISHING, S.QUALITY_CHECK],
  ASSEMBLY: [S.IN_PRODUCTION, S.FINISHING, S.QUALITY_CHECK],
  FINISHING: [S.ASSEMBLY, S.QUALITY_CHECK],
  QUALITY_CHECK: [],
  READY_FOR_DELIVERY: [S.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

// Kanban columns shown on the production board.
const BOARD_COLUMNS = [
  { key: 'PENDING', title: 'Pending', stages: [S.PENDING, S.APPROVED] },
  { key: 'MATERIALS', title: 'Materials', stages: [S.MATERIALS_REQUIRED, S.MATERIALS_READY] },
  { key: 'PRODUCTION', title: 'Production', stages: [S.IN_PRODUCTION] },
  { key: 'ASSEMBLY', title: 'Assembly', stages: [S.ASSEMBLY] },
  { key: 'FINISHING', title: 'Finishing', stages: [S.FINISHING] },
  { key: 'QUALITY_CHECK', title: 'Quality Check', stages: [S.QUALITY_CHECK] },
  { key: 'READY', title: 'Ready', stages: [S.READY_FOR_DELIVERY] },
  { key: 'COMPLETED', title: 'Completed', stages: [S.DELIVERED] },
];

const PRODUCTION_STARTED_STAGES = [S.IN_PRODUCTION, S.ASSEMBLY, S.FINISHING, S.QUALITY_CHECK, S.READY_FOR_DELIVERY, S.DELIVERED];

const JOB_POPULATE = [
  { path: 'order', select: 'orderNumber status deliveryMethod expectedCompletionDate' },
  { path: 'customer', select: 'name phone' },
  { path: 'product', select: 'name sku images dimensions' },
  { path: 'assignedWorkers', select: 'name workerRole avatar' },
  { path: 'supervisor', select: 'name' },
  { path: 'requiredMaterials.material', select: 'name unit quantity' },
];

const isManager = (user) => hasPermission(user, PERMISSIONS.PRODUCTION_MANAGE);
const isAssigned = (job, user) => (job.assignedWorkers || []).some((w) => String(w._id || w) === String(user._id));

function assertJobAccess(job, user) {
  if (isManager(user) || user.role === ROLES.ACCOUNTANT) return;
  if (user.role === ROLES.WORKER && isAssigned(job, user)) return;
  throw ApiError.forbidden('This job is not assigned to you.');
}

function materialsFullyIssued(job) {
  return (job.requiredMaterials || []).every((m) => m.quantityIssued + 1e-9 >= m.quantityRequired);
}

async function computeRequiredMaterials(productId, quantity, session) {
  if (!productId) return [];
  const bom = await BillOfMaterials.findOne({ product: productId }).populate('items.material', 'name unit').session(session).lean();
  if (!bom) return [];
  return bom.items
    .filter((i) => i.material)
    .map((i) => ({
      material: i.material._id,
      name: i.material.name,
      unit: i.material.unit,
      quantityRequired: round2(i.quantity * quantity * (1 + (i.wastePercent || 0) / 100)),
      quantityIssued: 0,
    }));
}

/** Creates one production job per order line that must be built. */
async function createJobsForOrder(order, { session, actor, afterCommit }) {
  const jobs = [];
  for (const item of order.items) {
    if (item.fulfillment !== 'PRODUCTION' || item.productionJob) continue;
    const requiredMaterials = await computeRequiredMaterials(item.product, item.quantity, session);
    const [job] = await ProductionJob.create(
      [
        {
          jobNumber: await nextNumber('PJ'),
          order: order._id,
          orderItemId: item._id,
          customer: order.customer,
          product: item.product || null,
          customRequest: item.customRequest || null,
          title: `${item.name} × ${item.quantity}`,
          quantity: item.quantity,
          specifications: { color: item.color, size: item.size, options: item.options },
          requiredMaterials,
          stage: S.PENDING,
          expectedCompletionDate: order.expectedCompletionDate,
          stageHistory: [{ from: null, to: S.PENDING, by: actor?.user?._id, note: 'Created from order confirmation' }],
          createdBy: actor?.user?._id,
        },
      ],
      { session }
    );
    item.productionJob = job._id;
    jobs.push(job);
  }
  if (jobs.length && afterCommit) {
    afterCommit(() =>
      notify.notifySupervisors({
        type: 'PRODUCTION_UPDATE',
        title: `New production job${jobs.length > 1 ? 's' : ''} for ${order.orderNumber}`,
        message: jobs.map((j) => j.title).join(', '),
        link: '/app/production',
      })
    );
  }
  return jobs;
}

/** Recomputes an order's production status (and lifecycle status) from its jobs. */
async function syncOrderFromJobs(orderId, { session, actor, afterCommit }) {
  const order = await Order.findById(orderId).session(session);
  if (!order || order.status === ORDER_STATUS.CANCELLED) return order;
  const jobs = await ProductionJob.find({ order: orderId, stage: { $ne: S.CANCELLED } }).session(session).lean();
  if (!jobs.length) return order;

  const minIdx = Math.min(...jobs.map((j) => stageIndex(j.stage)));
  order.productionStatus = STAGE_ORDER[minIdx];

  const anyStarted = jobs.some((j) => PRODUCTION_STARTED_STAGES.includes(j.stage));
  const allReady = minIdx >= stageIndex(S.READY_FOR_DELIVERY);
  const byUser = actor?.user?._id;

  if (allReady && [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PAID, ORDER_STATUS.IN_PRODUCTION].includes(order.status)) {
    order.status = ORDER_STATUS.READY;
    order.statusHistory.push({ status: ORDER_STATUS.READY, note: 'All items passed quality control', changedBy: byUser });
    afterCommit?.(() =>
      notify.notifyCustomer(order.customer, {
        type: 'READY_FOR_DELIVERY',
        title: `Order ${order.orderNumber} is ready`,
        message:
          order.balance > 0
            ? `Your furniture is ready. Please settle the remaining balance to schedule ${order.deliveryMethod === 'PICKUP' ? 'pickup' : 'delivery'}.`
            : `Your furniture is ready for ${order.deliveryMethod === 'PICKUP' ? 'pickup' : 'delivery'}.`,
        link: `/account/orders/${order._id}`,
      })
    );
  } else if (anyStarted && [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PAID].includes(order.status)) {
    order.status = ORDER_STATUS.IN_PRODUCTION;
    order.statusHistory.push({ status: ORDER_STATUS.IN_PRODUCTION, note: 'Production started', changedBy: byUser });
  }
  await order.save({ session });
  return order;
}

function applyStage(job, to, { by, note }) {
  const from = job.stage;
  job.stage = to;
  job.progress = STAGE_PROGRESS[to];
  job.stageHistory.push({ from, to, by, note });
  if (to === S.IN_PRODUCTION && !job.startDate) job.startDate = new Date();
  if (to === S.READY_FOR_DELIVERY) job.actualCompletionDate = new Date();
  return from;
}

async function loadJob(jobId, session) {
  const job = await ProductionJob.findById(jobId).session(session);
  if (!job) throw ApiError.notFound('Production job not found.');
  return job;
}

async function updateStage(jobId, { stage: to, note }, actor) {
  const { user } = actor;
  return withTransaction(async (session, afterCommit) => {
    const job = await loadJob(jobId, session);
    assertJobAccess(job, user);
    const from = job.stage;

    if (from === to) throw ApiError.badRequest(`Job is already in ${to.replace(/_/g, ' ').toLowerCase()}.`);
    if (!(TRANSITIONS[from] || []).includes(to)) {
      const hint =
        to === S.READY_FOR_DELIVERY
          ? ' Items become ready only after passing quality control.'
          : to === S.DELIVERED
            ? ' Mark the delivery as delivered instead.'
            : '';
      throw ApiError.badRequest(`Cannot move a job from ${from} to ${to}.${hint}`);
    }
    if (!canMoveToStage(user, to)) {
      throw ApiError.forbidden(`Your role (${user.workerRole || user.role}) cannot move jobs to ${to}.`);
    }
    if (to === S.CANCELLED && !isManager(user)) throw ApiError.forbidden();
    if (to === S.IN_PRODUCTION && !materialsFullyIssued(job)) {
      throw ApiError.badRequest('Required materials have not been fully issued to this job yet.');
    }
    if (to === S.CANCELLED && (job.requiredMaterials || []).some((m) => m.quantityIssued - m.quantityReturned > 0)) {
      throw ApiError.badRequest('Return issued materials to stock before cancelling this job.');
    }

    applyStage(job, to, { by: user._id, note });
    if (to === S.QUALITY_CHECK) {
      job.qcStatus = 'PENDING';
      const attempt = (await QualityCheck.countDocuments({ job: job._id }).session(session)) + 1;
      await QualityCheck.create([{ job: job._id, order: job.order, attempt }], { session });
    }
    await job.save({ session });
    await syncOrderFromJobs(job.order, { session, actor, afterCommit });

    afterCommit(async () => {
      await audit(actor, {
        action: AUDIT_ACTIONS.PRODUCTION_CHANGE,
        entity: 'ProductionJob',
        entityId: job._id,
        reference: job.jobNumber,
        description: `Stage ${from} → ${to}`,
      });
      if (to === S.IN_PRODUCTION && !job.stageHistory.slice(0, -1).some((h) => h.to === S.IN_PRODUCTION)) {
        await notify.notifyCustomer(job.customer, {
          type: 'PRODUCTION_STARTED',
          title: 'Production started',
          message: `Our workshop has started building your ${job.title}.`,
          link: `/account/orders/${job.order}`,
        });
      }
      if (to === S.QUALITY_CHECK) {
        await notify.notifySupervisors({
          type: 'PRODUCTION_UPDATE',
          title: `${job.jobNumber} ready for inspection`,
          message: `${job.title} is waiting for quality control.`,
          link: '/app/quality',
        });
      }
      const others = job.assignedWorkers.filter((w) => String(w) !== String(user._id));
      await notify.notifyUsers(others, {
        type: 'PRODUCTION_UPDATE',
        title: `${job.jobNumber} moved to ${to.replace(/_/g, ' ').toLowerCase()}`,
        message: note || `${user.name} updated the job stage.`,
        link: `/app/production/${job._id}`,
      });
    });
    return job;
  });
}

async function assignWorkers(jobId, { workerIds, supervisorId, expectedCompletionDate, priority }, actor) {
  const job = await loadJob(jobId);
  if ([S.CANCELLED, S.DELIVERED].includes(job.stage)) throw ApiError.badRequest('This job is closed.');
  const ids = [...new Set([...workerIds, supervisorId].filter(Boolean).map(String))];
  const validCount = await User.countDocuments({ _id: { $in: ids }, role: ROLES.WORKER, isActive: true });
  if (validCount !== ids.length) throw ApiError.badRequest('Jobs can only be assigned to active workers.');
  const previous = job.assignedWorkers.map(String);
  job.assignedWorkers = workerIds;
  if (supervisorId !== undefined) job.supervisor = supervisorId || null;
  if (expectedCompletionDate) job.expectedCompletionDate = expectedCompletionDate;
  if (priority) job.priority = priority;
  if (job.stage === S.PENDING) applyStage(job, S.APPROVED, { by: actor.user._id, note: 'Approved and assigned' });
  await job.save();

  const newlyAssigned = workerIds.filter((id) => !previous.includes(String(id)));
  await notify.notifyUsers(newlyAssigned, {
    type: 'JOB_ASSIGNED',
    title: `New job assigned: ${job.jobNumber}`,
    message: `${job.title}${job.expectedCompletionDate ? ` — due ${job.expectedCompletionDate.toDateString()}` : ''}`,
    link: `/app/production/${job._id}`,
  });
  await audit(actor, {
    action: AUDIT_ACTIONS.PRODUCTION_CHANGE,
    entity: 'ProductionJob',
    entityId: job._id,
    reference: job.jobNumber,
    description: 'Workers assigned',
    changes: { assignedWorkers: { from: previous, to: workerIds.map(String) } },
  });
  return job;
}

/**
 * Issues materials from stock to a job. Without explicit items, issues everything
 * still outstanding. Every unit issued is an inventory transaction.
 */
async function issueMaterials(jobId, { items }, actor) {
  return withTransaction(async (session, afterCommit) => {
    const job = await loadJob(jobId, session);
    if ([S.CANCELLED, S.DELIVERED, S.READY_FOR_DELIVERY].includes(job.stage)) {
      throw ApiError.badRequest('Materials cannot be issued to a job in this stage.');
    }

    const toIssue =
      items && items.length
        ? items
        : job.requiredMaterials
            .map((m) => ({ material: m.material, quantity: round2(m.quantityRequired - m.quantityIssued) }))
            .filter((m) => m.quantity > 0);
    if (!toIssue.length) throw ApiError.badRequest('There are no outstanding materials to issue.');

    for (const { material, quantity } of toIssue) {
      const result = await adjustStock({
        itemType: 'MATERIAL',
        itemId: material,
        delta: -quantity,
        type: INVENTORY_TX_TYPES.PRODUCTION_ISSUE,
        reference: { model: 'ProductionJob', id: job._id, number: job.jobNumber },
        note: `Issued to ${job.jobNumber}`,
        userId: actor.user._id,
        session,
      });
      alertIfCrossed(result, 'MATERIAL', afterCommit);
      const line = job.requiredMaterials.find((m) => String(m.material) === String(material));
      if (line) {
        line.quantityIssued = round2(line.quantityIssued + quantity);
      } else {
        job.requiredMaterials.push({
          material,
          name: result.item.name,
          unit: result.item.unit,
          quantityRequired: quantity,
          quantityIssued: quantity,
        });
      }
    }

    const ready = materialsFullyIssued(job);
    if (ready && [S.PENDING, S.APPROVED, S.MATERIALS_REQUIRED].includes(job.stage)) {
      applyStage(job, S.MATERIALS_READY, { by: actor.user._id, note: 'All materials issued' });
      afterCommit(() =>
        notify.notifyUsers(job.assignedWorkers, {
          type: 'MATERIAL_AVAILABLE',
          title: `Materials ready for ${job.jobNumber}`,
          message: `All materials for ${job.title} have been issued. You can start production.`,
          link: `/app/production/${job._id}`,
        })
      );
    } else if (!ready && [S.PENDING, S.APPROVED].includes(job.stage)) {
      applyStage(job, S.MATERIALS_REQUIRED, { by: actor.user._id, note: 'Materials partially issued' });
    }
    await job.save({ session });
    await syncOrderFromJobs(job.order, { session, actor, afterCommit });

    afterCommit(() =>
      audit(actor, {
        action: AUDIT_ACTIONS.INVENTORY_CHANGE,
        entity: 'ProductionJob',
        entityId: job._id,
        reference: job.jobNumber,
        description: `Issued ${toIssue.length} material line(s) to production`,
        changes: { issued: toIssue },
      })
    );
    return job;
  });
}

/** Returns unused materials from a job back to stock ("record materials used"). */
async function returnMaterials(jobId, { items }, actor) {
  return withTransaction(async (session, afterCommit) => {
    const job = await loadJob(jobId, session);
    assertJobAccess(job, actor.user);
    for (const { material, quantity } of items) {
      const line = job.requiredMaterials.find((m) => String(m.material) === String(material));
      const outstanding = line ? round2(line.quantityIssued - line.quantityReturned) : 0;
      if (!line || quantity > outstanding + 1e-9) {
        throw ApiError.badRequest(`Cannot return more than was issued (${outstanding} ${line?.unit || ''}).`);
      }
      await adjustStock({
        itemType: 'MATERIAL',
        itemId: material,
        delta: quantity,
        type: INVENTORY_TX_TYPES.PRODUCTION_RETURN,
        reference: { model: 'ProductionJob', id: job._id, number: job.jobNumber },
        note: `Returned unused material from ${job.jobNumber}`,
        userId: actor.user._id,
        session,
      });
      line.quantityReturned = round2(line.quantityReturned + quantity);
    }
    await job.save({ session });
    afterCommit(() =>
      audit(actor, {
        action: AUDIT_ACTIONS.INVENTORY_CHANGE,
        entity: 'ProductionJob',
        entityId: job._id,
        reference: job.jobNumber,
        description: 'Unused materials returned to stock',
        changes: { returned: items },
      })
    );
    return job;
  });
}

async function requestMaterials(jobId, { material, quantity, reason }, actor) {
  const job = await loadJob(jobId);
  assertJobAccess(job, actor.user);
  const mat = await Material.findById(material).select('name unit').lean();
  if (!mat) throw ApiError.notFound('Material not found.');
  job.materialRequests.push({ material, quantity, reason, requestedBy: actor.user._id });
  await job.save();
  await notify.notifySupervisors({
    type: 'MATERIAL_REQUEST',
    title: `Material request for ${job.jobNumber}`,
    message: `${actor.user.name} requested ${quantity} ${mat.unit} of ${mat.name}${reason ? `: ${reason}` : ''}`,
    link: `/app/production/${job._id}`,
  });
  return job;
}

async function handleMaterialRequest(jobId, requestId, { approve }, actor) {
  const job = await loadJob(jobId);
  const request = job.materialRequests.id(requestId);
  if (!request) throw ApiError.notFound('Material request not found.');
  if (request.status !== 'PENDING') throw ApiError.badRequest('This request has already been handled.');

  if (approve) {
    await issueMaterials(jobId, { items: [{ material: request.material, quantity: request.quantity }] }, actor);
  }
  const fresh = await loadJob(jobId);
  const req = fresh.materialRequests.id(requestId);
  req.status = approve ? 'ISSUED' : 'REJECTED';
  req.handledBy = actor.user._id;
  req.handledAt = new Date();
  await fresh.save();
  await notify.notifyUsers([req.requestedBy], {
    type: approve ? 'MATERIAL_AVAILABLE' : 'PRODUCTION_UPDATE',
    title: approve ? 'Material request issued' : 'Material request rejected',
    message: `${fresh.jobNumber}: your request was ${approve ? 'approved and issued' : 'rejected'}.`,
    link: `/app/production/${fresh._id}`,
  });
  return fresh;
}

async function addNote(jobId, text, actor) {
  const job = await loadJob(jobId);
  assertJobAccess(job, actor.user);
  job.notes.push({ text, by: actor.user._id });
  await job.save();
  return job;
}

async function addImages(jobId, urls, caption, actor) {
  const job = await loadJob(jobId);
  assertJobAccess(job, actor.user);
  urls.forEach((url) => job.images.push({ url, caption, stage: job.stage, by: actor.user._id }));
  await job.save();
  return job;
}

async function reportProblem(jobId, { description, severity }, actor) {
  const job = await loadJob(jobId);
  assertJobAccess(job, actor.user);
  job.problems.push({ description, severity, reportedBy: actor.user._id });
  await job.save();
  await notify.notifySupervisors({
    type: 'PRODUCTION_PROBLEM',
    title: `Problem reported on ${job.jobNumber} (${severity})`,
    message: description,
    link: `/app/production/${job._id}`,
  });
  await audit(actor, {
    action: AUDIT_ACTIONS.PRODUCTION_CHANGE,
    entity: 'ProductionJob',
    entityId: job._id,
    reference: job.jobNumber,
    description: `Problem reported: ${description.slice(0, 120)}`,
  });
  return job;
}

async function resolveProblem(jobId, problemId, resolution, actor) {
  const job = await loadJob(jobId);
  const problem = job.problems.id(problemId);
  if (!problem) throw ApiError.notFound('Problem not found.');
  problem.resolved = true;
  problem.resolvedBy = actor.user._id;
  problem.resolvedAt = new Date();
  problem.resolution = resolution;
  await job.save();
  return job;
}

async function updateJobDetails(jobId, changes, actor) {
  const job = await loadJob(jobId);
  const allowed = ['instructions', 'expectedCompletionDate', 'priority', 'specifications'];
  allowed.forEach((k) => {
    if (changes[k] !== undefined) job[k] = changes[k];
  });
  if (changes.requiredMaterials) {
    // Planned quantities can change, but never below what has already been issued.
    const keptIds = changes.requiredMaterials.map((m) => String(m.material));
    const droppedIssued = job.requiredMaterials.find((m) => m.quantityIssued > 0 && !keptIds.includes(String(m.material)));
    if (droppedIssued) throw ApiError.badRequest(`${droppedIssued.name} has already been issued and cannot be removed.`);
    const mats = await Material.find({ _id: { $in: changes.requiredMaterials.map((m) => m.material) } }).lean();
    job.requiredMaterials = changes.requiredMaterials.map((m) => {
      const existing = job.requiredMaterials.find((x) => String(x.material) === String(m.material));
      const mat = mats.find((x) => String(x._id) === String(m.material));
      if (!mat) throw ApiError.badRequest('Unknown material in required materials.');
      const issued = existing?.quantityIssued || 0;
      if (m.quantityRequired < issued) throw ApiError.badRequest(`${mat.name}: required quantity cannot be below issued (${issued}).`);
      return {
        material: m.material,
        name: mat.name,
        unit: mat.unit,
        quantityRequired: m.quantityRequired,
        quantityIssued: issued,
        quantityReturned: existing?.quantityReturned || 0,
      };
    });
  }
  await job.save();
  await audit(actor, { action: AUDIT_ACTIONS.UPDATE, entity: 'ProductionJob', entityId: job._id, reference: job.jobNumber, description: 'Job details updated' });
  return job;
}

function jobFilterFor(user, query = {}) {
  const filter = {};
  if (query.stage) filter.stage = { $in: String(query.stage).split(',') };
  if (query.order) filter.order = query.order;
  // Regular workers only ever see jobs assigned to them.
  if (user.role === ROLES.WORKER && !isManager(user)) filter.assignedWorkers = user._id;
  else if (query.mine === 'true') filter.assignedWorkers = user._id;
  else if (query.worker) filter.assignedWorkers = query.worker;
  if (query.overdue === 'true') {
    filter.expectedCompletionDate = { $lt: new Date() };
    filter.stage = { $nin: [S.READY_FOR_DELIVERY, S.DELIVERED, S.CANCELLED] };
  }
  return filter;
}

async function getBoard(user, query) {
  const filter = { ...jobFilterFor(user, query), stage: { $ne: S.CANCELLED } };
  // Completed jobs older than 30 days drop off the board.
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  filter.$or = [{ stage: { $ne: S.DELIVERED } }, { updatedAt: { $gte: cutoff } }];
  const jobs = await ProductionJob.find(filter)
    .select('jobNumber title quantity stage progress priority expectedCompletionDate assignedWorkers order customer qcStatus problems')
    .populate([
      { path: 'order', select: 'orderNumber' },
      { path: 'customer', select: 'name' },
      { path: 'assignedWorkers', select: 'name workerRole' },
    ])
    .sort({ expectedCompletionDate: 1 })
    .lean();
  return BOARD_COLUMNS.map((col) => ({
    ...col,
    jobs: jobs
      .filter((j) => col.stages.includes(j.stage))
      .map((j) => ({ ...j, openProblems: (j.problems || []).filter((p) => !p.resolved).length, problems: undefined })),
  }));
}

async function getJob(jobId, user) {
  const job = await ProductionJob.findById(jobId)
    .populate(JOB_POPULATE)
    .populate('notes.by', 'name')
    .populate('problems.reportedBy', 'name')
    .populate('materialRequests.material', 'name unit quantity')
    .populate('materialRequests.requestedBy', 'name')
    .populate('stageHistory.by', 'name')
    .populate('customRequest')
    .lean();
  if (!job) throw ApiError.notFound('Production job not found.');
  assertJobAccess(job, user);
  // Workers see customer requirements, but not the customer's contact details.
  if (user.role === ROLES.WORKER && !isManager(user) && job.customer) job.customer = { name: job.customer.name };
  job.qualityChecks = await QualityCheck.find({ job: job._id }).populate('inspector', 'name').sort({ attempt: -1 }).lean();
  return job;
}

async function customerProgress(orderId) {
  const jobs = await ProductionJob.find({ order: orderId })
    .select('jobNumber title stage progress expectedCompletionDate startDate actualCompletionDate images stageHistory.to stageHistory.at')
    .lean();
  return jobs.map((j) => ({ ...j, images: (j.images || []).map((i) => ({ url: i.url, stage: i.stage, at: i.at })) }));
}

module.exports = {
  STAGE_ORDER,
  STAGE_PROGRESS,
  TRANSITIONS,
  BOARD_COLUMNS,
  PRODUCTION_STARTED_STAGES,
  JOB_POPULATE,
  isManager,
  jobFilterFor,
  computeRequiredMaterials,
  createJobsForOrder,
  syncOrderFromJobs,
  applyStage,
  updateStage,
  assignWorkers,
  issueMaterials,
  returnMaterials,
  requestMaterials,
  handleMaterialRequest,
  addNote,
  addImages,
  reportProblem,
  resolveProblem,
  updateJobDetails,
  getBoard,
  getJob,
  customerProgress,
  loadJob,
};
