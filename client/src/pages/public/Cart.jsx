import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import ProductImage from '../../components/ProductImage';
import { EmptyState } from '../../components/ui/States';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { money } from '../../utils/format';
import { usePublicSettings } from '../../components/SettingsLoader';

export default function Cart() {
  const { items, update, remove, subtotal, lineKey } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = usePublicSettings();

  if (!items.length) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={ShoppingBag} title="Your cart is empty" message="Browse our collection and add the pieces you love." action={<Button to="/products">Start shopping</Button>} />
      </div>
    );
  }

  const checkout = () => {
    if (!user) navigate('/login', { state: { from: { pathname: '/checkout' } } });
    else navigate('/checkout');
  };

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-4xl font-semibold text-walnut-950">Your cart</h1>
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
                      <p className="text-sm text-stone-500">{[item.color, item.size].filter(Boolean).join(' · ')}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{money(item.price * item.quantity)}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center rounded-full border border-stone-300">
                      <button type="button" className="p-2" onClick={() => update(key, item.quantity - 1)} aria-label="Decrease quantity">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                      <button type="button" className="p-2" onClick={() => update(key, item.quantity + 1)} aria-label="Increase quantity">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button type="button" onClick={() => remove(key)} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-red-600">
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <aside className="h-fit rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-semibold text-walnut-950">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">Subtotal</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-600">Delivery</dt>
              <dd>{settings?.defaultDeliveryFee ? money(settings.defaultDeliveryFee) : 'Free'}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-brass-50 p-3 text-xs text-brass-800">
            {settings?.taxRate > 0 && `Prices exclude ${settings.taxRate}% VAT, added at checkout. `}Pay a {settings?.depositPercent ?? 40}% deposit to confirm your order. The balance is due before delivery. Final prices are confirmed at checkout.
          </p>
          <Button block size="lg" className="mt-5" onClick={checkout}>
            {user ? 'Proceed to checkout' : 'Log in to check out'}
          </Button>
          <Link to="/products" className="mt-3 block text-center text-sm text-walnut-700 hover:underline">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
