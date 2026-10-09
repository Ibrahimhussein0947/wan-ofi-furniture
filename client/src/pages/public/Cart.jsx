import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import ProductImage from '../../components/ProductImage';
import BankAccounts from '../../components/BankAccounts';
import ImagePicker from '../../components/ui/ImagePicker';
import { Input } from '../../components/ui/Field';
import { EmptyState } from '../../components/ui/States';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../utils/format';
import { usePublicSettings } from '../../components/SettingsLoader';
import { useT } from '../../i18n/LanguageContext';
import usePageMeta from '../../hooks/usePageMeta';

export default function Cart() {
  const t = useT();
  usePageMeta({ title: t('Your cart') });
  const { items, update, remove, subtotal, lineKey } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = usePublicSettings();
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState([]);
  const hasAccounts = (settings?.bankAccounts || []).length > 0;

  if (!items.length) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={ShoppingBag} title={t('Your cart is empty')} message={t('Browse our collection and add the pieces you love.')} action={<Button to="/products">{t('Start shopping')}</Button>} />
      </div>
    );
  }

  const checkout = () => {
    if (!user) navigate('/login', { state: { from: { pathname: '/checkout' } } });
    else if (reference.trim().length >= 3 || receipt.length) {
      if (reference.trim().length < 3) {
        toast.error(t('Enter the transaction reference from your receipt.'));
        return;
      }
      // The payment is submitted against the order as soon as checkout creates it.
      navigate('/checkout', { state: { proof: { reference: reference.trim(), receipt: receipt[0] } } });
    } else navigate('/checkout');
  };

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-4xl font-semibold text-walnut-950">{t('Your cart')}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-walnut-100 rounded-2xl bg-white shadow-card">
          {items.map((item) => {
            const key = lineKey(item);
            return (
              <li key={key} className="flex gap-4 p-4 sm:p-5">
                <Link to={`/products/${item.slug || item.productId}`} className="shrink-0">
                  <ProductImage src={item.image} name={item.name} className="h-24 w-24 rounded-xl" iconClassName="h-8 w-8" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/products/${item.slug || item.productId}`} className="font-semibold text-walnut-950 hover:underline">
                        {item.name}
                      </Link>
                      <p className="text-sm text-stone-500">{[item.color && t(item.color), item.size].filter(Boolean).join(' · ')}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{money(item.price * item.quantity)}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center rounded-full border border-stone-300">
                      <button type="button" className="p-2" onClick={() => update(key, item.quantity - 1)} aria-label={t('Decrease quantity')}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                      <button type="button" className="p-2" onClick={() => update(key, item.quantity + 1)} aria-label={t('Increase quantity')}>
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button type="button" onClick={() => remove(key)} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-red-600">
                      <Trash2 className="h-4 w-4" /> {t('Remove')}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <aside className="h-fit rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-semibold text-walnut-950">{t('Order summary')}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">{t('Subtotal')}</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">{t('Delivery')}</dt>
              <dd>{settings?.defaultDeliveryFee ? money(settings.defaultDeliveryFee) : t('Free')}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-brass-50 p-3 text-xs text-brass-800">
            {settings?.taxRate > 0 && `${t('Prices exclude {rate}% VAT, added at checkout.', { rate: settings.taxRate })} `}{t('Pay a {pct}% deposit to confirm your order. The balance is due before delivery. Final prices are confirmed at checkout.', { pct: settings?.depositPercent ?? 40 })}
          </p>
          <BankAccounts compact className="mt-4" title={t('Pay into one of these accounts after ordering')} />
          {hasAccounts && user && (
            <div className="mt-4 space-y-3 rounded-lg border border-stone-200 p-3">
              <p className="text-sm font-semibold text-stone-700">{t('Already transferred the deposit?')}</p>
              <Input
                label={t('Transaction reference')}
                placeholder={t('Bank reference or mobile-money code')}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <div>
                <p className="mb-1 text-sm font-medium text-stone-700">
                  {t('Payment receipt')} <span className="font-normal text-stone-500">({t('optional — you can add it later')})</span>
                </p>
                <ImagePicker files={receipt} onChange={setReceipt} max={1} label={t('Add receipt')} capture />
              </div>
              <p className="text-xs text-stone-500">{t('We submit it for verification as soon as your order is placed.')}</p>
            </div>
          )}
          <Button block size="lg" className="mt-5" onClick={checkout}>
            {user ? t('Proceed to checkout') : t('Log in to check out')}
          </Button>
          <Link to="/products" className="mt-3 block text-center text-sm text-walnut-700 hover:underline">
            {t('Continue shopping')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
