const { ROLES, WORKER_ROLES, PRODUCTION_STAGES: S } = require('./constants');

const PERMISSIONS = Object.freeze({
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  PERMISSIONS_MANAGE: 'permissions:manage',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  WORKERS_READ: 'workers:read',
  WORKERS_WRITE: 'workers:write',
  PRODUCTS_WRITE: 'products:write',
  CATEGORIES_WRITE: 'categories:write',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write',
  MATERIALS_READ: 'materials:read',
  MATERIALS_WRITE: 'materials:write',
  MATERIALS_ISSUE: 'materials:issue',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_WRITE: 'suppliers:write',
  PURCHASES_READ: 'purchases:read',
  PURCHASES_WRITE: 'purchases:write',
  BOM_READ: 'bom:read',
  BOM_WRITE: 'bom:write',
  ORDERS_READ: 'orders:read',
  ORDERS_WRITE: 'orders:write',
  ORDERS_APPROVE: 'orders:approve',
  CUSTOM_REQUESTS_MANAGE: 'custom-requests:manage',
  PRODUCTION_READ: 'production:read',
  PRODUCTION_MANAGE: 'production:manage',
  PRODUCTION_UPDATE: 'production:update',
  QUALITY_MANAGE: 'quality:manage',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
  REFUNDS_WRITE: 'refunds:write',
  DISCOUNTS_WRITE: 'discounts:write',
  INVOICES_READ: 'invoices:read',
  INVOICES_WRITE: 'invoices:write',
  EXPENSES_READ: 'expenses:read',
  EXPENSES_WRITE: 'expenses:write',
  EXPENSES_APPROVE: 'expenses:approve',
  ACCOUNTING_READ: 'accounting:read',
  ACCOUNTING_WRITE: 'accounting:write',
  DELIVERIES_READ: 'deliveries:read',
  DELIVERIES_MANAGE: 'deliveries:manage',
  DELIVERIES_UPDATE: 'deliveries:update',
  REPORTS_FINANCIAL: 'reports:financial',
  REPORTS_OPERATIONS: 'reports:operations',
  ANALYTICS_READ: 'analytics:read',
  SETTINGS_MANAGE: 'settings:manage',
  AUDIT_READ: 'audit:read',
});

const P = PERMISSIONS;
const ALL = '*';

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.OWNER]: [ALL],
  [ROLES.ACCOUNTANT]: [
    P.CUSTOMERS_READ,
    P.CUSTOMERS_WRITE,
    P.WORKERS_READ,
    P.INVENTORY_READ,
    P.MATERIALS_READ,
    P.SUPPLIERS_READ,
    P.SUPPLIERS_WRITE,
    P.PURCHASES_READ,
    P.PURCHASES_WRITE,
    P.BOM_READ,
    P.ORDERS_READ,
    P.ORDERS_WRITE,
    P.PRODUCTION_READ,
    P.PAYMENTS_READ,
    P.PAYMENTS_WRITE,
    P.REFUNDS_WRITE,
    P.DISCOUNTS_WRITE,
    P.INVOICES_READ,
    P.INVOICES_WRITE,
    P.EXPENSES_READ,
    P.EXPENSES_WRITE,
    P.ACCOUNTING_READ,
    P.ACCOUNTING_WRITE,
    P.DELIVERIES_READ,
    P.REPORTS_FINANCIAL,
  ],
  [ROLES.WORKER]: [P.PRODUCTION_READ, P.PRODUCTION_UPDATE, P.MATERIALS_READ, P.BOM_READ],
  [ROLES.CUSTOMER]: [],
});

// Extra permissions granted by a worker's position.
const WORKER_ROLE_PERMISSIONS = Object.freeze({
  [WORKER_ROLES.SUPERVISOR]: [
    P.PRODUCTION_MANAGE,
    P.MATERIALS_ISSUE,
    P.QUALITY_MANAGE,
    P.WORKERS_READ,
    P.INVENTORY_READ,
    P.ORDERS_READ,
    P.CUSTOM_REQUESTS_MANAGE,
    P.DELIVERIES_READ,
    P.DELIVERIES_MANAGE,
    P.DELIVERIES_UPDATE,
    P.REPORTS_OPERATIONS,
  ],
  [WORKER_ROLES.INSTALLER]: [P.DELIVERIES_READ, P.DELIVERIES_UPDATE],
  [WORKER_ROLES.DESIGNER]: [P.CUSTOM_REQUESTS_MANAGE],
});

// Production stages each worker position may move a job INTO.
const WORKER_STAGE_PERMISSIONS = Object.freeze({
  [WORKER_ROLES.CARPENTER]: [S.IN_PRODUCTION, S.ASSEMBLY],
  [WORKER_ROLES.ASSEMBLER]: [S.ASSEMBLY, S.FINISHING],
  [WORKER_ROLES.UPHOLSTERER]: [S.IN_PRODUCTION, S.ASSEMBLY, S.FINISHING],
  [WORKER_ROLES.PAINTER]: [S.FINISHING, S.QUALITY_CHECK],
  [WORKER_ROLES.FINISHER]: [S.FINISHING, S.QUALITY_CHECK],
  [WORKER_ROLES.DESIGNER]: [S.MATERIALS_REQUIRED],
  [WORKER_ROLES.INSTALLER]: [S.DELIVERED],
  [WORKER_ROLES.SUPERVISOR]: Object.values(S),
});

function getPermissionsFor(user) {
  if (!user) return [];
  const set = new Set(ROLE_PERMISSIONS[user.role] || []);
  if (user.role === ROLES.WORKER && user.workerRole) {
    (WORKER_ROLE_PERMISSIONS[user.workerRole] || []).forEach((p) => set.add(p));
  }
  (user.permissions || []).forEach((p) => set.add(p));
  return [...set];
}

function hasPermission(user, permission) {
  const perms = getPermissionsFor(user);
  return perms.includes(ALL) || perms.includes(permission);
}

function canMoveToStage(user, stage) {
  if (!user) return false;
  if (user.role === ROLES.OWNER) return true;
  if (hasPermission(user, P.PRODUCTION_MANAGE)) return true;
  if (user.role !== ROLES.WORKER) return false;
  return (WORKER_STAGE_PERMISSIONS[user.workerRole] || []).includes(stage);
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  WORKER_ROLE_PERMISSIONS,
  WORKER_STAGE_PERMISSIONS,
  ALL_PERMISSIONS: Object.values(PERMISSIONS),
  getPermissionsFor,
  hasPermission,
  canMoveToStage,
};
