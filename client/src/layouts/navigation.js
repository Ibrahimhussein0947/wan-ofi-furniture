import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Factory,
  FileText,
  FolderTree,
  Hammer,
  LayoutDashboard,
  Layers,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sofa,
  Truck,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  PackageOpen,
  BookOpen,
  PencilRuler,
} from 'lucide-react';

/**
 * Staff sidebar. Each item lists the permissions that unlock it (any of them).
 * The backend enforces the same rules — this only hides what a user cannot use.
 */
export const STAFF_NAV = [
  {
    section: null,
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/app/analytics', label: 'Analytics', icon: BarChart3, perms: ['analytics:read'] },
    ],
  },
  {
    section: 'Sales',
    items: [
      { to: '/app/orders', label: 'Orders', icon: ShoppingCart, perms: ['orders:read'] },
      { to: '/app/custom-orders', label: 'Custom requests', icon: PencilRuler, perms: ['custom-requests:manage', 'orders:read'] },
      { to: '/app/customers', label: 'Customers', icon: Users, perms: ['customers:read'] },
      { to: '/app/deliveries', label: 'Deliveries', icon: Truck, perms: ['deliveries:read', 'orders:read'] },
    ],
  },
  {
    section: 'Workshop',
    items: [
      { to: '/app/production', label: 'Production', icon: Factory, perms: ['production:read'] },
      { to: '/app/tasks', label: 'My tasks', icon: ClipboardList, roles: ['WORKER'] },
      { to: '/app/quality', label: 'Quality control', icon: ClipboardCheck, perms: ['quality:manage'] },
    ],
  },
  {
    section: 'Catalog & stock',
    items: [
      { to: '/app/products', label: 'Products', icon: Sofa, perms: ['products:write'] },
      { to: '/app/categories', label: 'Categories', icon: FolderTree, perms: ['categories:write'] },
      { to: '/app/inventory', label: 'Inventory', icon: Warehouse, perms: ['inventory:read'] },
      { to: '/app/materials', label: 'Materials', icon: Boxes, perms: ['materials:read'] },
      { to: '/app/bom', label: 'Bill of materials', icon: Layers, perms: ['bom:read'] },
      { to: '/app/suppliers', label: 'Suppliers', icon: Hammer, perms: ['suppliers:read'] },
      { to: '/app/purchases', label: 'Purchase orders', icon: PackageOpen, perms: ['purchases:read'] },
    ],
  },
  {
    section: 'Finance',
    items: [
      { to: '/app/payments', label: 'Payments', icon: CreditCard, perms: ['payments:read'] },
      { to: '/app/invoices', label: 'Invoices', icon: FileText, perms: ['invoices:read'] },
      { to: '/app/expenses', label: 'Expenses', icon: Receipt, perms: ['expenses:read'] },
      { to: '/app/accounting', label: 'Ledger', icon: BookOpen, perms: ['accounting:read'] },
      { to: '/app/reports', label: 'Reports', icon: Wallet, perms: ['reports:financial', 'reports:operations'] },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/app/workers', label: 'Workers', icon: UserCog, perms: ['workers:read'] },
      { to: '/app/users', label: 'Users & roles', icon: ShieldCheck, perms: ['users:read'] },
      { to: '/app/audit-logs', label: 'Audit log', icon: ScrollText, perms: ['audit:read'] },
      { to: '/app/branches', label: 'Branches', icon: Building2, perms: ['settings:manage'] },
      { to: '/app/settings', label: 'Settings', icon: Settings, perms: ['settings:manage'] },
    ],
  },
];

export function visibleNav(auth) {
  return STAFF_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.roles && !item.roles.includes(auth.user?.role)) return false;
      return !item.perms || auth.canAny(...item.perms);
    }),
  })).filter((g) => g.items.length);
}
