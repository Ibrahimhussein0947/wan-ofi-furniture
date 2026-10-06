const { CustomFurnitureRequest, Order, Customer } = require('../models');
const { nextNumber } = require('../models/Counter');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');
const { CUSTOM_REQUEST_STATUS: CR, ORDER_STATUS, AUDIT_ACTIONS, WORKER_ROLES, ROLES } = require('../config/constants');
const { getSettings } = require('./settings.service');
const { audit } = require('./audit.service');
const notify = require('./notification.service');

// Staff-side workflow: SUBMITTED → UNDER_REVIEW → ESTIMATED → QUOTED; the customer then approves or rejects.
const STAFF_TRANSITIONS = {
  [CR.SUBMITTED]: [CR.UNDER_REVIEW, CR.ESTIMATED, CR.QUOTED, CR.REJECTED],
  [CR.UNDER_REVIEW]: [CR.ESTIMATED, CR.QUOTED, CR.REJECTED],
  [CR.ESTIMATED]: [CR.UNDER_REVIEW, CR.QUOTED, CR.REJECTED],
  [CR.QUOTED]: [CR.ESTIMATED, CR.QUOTED, CR.REJECTED],
};

async function load(id) {
  const request = await CustomFurnitureRequest.findById(id);
  if (!request) throw ApiError.notFound('Custom furniture request not found.');
  return request;
}

function assertTransition(request, to) {
  if (!(STAFF_TRANSITIONS[request.status] || []).includes(to)) {
    throw ApiError.badRequest(`Cannot move a ${request.status.toLowerCase()} request to ${to.toLowerCase()}.`);
  }
}

async function submitRequest(input, customerId, actor) {
  const request = await CustomFurnitureRequest.create({
    ...input,
    requestNumber: await nextNumber('CFR'),
    customer: customerId,
    status: CR.SUBMITTED,
    history: [{ status: CR.SUBMITTED, note: 'Request submitted', by: actor.user?._id }],
  });
  const customer = await Customer.findById(customerId).select('name').lean();
  await audit(actor, { action: AUDIT_ACTIONS.CREATE, entity: 'CustomFurnitureRequest', entityId: request._id, reference: request.requestNumber });
  await notify.notifyRoles(
    { roles: [ROLES.OWNER], workerRoles: [WORKER_ROLES.SUPERVISOR, WORKER_ROLES.DESIGNER] },
    {
      type: 'CUSTOM_REQUEST',
      title: `Custom furniture request ${request.requestNumber}`,
      message: `${customer?.name || 'A customer'} requested: ${request.furnitureType} × ${request.quantity}`,
      link: `/app/custom-orders/${request._id}`,
    }
  );
  return request;
}

async function startReview(id, note, actor) {
  const request = await load(id);
  assertTransition(request, CR.UNDER_REVIEW);
  request.status = CR.UNDER_REVIEW;
  request.reviewedBy = actor.user._id;
  request.history.push({ status: CR.UNDER_REVIEW, note, by: actor.user._id });
  await request.save();
  await notify.notifyCustomer(request.customer, {
    type: 'GENERAL',
    title: `We're reviewing ${request.requestNumber}`,
    message: 'Our designers are reviewing your custom furniture request.',
    link: `/account/custom-requests/${request._id}`,
  });
  return request;
}

async function saveEstimate(id, estimate, actor) {
  const request = await load(id);
  assertTransition(request, CR.ESTIMATED);
  const totalCost = round2((estimate.materialCost || 0) + (estimate.laborCost || 0) + (estimate.otherCost || 0));
  request.estimate = { ...estimate, totalCost };
  request.status = CR.ESTIMATED;
  request.reviewedBy = request.reviewedBy || actor.user._id;
  request.history.push({ status: CR.ESTIMATED, note: `Estimated cost ${totalCost}`, by: actor.user._id });
  await request.save();
  await audit(actor, { action: AUDIT_ACTIONS.UPDATE, entity: 'CustomFurnitureRequest', entityId: request._id, reference: request.requestNumber, amount: totalCost, description: 'Estimate saved' });
  return request;
}

async function sendQuote(id, { quotedPrice, depositRequired, quoteNotes, quoteValidUntil, productionDays }, actor) {
  const request = await load(id);
  assertTransition(request, CR.QUOTED);
  const settings = await getSettings();
  if (request.estimate?.totalCost && quotedPrice < request.estimate.totalCost) {
    // Allowed (e.g. promotional pricing) but recorded so the owner can see the loss.
    request.history.push({ status: request.status, note: `Warning: quote below estimated cost (${request.estimate.totalCost})`, by: actor.user._id });
  }
  request.quotedPrice = quotedPrice;
  request.depositRequired = depositRequired ?? round2((quotedPrice * settings.depositPercent) / 100);
  if (request.depositRequired > quotedPrice) throw ApiError.badRequest('Deposit cannot exceed the quoted price.');
  request.quoteNotes = quoteNotes;
  request.quoteValidUntil = quoteValidUntil || new Date(Date.now() + 14 * 24 * 3600 * 1000);
  if (productionDays) request.estimate = { ...(request.estimate?.toObject?.() || request.estimate || {}), productionDays };
  request.status = CR.QUOTED;
  request.history.push({ status: CR.QUOTED, note: `Quoted ${quotedPrice}`, by: actor.user._id });
  await request.save();

  await audit(actor, { action: AUDIT_ACTIONS.UPDATE, entity: 'CustomFurnitureRequest', entityId: request._id, reference: request.requestNumber, amount: quotedPrice, description: 'Price proposal sent' });
  await notify.notifyCustomer(request.customer, {
    type: 'QUOTE_READY',
    title: `Your quote for ${request.furnitureType} is ready`,
    message: `Price: ${quotedPrice.toLocaleString()} ${settings.currency}. Deposit: ${request.depositRequired.toLocaleString()} ${settings.currency}. Review and approve it in your account.`,
    link: `/account/custom-requests/${request._id}`,
  });
  return request;
}

async function rejectRequest(id, reason, actor) {
  const request = await load(id);
  assertTransition(request, CR.REJECTED);
  request.status = CR.REJECTED;
  request.history.push({ status: CR.REJECTED, note: reason, by: actor.user._id });
  await request.save();
  await notify.notifyCustomer(request.customer, {
    type: 'GENERAL',
    title: `Update on ${request.requestNumber}`,
    message: reason || 'Unfortunately we cannot take on this custom request.',
    link: `/account/custom-requests/${request._id}`,
  });
  return request;
}

/**
 * The customer answers the quote. Approval converts the request into a CUSTOM order
 * that then follows the normal deposit → production → delivery workflow.
 */
async function respondToQuote(id, customerId, { approve, note }, actor) {
  const request = await CustomFurnitureRequest.findOne({ _id: id, customer: customerId });
  if (!request) throw ApiError.notFound('Custom furniture request not found.');
  if (request.status !== CR.QUOTED) throw ApiError.badRequest('There is no open quote to respond to.');
  if (request.quoteValidUntil && request.quoteValidUntil < new Date()) {
    throw ApiError.badRequest('This quote has expired. Please contact us for an updated price.');
  }

  request.customerResponseNote = note;
  if (!approve) {
    request.status = CR.REJECTED;
    request.history.push({ status: CR.REJECTED, note: `Customer declined the quote${note ? `: ${note}` : ''}`, by: actor.user._id });
    await request.save();
    await notify.notifyOwners({ type: 'CUSTOM_REQUEST', title: `Quote declined: ${request.requestNumber}`, message: note || '', link: `/app/custom-orders/${request._id}` });
    return { request };
  }

  const customer = await Customer.findById(customerId).lean();
  const settings = await getSettings();
  const deliveryFee = request.deliveryMethod === 'PICKUP' ? 0 : settings.defaultDeliveryFee;
  const taxRate = settings.taxRate || 0;
  const tax = round2((request.quotedPrice * taxRate) / 100);
  const total = round2(request.quotedPrice + tax + deliveryFee);
  const unitPrice = round2(request.quotedPrice / request.quantity);
  const days = request.estimate?.productionDays || 21;

  const order = await Order.create({
    orderNumber: await nextNumber('WO'),
    customer: customerId,
    orderType: 'CUSTOM',
    customRequest: request._id,
    items: [
      {
        customRequest: request._id,
        name: `Custom ${request.furnitureType}`,
        quantity: request.quantity,
        unitPrice,
        unitCost: request.estimate?.totalCost ? round2(request.estimate.totalCost / request.quantity) : 0,
        lineTotal: request.quotedPrice,
        color: request.preferredColor,
        options: [request.preferredMaterial, request.fabric].filter(Boolean).join(', '),
        fulfillment: 'PRODUCTION',
        warrantyMonths: settings.customWarrantyMonths ?? 12,
      },
    ],
    subtotal: request.quotedPrice,
    deliveryFee,
    taxRate,
    tax,
    total,
    depositRequired: request.depositRequired,
    balance: total,
    deliveryMethod: request.deliveryMethod,
    deliveryAddress: request.deliveryMethod === 'DELIVERY' ? customer?.address : undefined,
    contactPhone: customer?.phone,
    expectedCompletionDate: request.requiredDate || new Date(Date.now() + days * 24 * 3600 * 1000),
    notes: `Custom request ${request.requestNumber}`,
    status: ORDER_STATUS.PENDING,
    statusHistory: [{ status: ORDER_STATUS.PENDING, note: `Created from approved quote ${request.requestNumber}`, changedBy: actor.user._id }],
    createdBy: actor.user._id,
  });

  request.status = CR.CONVERTED;
  request.order = order._id;
  request.history.push({ status: CR.APPROVED, note: note || 'Customer approved the quote', by: actor.user._id });
  request.history.push({ status: CR.CONVERTED, note: `Order ${order.orderNumber} created`, by: actor.user._id });
  await request.save();

  await audit(actor, { action: AUDIT_ACTIONS.CREATE, entity: 'Order', entityId: order._id, reference: order.orderNumber, amount: total, description: `Custom order from ${request.requestNumber}` });
  await notify.notifyOwners({
    type: 'NEW_ORDER',
    title: `Quote approved — order ${order.orderNumber}`,
    message: `${customer?.name} approved ${request.requestNumber} (${total.toLocaleString()} ${settings.currency}).`,
    link: `/app/orders/${order._id}`,
  });
  return { request, order };
}

async function cancelByCustomer(id, customerId, actor) {
  const request = await CustomFurnitureRequest.findOne({ _id: id, customer: customerId });
  if (!request) throw ApiError.notFound('Custom furniture request not found.');
  if (![CR.SUBMITTED, CR.UNDER_REVIEW, CR.ESTIMATED, CR.QUOTED].includes(request.status)) {
    throw ApiError.badRequest('This request can no longer be cancelled.');
  }
  request.status = CR.CANCELLED;
  request.history.push({ status: CR.CANCELLED, note: 'Cancelled by customer', by: actor.user._id });
  await request.save();
  return request;
}

// Customers never see internal cost estimates.
function toCustomerView(request) {
  const r = typeof request.toObject === 'function' ? request.toObject() : { ...request };
  delete r.estimate;
  delete r.reviewedBy;
  r.history = (r.history || []).filter((h) => !String(h.note || '').startsWith('Warning')).map(({ status, at }) => ({ status, at }));
  return r;
}

module.exports = {
  submitRequest,
  startReview,
  saveEstimate,
  sendQuote,
  rejectRequest,
  respondToQuote,
  cancelByCustomer,
  toCustomerView,
};
