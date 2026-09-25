const { QualityCheck, ProductionJob } = require('../models');
const ApiError = require('../utils/ApiError');
const { withTransaction } = require('../utils/transaction');
const { QC_STATUS, QC_CHECK_ITEMS, PRODUCTION_STAGES: S, AUDIT_ACTIONS } = require('../config/constants');
const { applyStage, syncOrderFromJobs } = require('./production.service');
const { audit } = require('./audit.service');
const notify = require('./notification.service');

/**
 * Records an inspection. PASSED moves the job to READY_FOR_DELIVERY; FAILED or
 * REWORK_REQUIRED sends it back to production and notifies the assigned workers.
 */
async function submitInspection(qcId, { checklist = {}, status, notes, images = [] }, actor) {
  return withTransaction(async (session, afterCommit) => {
    const qc = await QualityCheck.findById(qcId).session(session);
    if (!qc) throw ApiError.notFound('Quality check not found.');
    if (qc.status !== QC_STATUS.PENDING) throw ApiError.badRequest('This inspection has already been completed.');

    const job = await ProductionJob.findById(qc.job).session(session);
    if (!job || job.stage !== S.QUALITY_CHECK) throw ApiError.badRequest('The job is not waiting for quality control.');

    const failedItems = QC_CHECK_ITEMS.filter((k) => checklist[k]?.passed === false);
    const unchecked = QC_CHECK_ITEMS.filter((k) => typeof checklist[k]?.passed !== 'boolean');
    if (status === QC_STATUS.PASSED) {
      if (failedItems.length) throw ApiError.badRequest(`Cannot pass an item with failed checks: ${failedItems.join(', ')}.`);
      if (unchecked.length) throw ApiError.badRequest(`Complete every check before passing: ${unchecked.join(', ')}.`);
    }

    QC_CHECK_ITEMS.forEach((k) => {
      if (checklist[k]) qc.checklist[k] = checklist[k];
    });
    qc.status = status;
    qc.notes = notes;
    qc.images = [...(qc.images || []), ...images];
    qc.inspector = actor.user._id;
    qc.inspectedAt = new Date();
    await qc.save({ session });

    job.qcStatus = status;
    if (status === QC_STATUS.PASSED) {
      applyStage(job, S.READY_FOR_DELIVERY, { by: actor.user._id, note: 'Passed quality control' });
    } else {
      job.reworkCount += 1;
      applyStage(job, S.IN_PRODUCTION, { by: actor.user._id, note: `Quality control ${status.toLowerCase()}: ${failedItems.join(', ') || notes || ''}` });
    }
    await job.save({ session });
    await syncOrderFromJobs(job.order, { session, actor, afterCommit });

    afterCommit(async () => {
      await audit(actor, {
        action: AUDIT_ACTIONS.PRODUCTION_CHANGE,
        entity: 'QualityCheck',
        entityId: qc._id,
        reference: job.jobNumber,
        description: `Quality check ${status}${failedItems.length ? ` (failed: ${failedItems.join(', ')})` : ''}`,
      });
      if (status === QC_STATUS.PASSED) {
        await notify.notifyCustomer(job.customer, {
          type: 'PRODUCTION_COMPLETED',
          title: 'Production completed',
          message: `${job.title} passed our quality inspection.`,
          link: `/account/orders/${job.order}`,
        });
      } else {
        await notify.notifyUsers(job.assignedWorkers, {
          type: 'PRODUCTION_UPDATE',
          title: `Rework required: ${job.jobNumber}`,
          message: notes || `Failed checks: ${failedItems.join(', ')}`,
          link: `/app/production/${job._id}`,
        });
      }
    });
    return { qc, job };
  });
}

module.exports = { submitInspection };
