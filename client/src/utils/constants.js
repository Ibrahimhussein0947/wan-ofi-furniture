export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PAID', 'IN_PRODUCTION', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
export const PAYMENT_STATUSES = ['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'];
export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CARD', 'OTHER'];
export const DELIVERY_STATUSES = ['PENDING', 'SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'];
export const PRODUCTION_STAGES = [
  'PENDING',
  'APPROVED',
  'MATERIALS_REQUIRED',
  'MATERIALS_READY',
  'IN_PRODUCTION',
  'ASSEMBLY',
  'FINISHING',
  'QUALITY_CHECK',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];
export const WORKER_ROLES = ['CARPENTER', 'ASSEMBLER', 'UPHOLSTERER', 'PAINTER', 'DESIGNER', 'INSTALLER', 'FINISHER', 'SUPERVISOR'];
export const STAFF_ROLES = ['OWNER', 'ACCOUNTANT', 'WORKER'];
export const EXPENSE_CATEGORIES = ['RENT', 'UTILITIES', 'SALARIES', 'TRANSPORT', 'MAINTENANCE', 'MARKETING', 'MATERIALS', 'EQUIPMENT', 'TAXES', 'OTHER'];
export const MATERIAL_CATEGORIES = ['WOOD', 'BOARD', 'FOAM', 'FABRIC', 'LEATHER', 'FINISH', 'ADHESIVE', 'HARDWARE', 'PACKAGING', 'OTHER'];
export const TRANSACTION_TYPES = ['SALE', 'CUSTOMER_PAYMENT', 'EXPENSE', 'SUPPLIER_PAYMENT', 'WORKER_PAYMENT', 'REFUND', 'PURCHASE', 'OTHER_INCOME', 'DISCOUNT'];
export const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED'];
export const CUSTOM_REQUEST_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'ESTIMATED', 'QUOTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED'];
export const QC_ITEMS = [
  ['dimensions', 'Dimensions'],
  ['structure', 'Structure'],
  ['finishing', 'Finishing'],
  ['color', 'Color'],
  ['materialQuality', 'Material quality'],
  ['assembly', 'Assembly'],
  ['customerSpecifications', 'Customer specifications'],
  ['defects', 'Free of defects'],
  ['cleanliness', 'Cleanliness'],
  ['packaging', 'Packaging'],
];

// Stages each worker position may move a job into (mirrors the server rules for UI hints).
export const WORKER_STAGE_PERMISSIONS = {
  CARPENTER: ['IN_PRODUCTION', 'ASSEMBLY'],
  ASSEMBLER: ['ASSEMBLY', 'FINISHING'],
  UPHOLSTERER: ['IN_PRODUCTION', 'ASSEMBLY', 'FINISHING'],
  PAINTER: ['FINISHING', 'QUALITY_CHECK'],
  FINISHER: ['FINISHING', 'QUALITY_CHECK'],
  DESIGNER: ['MATERIALS_REQUIRED'],
  INSTALLER: ['DELIVERED'],
  SUPERVISOR: PRODUCTION_STAGES,
};

export const STAGE_TRANSITIONS = {
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['MATERIALS_REQUIRED', 'MATERIALS_READY', 'IN_PRODUCTION', 'CANCELLED'],
  MATERIALS_REQUIRED: ['MATERIALS_READY', 'CANCELLED'],
  MATERIALS_READY: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['ASSEMBLY', 'FINISHING', 'QUALITY_CHECK'],
  ASSEMBLY: ['IN_PRODUCTION', 'FINISHING', 'QUALITY_CHECK'],
  FINISHING: ['ASSEMBLY', 'QUALITY_CHECK'],
  QUALITY_CHECK: [],
  READY_FOR_DELIVERY: [],
  DELIVERED: [],
  CANCELLED: [],
};

// Tone per status, used by StatusBadge.
export const STATUS_TONES = {
  PENDING: 'amber',
  SUBMITTED: 'amber',
  UNDER_REVIEW: 'blue',
  ESTIMATED: 'blue',
  QUOTED: 'violet',
  APPROVED: 'blue',
  CONFIRMED: 'blue',
  SCHEDULED: 'blue',
  ORDERED: 'blue',
  ISSUED: 'blue',
  MATERIALS_REQUIRED: 'amber',
  MATERIALS_READY: 'teal',
  IN_PRODUCTION: 'violet',
  IN_PROGRESS: 'violet',
  ASSEMBLY: 'violet',
  FINISHING: 'violet',
  QUALITY_CHECK: 'teal',
  READY: 'teal',
  READY_FOR_DELIVERY: 'teal',
  OUT_FOR_DELIVERY: 'teal',
  PARTIALLY_RECEIVED: 'teal',
  PARTIAL: 'amber',
  PARTIALLY_PAID: 'amber',
  PAID: 'green',
  PASSED: 'green',
  DELIVERED: 'green',
  COMPLETED: 'green',
  RECEIVED: 'green',
  DONE: 'green',
  ACTIVE: 'green',
  CONVERTED: 'green',
  IN_STOCK: 'green',
  MADE_TO_ORDER: 'blue',
  UNPAID: 'red',
  FAILED: 'red',
  REJECTED: 'red',
  REWORK_REQUIRED: 'red',
  CANCELLED: 'stone',
  VOID: 'stone',
  INACTIVE: 'stone',
  DISCONTINUED: 'stone',
  REFUNDED: 'stone',
  OUT_OF_STOCK: 'red',
  DRAFT: 'stone',
  TODO: 'stone',
  BLOCKED: 'red',
  PENDING_VERIFICATION: 'amber',
  LOW: 'stone',
  NORMAL: 'blue',
  HIGH: 'amber',
  URGENT: 'red',
  MEDIUM: 'amber',
};
