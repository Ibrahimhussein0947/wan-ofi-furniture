const { z, objectId, optionalId, quantity, trimmed, optionalText, optionalDate, address } = require('./common');
const { PRODUCTION_STAGES, PRIORITIES, QC_STATUS, QC_CHECK_ITEMS, DELIVERY_STATUS, TASK_STATUS } = require('../config/constants');

const stage = z.object({ stage: z.enum(Object.values(PRODUCTION_STAGES)), note: optionalText(1000) });

const assign = z.object({
  workerIds: z.array(objectId).max(20),
  supervisorId: optionalId,
  expectedCompletionDate: optionalDate,
  priority: z.enum(Object.values(PRIORITIES)).optional(),
});

const materialLines = z.object({ items: z.array(z.object({ material: objectId, quantity })).max(100).optional() });
const materialReturn = z.object({ items: z.array(z.object({ material: objectId, quantity })).min(1).max(100) });

const materialRequest = z.object({ material: objectId, quantity, reason: optionalText(500) });
const decision = z.object({ approve: z.boolean() });

const jobNote = z.object({ text: trimmed(2000).min(1, 'Note cannot be empty') });
const laborHours = z.object({
  hours: z.coerce.number().min(0.25, 'At least 15 minutes').max(24, 'At most 24 hours a day'),
  date: optionalDate,
  note: optionalText(300),
  worker: optionalId,
});
const problem = z.object({ description: trimmed(2000).min(3, 'Describe the problem'), severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM') });
const resolution = z.object({ resolution: trimmed(1000).min(2) });

const updateJob = z.object({
  instructions: optionalText(5000),
  expectedCompletionDate: optionalDate,
  priority: z.enum(Object.values(PRIORITIES)).optional(),
  specifications: z.record(z.any()).optional(),
  requiredMaterials: z.array(z.object({ material: objectId, quantityRequired: z.coerce.number().min(0) })).max(100).optional(),
});

const task = z.object({
  job: objectId,
  title: trimmed(200).min(2),
  description: optionalText(2000),
  stage: z.enum(Object.values(PRODUCTION_STAGES)).optional(),
  assignedTo: optionalId,
  dueDate: optionalDate,
});
const updateTask = z.object({
  title: trimmed(200).min(2).optional(),
  description: optionalText(2000),
  assignedTo: optionalId,
  dueDate: optionalDate,
  status: z.enum(Object.values(TASK_STATUS)).optional(),
  hoursWorked: z.coerce.number().min(0).max(200).optional(),
});

const checkResult = z.object({ passed: z.boolean().nullable().optional(), note: optionalText(500) });
const inspection = z.object({
  checklist: z.object(Object.fromEntries(QC_CHECK_ITEMS.map((k) => [k, checkResult.optional()]))).partial().default({}),
  status: z.enum([QC_STATUS.PASSED, QC_STATUS.FAILED, QC_STATUS.REWORK_REQUIRED]),
  notes: optionalText(2000),
});

const delivery = z.object({
  order: objectId,
  scheduledDate: optionalDate,
  deliveryPerson: optionalId,
  address,
  phone: optionalText(30),
  vehicle: optionalText(60),
  notes: optionalText(2000),
});

const updateDelivery = z.object({
  status: z.enum(Object.values(DELIVERY_STATUS)).optional(),
  scheduledDate: optionalDate,
  deliveryPerson: optionalId,
  address,
  phone: optionalText(30),
  vehicle: optionalText(60),
  notes: optionalText(2000),
  failureReason: optionalText(500),
  receivedBy: optionalText(120),
});

const message = z.object({
  receiver: optionalId,
  body: z.string().trim().max(4000).default(''),
  order: optionalId,
});

const contact = z.object({
  name: trimmed(120).min(2),
  email: z.string().trim().email().max(160),
  phone: optionalText(30),
  subject: optionalText(150),
  message: trimmed(3000).min(10, 'Message is too short'),
});

module.exports = {
  laborHours,
  stage,
  assign,
  materialLines,
  materialReturn,
  materialRequest,
  decision,
  jobNote,
  problem,
  resolution,
  updateJob,
  task,
  updateTask,
  inspection,
  delivery,
  updateDelivery,
  message,
  contact,
};
