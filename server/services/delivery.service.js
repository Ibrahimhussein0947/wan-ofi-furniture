const { Delivery, Order, ProductionJob, User } = require('../models');
const { nextNumber } = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { withTransaction } = require('../utils/transaction');
const { DELIVERY_STATUS: D, ORDER_STATUS: O, PRODUCTION_STAGES: S, AUDIT_ACTIONS, ROLES } = require('../config/constants');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { getSettings } = require('./settings.service');
const { audit } = require('./audit.service');
const notify = require('./notification.service');

const TRANSITIONS = {
  [D.PENDING]: [D.SCHEDULED, D.FAILED],
  [D.SCHEDULED]: [D.SCHEDULED, D.OUT_FOR_DELIVERY, D.FAILED],
  [D.OUT_FOR_DELIVERY]: [D.DELIVERED, D.FAILED],
  [D.FAILED]: [D.SCHEDULED],
  [D.DELIVERED]: [],
};

async function scheduleDelivery(input, actor) {
  const order = await Order.findById(input.order);
  if (!order) throw ApiError.notFound('Order not found.');
  if (order.deliveryMethod !== 'DELIVERY') throw ApiError.badRequest('This order is set for customer pickup.');
  if (order.status !== O.READY) throw ApiError.badRequest('Only orders that are ready can be scheduled for delivery.');
  const active = await Delivery.exists({ order: order._id, status: { $in: [D.PENDING, D.SCHEDULED, D.OUT_FOR_DELIVERY] } });
  if (active) throw ApiError.conflict('This order already has an active delivery.');
  if (input.deliveryPerson) {
    const person = await User.exists({ _id: input.deliveryPerson, role: { $in: [ROLES.WORKER, ROLES.OWNER] }, isActive: true });
    if (!person) throw ApiError.badRequest('Delivery person must be an active staff member.');
  }

  const status = input.scheduledDate && input.deliveryPerson ? D.SCHEDULED : D.PENDING;
  const delivery = await Delivery.create({
    deliveryNumber: await nextNumber('DLV'),
    order: order._id,
    customer: order.customer,
    address: input.address || order.deliveryAddress,
    phone: input.phone || order.contactPhone,
    scheduledDate: input.scheduledDate,
    deliveryPerson: input.deliveryPerson,
    vehicle: input.vehicle,
    notes: input.notes,
    status,
    history: [{ status, note: 'Delivery created', by: actor.user._id }],
    createdBy: actor.user._id,
  });
  order.deliveryStatus = status;
  await order.save();

  await audit(actor, { action: AUDIT_ACTIONS.CREATE, entity: 'Delivery', entityId: delivery._id, reference: order.orderNumber, description: `Delivery ${delivery.deliveryNumber} ${status.toLowerCase()}` });
  if (input.deliveryPerson) {
    await notify.notifyUsers([input.deliveryPerson], {
      type: 'JOB_ASSIGNED',
      title: `Delivery assigned: ${order.orderNumber}`,
      message: input.scheduledDate ? `Scheduled for ${new Date(input.scheduledDate).toDateString()}` : 'Delivery date to be confirmed',
      link: `/app/deliveries/${delivery._id}`,
    });
  }
  if (input.scheduledDate) {
    await notify.notifyCustomer(order.customer, {
      type: 'READY_FOR_DELIVERY',
      title: `Delivery scheduled — ${order.orderNumber}`,
      message: `Your furniture will be delivered on ${new Date(input.scheduledDate).toDateString()}.`,
      link: `/account/orders/${order._id}`,
    });
  }
  return delivery;
}

function assertCanUpdate(delivery, user) {
  if (hasPermission(user, PERMISSIONS.DELIVERIES_MANAGE)) return;
  if (String(delivery.deliveryPerson) === String(user._id)) return;
  throw ApiError.forbidden('This delivery is not assigned to you.');
}

async function updateDelivery(id, input, actor) {
  return withTransaction(async (session, afterCommit) => {
    const delivery = await Delivery.findById(id).session(session);
    if (!delivery) throw ApiError.notFound('Delivery not found.');
    assertCanUpdate(delivery, actor.user);
    const order = await Order.findById(delivery.order).session(session);

    const { status } = input;
    if (status && status !== delivery.status) {
      if (!(TRANSITIONS[delivery.status] || []).includes(status)) {
        throw ApiError.badRequest(`Cannot change delivery from ${delivery.status} to ${status}.`);
      }
      if (status === D.SCHEDULED && !(input.scheduledDate || delivery.scheduledDate)) {
        throw ApiError.badRequest('Set a delivery date before scheduling.');
      }
      if (status === D.OUT_FOR_DELIVERY) {
        const settings = await getSettings();
        if (settings.requireFullPaymentBeforeDelivery && order.balance > 0) {
          throw ApiError.badRequest(`The remaining balance (${order.balance.toLocaleString()}) must be paid before dispatch.`);
        }
        order.status = O.OUT_FOR_DELIVERY;
        order.statusHistory.push({ status: O.OUT_FOR_DELIVERY, note: delivery.deliveryNumber, changedBy: actor.user._id });
      }
      if (status === D.DELIVERED) {
        delivery.deliveredAt = new Date();
        order.status = order.balance <= 0 ? O.COMPLETED : O.DELIVERED;
        order.statusHistory.push({ status: O.DELIVERED, note: `Delivered (${delivery.deliveryNumber})`, changedBy: actor.user._id });
        if (order.status === O.COMPLETED) {
          order.completedAt = new Date();
          order.statusHistory.push({ status: O.COMPLETED, note: 'Delivered and fully paid', changedBy: actor.user._id });
        }
        await ProductionJob.updateMany(
          { order: order._id, stage: S.READY_FOR_DELIVERY },
          { $set: { stage: S.DELIVERED, progress: 100 }, $push: { stageHistory: { from: S.READY_FOR_DELIVERY, to: S.DELIVERED, by: actor.user._id } } },
          { session }
        );
        order.productionStatus = order.productionStatus === 'NOT_REQUIRED' ? 'NOT_REQUIRED' : S.DELIVERED;
      }
      if (status === D.FAILED) {
        delivery.failureReason = input.failureReason || 'Not specified';
        if (order.status === O.OUT_FOR_DELIVERY) {
          order.status = O.READY;
          order.statusHistory.push({ status: O.READY, note: `Delivery failed: ${delivery.failureReason}`, changedBy: actor.user._id });
        }
      }
      delivery.status = status;
      delivery.history.push({ status, note: input.notes || input.failureReason, by: actor.user._id });
      order.deliveryStatus = status;
    }

    ['scheduledDate', 'notes', 'vehicle', 'receivedBy', 'phone', 'address'].forEach((k) => {
      if (input[k] !== undefined) delivery[k] = input[k];
    });
    if (input.deliveryPerson !== undefined && hasPermission(actor.user, PERMISSIONS.DELIVERIES_MANAGE)) {
      delivery.deliveryPerson = input.deliveryPerson || null;
    }
    await delivery.save({ session });
    await order.save({ session });

    afterCommit(async () => {
      if (!status) return;
      await audit(actor, { action: AUDIT_ACTIONS.STATUS_CHANGE, entity: 'Delivery', entityId: delivery._id, reference: order.orderNumber, description: `Delivery ${status}` });
      const messages = {
        [D.SCHEDULED]: ['READY_FOR_DELIVERY', 'Delivery scheduled', `Delivery set for ${delivery.scheduledDate ? new Date(delivery.scheduledDate).toDateString() : 'soon'}.`],
        [D.OUT_FOR_DELIVERY]: ['READY_FOR_DELIVERY', 'Out for delivery', 'Your furniture is on its way!'],
        [D.DELIVERED]: ['DELIVERED', 'Delivered', 'Your furniture has been delivered. Thank you for choosing Wan Ofi Furniture!'],
        [D.FAILED]: ['GENERAL', 'Delivery attempt failed', `We could not complete the delivery: ${delivery.failureReason}. We will contact you to reschedule.`],
      };
      const [type, title, message] = messages[status] || [];
      if (type) await notify.notifyCustomer(order.customer, { type, title: `${title} — ${order.orderNumber}`, message, link: `/account/orders/${order._id}` });
      if (status === D.FAILED || status === D.DELIVERED) {
        await notify.notifyOwners({ type: 'GENERAL', title: `${order.orderNumber}: delivery ${status.toLowerCase()}`, message: delivery.failureReason || '', link: `/app/deliveries/${delivery._id}` });
      }
    });
    return delivery;
  });
}

async function addProof(id, { images = [], signature }, receivedBy, actor) {
  const delivery = await Delivery.findById(id);
  if (!delivery) throw ApiError.notFound('Delivery not found.');
  assertCanUpdate(delivery, actor.user);
  delivery.proofImages.push(...images);
  if (signature) delivery.signatureImage = signature;
  if (receivedBy) delivery.receivedBy = receivedBy;
  await delivery.save();
  return delivery;
}

module.exports = { scheduleDelivery, updateDelivery, addProof };
