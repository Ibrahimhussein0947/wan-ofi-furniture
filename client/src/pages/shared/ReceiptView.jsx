import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import Button from '../../components/ui/Button';
import { QueryState } from '../../components/ui/States';
import { DocumentHeader } from './InvoiceView';
import { paymentsApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { dateTime, label, money } from '../../utils/format';

const TITLES = { CUSTOMER_PAYMENT: 'Receipt', REFUND: 'Refund note', SUPPLIER_PAYMENT: 'Payment voucher', WORKER_PAYMENT: 'Payment voucher' };

export default function ReceiptView() {
  const { id } = useParams();
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['payment', id], queryFn: () => paymentsApi.get(id) });

  return (
    <QueryState query={query}>
      {(p) => {
        const party = p.customer?.name || p.supplier?.name || p.worker?.user?.name;
        return (
          <div className="mx-auto max-w-2xl">
            <div className="no-print mb-4 flex justify-between">
              <Button to={user?.role === 'CUSTOMER' ? '/account/invoices' : '/app/payments'} variant="ghost" size="sm">
                ← Back
              </Button>
              <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
                Print / Save PDF
              </Button>
            </div>
            <article className="card p-6 sm:p-10">
              <DocumentHeader company={p.company} title={TITLES[p.category] || 'Receipt'} number={p.receiptNumber || p.paymentNumber} status={p.status !== 'COMPLETED' ? p.status : undefined} />
              <dl className="grid gap-4 py-6 text-sm sm:grid-cols-2">
                {[
                  [p.category === 'CUSTOMER_PAYMENT' ? 'Received from' : 'Paid to', party],
                  ['Date', dateTime(p.paidAt)],
                  ['Method', label(p.method)],
                  ['Reference', p.reference || '—'],
                  p.order && ['Order', p.order.orderNumber],
                  p.purchaseOrder && ['Purchase order', p.purchaseOrder.poNumber],
                  p.kind && ['Payment type', label(p.kind)],
                  p.receivedBy && ['Recorded by', p.receivedBy.name],
                ]
                  .filter(Boolean)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs uppercase tracking-wide text-stone-500">{k}</dt>
                      <dd className="mt-0.5 font-medium">{v}</dd>
                    </div>
                  ))}
              </dl>
              <div className="rounded-xl bg-walnut-50 p-5 text-center">
                <p className="text-sm text-stone-600">Amount</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-walnut-900">{money(p.amount)}</p>
              </div>
              {p.order && p.category === 'CUSTOMER_PAYMENT' && (
                <dl className="mt-6 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Order total</dt>
                    <dd className="tabular-nums">{money(p.order.total)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-500">Total paid to date</dt>
                    <dd className="tabular-nums">{money(p.order.amountPaid)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Remaining balance</dt>
                    <dd className="tabular-nums">{money(p.order.balance)}</dd>
                  </div>
                </dl>
              )}
              <p className="mt-10 text-center text-xs text-stone-400">This is a computer-generated document from {p.company?.name}.</p>
            </article>
          </div>
        );
      }}
    </QueryState>
  );
}
