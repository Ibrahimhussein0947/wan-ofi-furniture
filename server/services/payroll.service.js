const { Worker, ProductionTask, ProductionJob, Payment } = require('../models');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');
const { PAYMENT_CATEGORIES } = require('../config/constants');

/** UTC boundaries of a YYYY-MM month, ending today if the month is still running. */
function monthRange(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(month || '');
  if (!m) throw ApiError.badRequest('Month must look like 2026-09.');
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  const now = new Date();
  return { start, end, through: end > now ? now : end };
}

/** Monday–Saturday working days between two dates (the workshop's six-day week). */
function workingDays(start, end) {
  let days = 0;
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() !== 0) days += 1;
  return days;
}

/**
 * Pay earned by each active worker in a month, from their wage type:
 * hourly → hours logged on jobs and tasks; per job → completed jobs and tasks; daily/weekly → working days so far
 * (attendance isn't tracked, so staff adjust for absences before paying); monthly → the full rate.
 * The administrator's per-worker tax rate is withheld from the earnings (net = earned − tax), and the
 * tax already withheld grows as net wages are paid — paying the net in full reaches 100% of the tax.
 * Wages and advances already paid for the month are subtracted.
 */
async function monthlyPayroll(month) {
  const { start, end, through } = monthRange(month);
  const workers = await Worker.find({ isActive: true }).populate('user', 'name').sort({ position: 1 }).lean();
  const userIds = workers.map((w) => w.user?._id).filter(Boolean);

  const [taskStats, jobHours, jobsDone, payments] = await Promise.all([
    ProductionTask.aggregate([
      { $match: { assignedTo: { $in: userIds }, status: 'DONE', completedAt: { $gte: start, $lt: end } } },
      { $group: { _id: '$assignedTo', tasks: { $sum: 1 }, hours: { $sum: { $ifNull: ['$hoursWorked', 0] } } } },
    ]),
    ProductionJob.aggregate([
      { $match: { 'laborLog.date': { $gte: start, $lt: end } } },
      { $unwind: '$laborLog' },
      { $match: { 'laborLog.worker': { $in: userIds }, 'laborLog.date': { $gte: start, $lt: end } } },
      { $group: { _id: '$laborLog.worker', hours: { $sum: '$laborLog.hours' } } },
    ]),
    // A finished job counts once for each worker assigned to it.
    ProductionJob.aggregate([
      { $match: { actualCompletionDate: { $gte: start, $lt: end }, stage: { $ne: 'CANCELLED' } } },
      { $unwind: '$assignedWorkers' },
      { $match: { assignedWorkers: { $in: userIds } } },
      { $group: { _id: '$assignedWorkers', jobs: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      {
        $match: {
          category: PAYMENT_CATEGORIES.WORKER_PAYMENT,
          kind: { $in: ['WAGE', 'ADVANCE'] },
          worker: { $in: workers.map((w) => w._id) },
          $or: [{ payPeriod: month }, { payPeriod: { $in: [null, ''] }, paidAt: { $gte: start, $lt: end } }],
        },
      },
      { $group: { _id: '$worker', paid: { $sum: '$amount' } } },
    ]),
  ]);
  const tasksBy = new Map(taskStats.map((t) => [String(t._id), t]));
  const jobHoursBy = new Map(jobHours.map((j) => [String(j._id), j.hours]));
  const jobsBy = new Map(jobsDone.map((j) => [String(j._id), j.jobs]));
  const paidBy = new Map(payments.map((p) => [String(p._id), p.paid]));
  const days = workingDays(start, through);

  return {
    month,
    workingDays: days,
    rows: workers.map((w) => {
      const uid = String(w.user?._id);
      const tasks = tasksBy.get(uid) || { tasks: 0, hours: 0 };
      const stats = { jobs: jobsBy.get(uid) || 0, tasks: tasks.tasks, hours: tasks.hours + (jobHoursBy.get(uid) || 0) };
      const pieces = stats.jobs + stats.tasks;
      const rate = w.wageRate || 0;
      const basis = {
        HOURLY: { units: round2(stats.hours), unit: 'hours', earned: stats.hours * rate },
        PER_JOB: { units: pieces, unit: 'jobs', earned: pieces * rate },
        DAILY: { units: days, unit: 'days', earned: days * rate },
        WEEKLY: { units: round2(days / 6), unit: 'weeks', earned: (days / 6) * rate },
        MONTHLY: { units: 1, unit: 'month', earned: rate },
      }[w.wageType || 'MONTHLY'];
      const earned = round2(basis.earned);
      const paid = round2(paidBy.get(String(w._id)) || 0);
      // Tax withheld from this month's earnings; it is reached in step with net wages actually paid.
      const taxRate = w.taxRate || 0;
      const tax = round2((earned * taxRate) / 100);
      const net = round2(earned - tax);
      const taxWithheld = tax > 0 ? round2(tax * Math.min(net > 0 ? paid / net : paid > 0 ? 1 : 0, 1)) : 0;
      return {
        worker: { _id: w._id, name: w.user?.name, employeeCode: w.employeeCode, position: w.position },
        wageType: w.wageType,
        wageRate: rate,
        taxRate,
        jobsCompleted: stats.jobs,
        tasksCompleted: stats.tasks,
        hoursLogged: round2(stats.hours),
        units: basis.units,
        unit: basis.unit,
        earned,
        tax,
        net,
        taxWithheld,
        taxRemaining: round2(tax - taxWithheld),
        paid,
        due: round2(Math.max(net - paid, 0)),
      };
    }),
  };
}

module.exports = { monthlyPayroll, workingDays, monthRange };
