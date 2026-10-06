import { useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Button from './ui/Button';
import { usePublicSettings } from './SettingsLoader';
import { label } from '../utils/format';
import { useT } from '../i18n/LanguageContext';

// Scannable summary of an account so customers can copy the details into their banking app.
const qrValue = (a, companyName) =>
  [
    `${a.type === 'MOBILE_WALLET' ? 'Wallet' : 'Bank'}: ${a.bankName}`,
    `Name: ${a.accountName}`,
    `Account: ${a.accountNumber}`,
    a.branch && `Branch: ${a.branch}`,
    companyName && `Pay to: ${companyName}`,
  ]
    .filter(Boolean)
    .join('\n');

/** Click to reveal a large QR code for the account (SVG, so it stays crisp). */
function AccountQr({ account, companyName }) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className='mt-2'>
      <button
        type='button'
        className='inline-flex items-center gap-1 text-xs font-medium text-brass-700 hover:underline'
        onClick={() => setShow((s) => !s)}
        aria-expanded={show}
      >
        <QrCode className='h-3.5 w-3.5' />
        {show ? t('Hide QR code') : t('Show QR code')}
      </button>
      {show && (
        <div className='mt-2 inline-block rounded-lg border border-stone-200 bg-white p-2'>
          <QRCodeSVG value={qrValue(account, companyName)} size={128} level='M' />
          <p className='mt-1 max-w-[128px] text-center text-[10px] leading-tight text-stone-500'>
            {t('Scan to see the account details')}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The bank / mobile-money accounts the admin set up in Settings, for customers to pay into.
 * Renders nothing when no accounts are active. `compact` drops the QR codes and notes.
 */
export default function BankAccounts({ title, compact = false, className }) {
  const t = useT();
  const { data: settings } = usePublicSettings();
  const accounts = settings?.bankAccounts || [];
  if (!accounts.length) return null;

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('Account number copied'));
    } catch {
      toast.error(t('Copying is not allowed here — please copy it manually'));
    }
  };

  return (
    <div className={className}>
      {title !== null && (
        <p className='mb-2 text-sm font-semibold text-stone-700'>{title || t('Transfer into one of these accounts')}</p>
      )}
      <ul className='space-y-2'>
        {accounts.map((a, i) => (
          <li key={`${a.accountNumber}-${i}`} className='rounded-lg border border-brass-200 bg-brass-50 p-3'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0 text-sm text-brass-900'>
                <p className='font-semibold'>
                  {a.bankName}
                  {a.branch ? ` · ${a.branch}` : ''}
                </p>
                {!compact && <p className='text-xs uppercase tracking-wide text-brass-700'>{t(label(a.type))}</p>}
                <p className='mt-1 font-medium'>{a.accountName}</p>
                <p className='break-all font-mono'>{a.accountNumber}</p>
                {!compact && a.notes && <p className='mt-1 text-xs text-brass-700'>{a.notes}</p>}
                {!compact && <AccountQr account={a} companyName={settings?.companyName} />}
              </div>
              <Button size='sm' variant='secondary' icon={Copy} onClick={() => copy(a.accountNumber)}>
                {t('Copy')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
