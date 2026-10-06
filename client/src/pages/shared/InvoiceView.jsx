import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { QueryState } from '../../components/ui/States';
import Logo from '../../components/Logo';
import { invoicesApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { date, label, money, warrantyLabel } from '../../utils/format';
import { useT } from '../../i18n/LanguageContext';

// Scannable account summary for the printed invoice (SVG prints crisply).
const accountQr = (a, companyName) =>
  [
    `${a.type === 'MOBILE_WALLET' ? 'Wallet' : 'Bank'}: ${a.bankName}`,
    `Name: ${a.accountName}`,
    `Account: ${a.accountNumber}`,
    a.branch && `Branch: ${a.branch}`,
    companyName && `Pay to: ${companyName}`,
  ]
    .filter(Boolean)
    .join('\n');

export function DocumentHeader({ company, title, number, status }) {
  return (
    <div className='flex flex-wrap items-start justify-between gap-6 border-b border-stone-200 pb-6'>
      <div>
        <Logo />
        <p className='mt-3 text-sm text-stone-600'>{company?.address}</p>
        <p className='text-sm text-stone-600'>
          {company?.phone} · {company?.email}
        </p>
      </div>
      <div className='text-right'>
        <p className='font-display text-3xl font-semibold uppercase tracking-wide text-walnut-900'>
          {title}
        </p>
        <p className='mt-1 font-mono text-sm text-stone-700'>{number}</p>
        {status && <StatusBadge status={status} className='mt-2' />}
      </div>
    </div>
  );
}

export default function InvoiceView() {
  const t = useT();
  const { id } = useParams();
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['invoice', id], queryFn: () => invoicesApi.get(id) });
  const back = user?.role === 'CUSTOMER' ? '/account/invoices' : '/app/invoices';

  return (
    <QueryState query={query}>
      {(inv) => (
        <div className='mx-auto max-w-3xl'>
          <div className='no-print mb-4 flex justify-between'>
            <Button to={back} variant='ghost' size='sm'>
              ← Back
            </Button>
            <Button variant='secondary' size='sm' icon={Printer} onClick={() => window.print()}>
              {t('Print / Save PDF')}
            </Button>
          </div>
          <article className='card p-6 sm:p-10'>
            <DocumentHeader
              company={inv.company}
              title={t('Invoice')}
              number={inv.invoiceNumber}
              status={inv.status}
            />
            <div className='grid gap-6 py-6 sm:grid-cols-2'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-stone-500'>
                  {t('Billed to')}
                </p>
                <p className='mt-1 font-medium'>{inv.customer?.name}</p>
                <p className='text-sm text-stone-600'>{inv.customer?.phone}</p>
                <p className='text-sm text-stone-600'>{inv.customer?.email}</p>
                <p className='text-sm text-stone-600'>
                  {[inv.customer?.address?.street, inv.customer?.address?.city]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
              <div className='text-sm sm:text-right'>
                <p>
                  <span className='text-stone-500'>{t('Order:')}</span> {inv.order?.orderNumber}
                </p>
                <p>
                  <span className='text-stone-500'>{t('Issued:')}</span> {date(inv.issueDate)}
                </p>
                <p>
                  <span className='text-stone-500'>{t('Due:')}</span> {date(inv.dueDate)}
                </p>
              </div>
            </div>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-y border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500'>
                  <th className='py-2'>{t('Description')}</th>
                  <th className='py-2 text-right'>{t('Qty')}</th>
                  <th className='py-2 text-right'>{t('Unit price')}</th>
                  <th className='py-2 text-right'>{t('Amount')}</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-stone-100'>
                {inv.lines.map((l, i) => (
                  <tr key={i}>
                    <td className='py-2.5'>
                      {l.description}
                      {l.warrantyMonths > 0 && (
                        <span className='block text-xs text-stone-500'>
                          {warrantyLabel(l.warrantyMonths, t)}
                        </span>
                      )}
                    </td>
                    <td className='py-2.5 text-right tabular-nums'>{l.quantity}</td>
                    <td className='py-2.5 text-right tabular-nums'>{money(l.unitPrice)}</td>
                    <td className='py-2.5 text-right tabular-nums'>{money(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className='ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm'>
              {[
                ['Subtotal', inv.subtotal],
                inv.discount > 0 && ['Discount', -inv.discount],
                inv.tax > 0 && [`VAT (${inv.taxRate}%)`, inv.tax],
                inv.deliveryFee > 0 && ['Delivery', inv.deliveryFee],
                ['Total', inv.total, true],
                ['Paid', inv.amountPaid],
              ]
                .filter(Boolean)
                .map(([k, v, bold]) => (
                  <div
                    key={k}
                    className={`flex justify-between ${bold ? 'border-t border-stone-200 pt-1.5 font-semibold' : ''}`}
                  >
                    <dt>{k}</dt>
                    <dd className='tabular-nums'>{money(v)}</dd>
                  </div>
                ))}
              <div className='flex justify-between rounded-lg bg-walnut-50 px-3 py-2 text-base font-semibold text-walnut-900'>
                <dt>{t('Balance due')}</dt>
                <dd className='tabular-nums'>{money(inv.balance)}</dd>
              </div>
            </dl>
            {inv.payments?.length > 0 && (
              <div className='mt-8'>
                <p className='text-xs font-semibold uppercase tracking-wide text-stone-500'>
                  {t('Payments received')}
                </p>
                <ul className='mt-2 divide-y divide-stone-100 text-sm'>
                  {inv.payments.map((p) => (
                    <li key={p._id} className='flex justify-between py-1.5'>
                      <span>
                        {date(p.paidAt)} · {t(label(p.method))} · {p.receiptNumber}
                      </span>
                      <span className='tabular-nums'>{money(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {inv.balance > 0 &&
              (inv.company?.bankAccounts?.length > 0 || inv.company?.paymentInstructions) && (
                <div className='mt-8 rounded-lg border border-brass-200 bg-brass-50 p-4 text-sm text-brass-900'>
                  <p className='font-semibold'>{t('How to pay')}</p>
                  {inv.company.bankAccounts?.length > 0 && (
                    <ul className='mt-2 space-y-2'>
                      {inv.company.bankAccounts.map((a, i) => (
                        <li
                          key={`${a.accountNumber}-${i}`}
                          className='flex items-center justify-between gap-3'
                        >
                          <span>
                            <span className='font-medium'>
                              {a.bankName}
                              {a.branch ? ` · ${a.branch}` : ''}
                            </span>{' '}
                            — {a.accountName} · <span className='font-mono'>{a.accountNumber}</span>
                            {a.type === 'MOBILE_WALLET' && (
                              <span className='text-xs'> ({t('Mobile money')})</span>
                            )}
                          </span>
                          <span
                            className='rounded border border-brass-200 bg-white p-1'
                            title={t('Scan for the account details')}
                          >
                            <QRCodeSVG
                              value={accountQr(a, inv.company?.name)}
                              size={56}
                              level='M'
                            />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {inv.company.paymentInstructions && (
                    <p className='mt-1'>{inv.company.paymentInstructions}</p>
                  )}
                </div>
              )}
            <p className='mt-10 text-center text-xs text-stone-400'>
              Thank you for choosing {inv.company?.name}.
            </p>
          </article>
        </div>
      )}
    </QueryState>
  );
}
