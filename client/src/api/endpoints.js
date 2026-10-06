import api, { toFormData } from './client';

const data = (res) => res.data.data;
const page = (res) => ({
  items: res.data.data,
  pagination: res.data.pagination,
  meta: res.data.meta,
});
const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );

/** CRUD helpers for a REST resource. */
function resource(path) {
  return {
    list: (params) => api.get(path, { params: clean(params) }).then(page),
    get: (id) => api.get(`${path}/${id}`).then(data),
    create: (body) => api.post(path, body).then(data),
    update: (id, body) => api.patch(`${path}/${id}`, body).then(data),
    remove: (id) => api.delete(`${path}/${id}`).then(data),
    action: (id, action, body = {}) => api.post(`${path}/${id}/${action}`, body).then(data),
  };
}

export const authApi = {
  login: (body) => api.post('/auth/login', body).then(data),
  register: (body) => api.post('/auth/register', body).then(data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me').then(data),
  updateProfile: (body) => api.patch('/auth/profile', body).then(data),
  changePassword: (body) => api.patch('/auth/password', body).then(data),
  changeEmail: (body) => api.patch('/auth/email', body).then((r) => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (body) => api.post('/auth/reset-password', body).then((r) => r.data),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }).then((r) => r.data),
  resendVerification: () => api.post('/auth/resend-verification').then((r) => r.data),
  chatChannels: () => api.get('/auth/chat-channels').then(data),
  telegramLink: () => api.post('/auth/telegram/link').then(data),
  telegramDisconnect: () => api.delete('/auth/telegram').then(data),
};

export const publicApi = {
  settings: () => api.get('/public/settings').then(data),
  contact: (body) => api.post('/public/contact', body).then((r) => r.data),
};

export const categoriesApi = resource('/categories');
export const productsApi = {
  ...resource('/products'),
  create: (body, images) => api.post('/products', toFormData(body, { images })).then(data),
  update: (id, body, images) =>
    api.patch(`/products/${id}`, toFormData(body, { images })).then(data),
  reviews: (id, params) => api.get(`/products/${id}/reviews`, { params: clean(params) }).then(data),
  addReview: (id, body) => api.post(`/products/${id}/reviews`, body).then(data),
};

export const wishlistApi = {
  list: () => api.get('/wishlist').then(data),
  add: (productId) => api.put(`/wishlist/${productId}`).then(data),
  remove: (productId) => api.delete(`/wishlist/${productId}`).then(data),
  merge: (productIds) => api.post('/wishlist/merge', { productIds }).then(data),
};

export const promotionsApi = {
  check: (code, subtotal) => api.post('/promotions/check', { code, subtotal }).then(data),
  list: () => api.get('/promotions').then(data),
  create: (body) => api.post('/promotions', body).then(data),
  update: (id, body) => api.patch(`/promotions/${id}`, body).then(data),
};

export const reviewsApi = {
  list: (params) => api.get('/reviews', { params: clean(params) }).then(page),
  setStatus: (id, status) => api.patch(`/reviews/${id}`, { status }).then(data),
};

export const usersApi = {
  ...resource('/users'),
  permissions: () => api.get('/users/permissions').then(data),
};
export const customersApi = resource('/customers');
export const workersApi = {
  ...resource('/workers'),
  payroll: (month) => api.get('/workers/payroll', { params: { month } }).then(data),
};

export const materialsApi = resource('/materials');
export const inventoryApi = {
  overview: () => api.get('/inventory').then(data),
  transfer: (body) => api.post('/inventory/transfer', body).then(data),
  transactions: (params) =>
    api.get('/inventory/transactions', { params: clean(params) }).then(page),
  adjust: (body) => api.post('/inventory/adjust', body).then(data),
};
export const bomApi = {
  list: () => api.get('/bom').then(data),
  get: (productId) => api.get(`/bom/${productId}`).then(data),
  save: (productId, body) => api.put(`/bom/${productId}`, body).then(data),
  calculate: (productId, quantity) =>
    api.get(`/bom/${productId}/calculate`, { params: { quantity } }).then(data),
};
export const suppliersApi = resource('/suppliers');
export const purchasesApi = resource('/purchases');

export const ordersApi = {
  ...resource('/orders'),
  updateItems: (id, body) => api.put(`/orders/${id}/items`, body).then(data),
};
export const customOrdersApi = {
  ...resource('/custom-orders'),
  create: (body, referenceImages) =>
    api.post('/custom-orders', toFormData(body, { referenceImages })).then(data),
};

export const productionApi = {
  ...resource('/production'),
  board: (params) => api.get('/production/board', { params: clean(params) }).then(data),
  uploadImages: (id, images, caption) => {
    const form = new FormData();
    [...images].forEach((f) => form.append('images', f));
    if (caption) form.append('caption', caption);
    return api.post(`/production/${id}/images`, form).then(data);
  },
  handleRequest: (id, requestId, approve) =>
    api.post(`/production/${id}/material-requests/${requestId}`, { approve }).then(data),
  resolveProblem: (id, problemId, resolution) =>
    api.post(`/production/${id}/problems/${problemId}/resolve`, { resolution }).then(data),
};
export const tasksApi = resource('/tasks');
export const qualityApi = {
  ...resource('/quality'),
  inspect: (id, body, images) =>
    api.post(`/quality/${id}/inspect`, toFormData(body, { images })).then(data),
};
export const deliveriesApi = {
  ...resource('/deliveries'),
  proof: (id, files, { kind, receivedBy } = {}) => {
    const form = new FormData();
    [...files].forEach((f) => form.append('images', f));
    if (kind) form.append('kind', kind);
    if (receivedBy) form.append('receivedBy', receivedBy);
    return api.post(`/deliveries/${id}/proof`, form).then(data);
  },
};

export const paymentsApi = {
  list: (params) => api.get('/payments', { params: clean(params) }).then(page),
  get: (id) => api.get(`/payments/${id}`).then(data),
  customer: (body) => api.post('/payments/customer', body).then(data),
  // Customers attach an optional transfer receipt screenshot with their payment proof.
  submit: (body, screenshot) =>
    api.post('/payments/submit', screenshot ? toFormData(body, { screenshot }) : body).then(data),
  verify: (id, body) => api.post(`/payments/${id}/verify`, body).then(data),
  supplier: (body) => api.post('/payments/supplier', body).then(data),
  worker: (body) => api.post('/payments/worker', body).then(data),
  refund: (body) => api.post('/payments/refund', body).then(data),
  mobile: (body) => api.post('/payments/mobile', body).then(data),
  mobileStatus: (reference) => api.get(`/payments/mobile/${reference}`).then(data),
};
export const invoicesApi = resource('/invoices');
export const expensesApi = {
  ...resource('/expenses'),
  create: (body, receipt) => api.post('/expenses', toFormData(body, { receipt })).then(data),
  decide: (id, body) => api.post(`/expenses/${id}/decision`, body).then(data),
};
export const accountingApi = {
  transactions: (params) =>
    api.get('/accounting/transactions', { params: clean(params) }).then(page),
  income: (body) => api.post('/accounting/income', body).then(data),
};

export const reportsApi = {
  run: (name, params) => api.get(`/reports/${name}`, { params: clean(params) }).then(data),
};
export const dashboardApi = {
  get: () => api.get('/dashboard').then(data),
  analytics: () => api.get('/dashboard/analytics').then(data),
};

export const notificationsApi = {
  list: (params) => api.get('/notifications', { params: clean(params) }).then(page),
  unread: () => api.get('/notifications/unread').then(data),
  read: (id) => api.post(`/notifications/${id}/read`),
  readAll: () => api.post('/notifications/read-all'),
};
export const messagesApi = {
  conversations: () => api.get('/messages').then(data),
  contacts: () => api.get('/messages/contacts').then(data),
  thread: (userId) => api.get(`/messages/${userId}`).then(data),
  send: (body, attachments = []) =>
    api.post('/messages', attachments.length ? toFormData(body, { attachments }) : body).then(data),
};

export const auditApi = {
  list: (params) => api.get('/audit-logs', { params: clean(params) }).then(page),
};
export const settingsApi = {
  get: () => api.get('/settings').then(data),
  update: (body) => api.patch('/settings', body).then(data),
};
export const searchApi = { search: (q) => api.get('/search', { params: { q } }).then(data) };

export const branchesApi = {
  ...resource('/branches'),
  list: (params) => api.get('/branches', { params: clean(params) }).then(data),
};
export const eventsApi = { ticket: () => api.post('/events/ticket').then(data) };
