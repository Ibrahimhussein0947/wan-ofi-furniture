import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';
import AccountLayout from './layouts/AccountLayout';
import { ProtectedRoute, RequirePermission, GuestOnly } from './routes/guards';
import { PageLoader } from './components/ui/States';
import ErrorBoundary from './components/ErrorBoundary';

// Public site
const Home = lazy(() => import('./pages/public/Home'));
const Shop = lazy(() => import('./pages/public/Shop'));
const ProductDetail = lazy(() => import('./pages/public/ProductDetail'));
const Categories = lazy(() => import('./pages/public/Categories'));
const CustomFurniture = lazy(() => import('./pages/public/CustomFurniture'));
const About = lazy(() => import('./pages/public/About'));
const Contact = lazy(() => import('./pages/public/Contact'));
const Cart = lazy(() => import('./pages/public/Cart'));
const Checkout = lazy(() => import('./pages/public/Checkout'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const NotFound = lazy(() => import('./pages/NotFound'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));

// Shared
const InvoiceView = lazy(() => import('./pages/shared/InvoiceView'));
const ReceiptView = lazy(() => import('./pages/shared/ReceiptView'));
const Messages = lazy(() => import('./pages/shared/Messages'));
const Notifications = lazy(() => import('./pages/shared/Notifications'));
const Profile = lazy(() => import('./pages/shared/Profile'));

// Customer portal
const AccountOverview = lazy(() => import('./pages/account/Overview'));
const AccountOrders = lazy(() => import('./pages/account/Orders'));
const AccountOrderDetail = lazy(() => import('./pages/account/OrderDetail'));
const AccountCustomRequests = lazy(() => import('./pages/account/CustomRequests'));
const AccountCustomRequestDetail = lazy(() => import('./pages/account/CustomRequestDetail'));
const AccountInvoices = lazy(() => import('./pages/account/Invoices'));

// Staff app
const Dashboard = lazy(() => import('./pages/staff/Dashboard'));
const Analytics = lazy(() => import('./pages/staff/Analytics'));
const OrderList = lazy(() => import('./pages/staff/orders/OrderList'));
const OrderDetail = lazy(() => import('./pages/staff/orders/OrderDetail'));
const NewOrder = lazy(() => import('./pages/staff/orders/NewOrder'));
const CustomRequestList = lazy(() => import('./pages/staff/custom/CustomRequestList'));
const CustomRequestDetail = lazy(() => import('./pages/staff/custom/CustomRequestDetail'));
const CustomerList = lazy(() => import('./pages/staff/customers/CustomerList'));
const CustomerDetail = lazy(() => import('./pages/staff/customers/CustomerDetail'));
const DeliveryList = lazy(() => import('./pages/staff/deliveries/DeliveryList'));
const DeliveryDetail = lazy(() => import('./pages/staff/deliveries/DeliveryDetail'));
const ProductionBoard = lazy(() => import('./pages/staff/production/Board'));
const JobDetail = lazy(() => import('./pages/staff/production/JobDetail'));
const Tasks = lazy(() => import('./pages/staff/production/Tasks'));
const QualityList = lazy(() => import('./pages/staff/quality/QualityList'));
const Inspect = lazy(() => import('./pages/staff/quality/Inspect'));
const ProductList = lazy(() => import('./pages/staff/catalog/ProductList'));
const ProductForm = lazy(() => import('./pages/staff/catalog/ProductForm'));
const CategoryAdmin = lazy(() => import('./pages/staff/catalog/Categories'));
const Inventory = lazy(() => import('./pages/staff/inventory/Inventory'));
const Materials = lazy(() => import('./pages/staff/inventory/Materials'));
const MaterialDetail = lazy(() => import('./pages/staff/inventory/MaterialDetail'));
const Bom = lazy(() => import('./pages/staff/inventory/Bom'));
const SupplierList = lazy(() => import('./pages/staff/suppliers/SupplierList'));
const SupplierDetail = lazy(() => import('./pages/staff/suppliers/SupplierDetail'));
const Purchases = lazy(() => import('./pages/staff/suppliers/Purchases'));
const PurchaseDetail = lazy(() => import('./pages/staff/suppliers/PurchaseDetail'));
const Payments = lazy(() => import('./pages/staff/finance/Payments'));
const Invoices = lazy(() => import('./pages/staff/finance/Invoices'));
const Expenses = lazy(() => import('./pages/staff/finance/Expenses'));
const Ledger = lazy(() => import('./pages/staff/finance/Ledger'));
const Reports = lazy(() => import('./pages/staff/finance/Reports'));
const Workers = lazy(() => import('./pages/staff/people/Workers'));
const WorkerDetail = lazy(() => import('./pages/staff/people/WorkerDetail'));
const Users = lazy(() => import('./pages/staff/people/Users'));
const AuditLogs = lazy(() => import('./pages/staff/admin/AuditLogs'));
const Settings = lazy(() => import('./pages/staff/admin/Settings'));
const Branches = lazy(() => import('./pages/staff/admin/Branches'));

const p = (perms, element) => <RequirePermission perms={perms}>{element}</RequirePermission>;

export default function App() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Shop />} />
          <Route path="products/:slug" element={<ProductDetail />} />
          <Route path="categories" element={<Categories />} />
          <Route path="custom-furniture" element={<CustomFurniture />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="cart" element={<Cart />} />
          <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
            <Route path="checkout" element={<Checkout />} />
          </Route>
          <Route element={<GuestOnly />}>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
          </Route>
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
          <Route path="account" element={<AccountLayout />}>
            <Route index element={<AccountOverview />} />
            <Route path="orders" element={<AccountOrders />} />
            <Route path="orders/:id" element={<AccountOrderDetail />} />
            <Route path="custom-requests" element={<AccountCustomRequests />} />
            <Route path="custom-requests/:id" element={<AccountCustomRequestDetail />} />
            <Route path="invoices" element={<AccountInvoices />} />
            <Route path="invoices/:id" element={<InvoiceView />} />
            <Route path="receipts/:id" element={<ReceiptView />} />
            <Route path="messages" element={<Messages />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['OWNER', 'ACCOUNTANT', 'WORKER']} />}>
          <Route path="app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="analytics" element={p(['analytics:read'], <Analytics />)} />
            <Route path="orders" element={p(['orders:read'], <OrderList />)} />
            <Route path="orders/new" element={p(['orders:write'], <NewOrder />)} />
            <Route path="orders/:id" element={p(['orders:read'], <OrderDetail />)} />
            <Route path="custom-orders" element={p(['custom-requests:manage', 'orders:read'], <CustomRequestList />)} />
            <Route path="custom-orders/:id" element={p(['custom-requests:manage', 'orders:read'], <CustomRequestDetail />)} />
            <Route path="customers" element={p(['customers:read'], <CustomerList />)} />
            <Route path="customers/:id" element={p(['customers:read'], <CustomerDetail />)} />
            <Route path="deliveries" element={p(['deliveries:read', 'orders:read'], <DeliveryList />)} />
            <Route path="deliveries/:id" element={p(['deliveries:read', 'orders:read'], <DeliveryDetail />)} />
            <Route path="production" element={p(['production:read'], <ProductionBoard />)} />
            <Route path="production/:id" element={p(['production:read'], <JobDetail />)} />
            <Route path="tasks" element={p(['production:read'], <Tasks />)} />
            <Route path="quality" element={p(['quality:manage'], <QualityList />)} />
            <Route path="quality/:id" element={p(['quality:manage'], <Inspect />)} />
            <Route path="products" element={p(['products:write'], <ProductList />)} />
            <Route path="products/new" element={p(['products:write'], <ProductForm />)} />
            <Route path="products/:id" element={p(['products:write'], <ProductForm />)} />
            <Route path="categories" element={p(['categories:write'], <CategoryAdmin />)} />
            <Route path="inventory" element={p(['inventory:read'], <Inventory />)} />
            <Route path="materials" element={p(['materials:read'], <Materials />)} />
            <Route path="materials/:id" element={p(['materials:read'], <MaterialDetail />)} />
            <Route path="bom" element={p(['bom:read'], <Bom />)} />
            <Route path="suppliers" element={p(['suppliers:read'], <SupplierList />)} />
            <Route path="suppliers/:id" element={p(['suppliers:read'], <SupplierDetail />)} />
            <Route path="purchases" element={p(['purchases:read'], <Purchases />)} />
            <Route path="purchases/:id" element={p(['purchases:read'], <PurchaseDetail />)} />
            <Route path="payments" element={p(['payments:read'], <Payments />)} />
            <Route path="receipts/:id" element={p(['payments:read'], <ReceiptView />)} />
            <Route path="invoices" element={p(['invoices:read'], <Invoices />)} />
            <Route path="invoices/:id" element={p(['invoices:read'], <InvoiceView />)} />
            <Route path="expenses" element={p(['expenses:read'], <Expenses />)} />
            <Route path="accounting" element={p(['accounting:read'], <Ledger />)} />
            <Route path="reports" element={p(['reports:financial', 'reports:operations'], <Reports />)} />
            <Route path="workers" element={p(['workers:read'], <Workers />)} />
            <Route path="workers/:id" element={p(['workers:read'], <WorkerDetail />)} />
            <Route path="users" element={p(['users:read'], <Users />)} />
            <Route path="audit-logs" element={p(['audit:read'], <AuditLogs />)} />
            <Route path="settings" element={p(['settings:manage'], <Settings />)} />
            <Route path="branches" element={p(['settings:manage'], <Branches />)} />
            <Route path="messages" element={<Messages />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<NotFound inApp />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
