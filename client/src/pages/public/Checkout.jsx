import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Store, Truck } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Field';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { ordersApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { money } from '../../utils/format';
import { usePublicSettings } from '../../components/SettingsLoader';

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { customer } = useAuth();
  const navigate = useNavigate();
  const { data: settings } = usePublicSettings();
  const [method, setMethod] = useState('DELIVERY');
  const { register, handleSubmit, formState } = useForm({
    values: {
      street: customer?.address?.street || '',
      city: customer?.address?.city || '',
      region: customer?.address?.region || '',
      contactPhone: customer?.phone || '',
      notes: '',
    },
  });

  if (!items.length) return <Navigate to="/cart" replace />;
  const deliveryFee = method === 'DELIVERY' ? settings?.defaultDeliveryFee || 0 : 0;
  const taxRate = settings?.taxRate || 0;
  const tax = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + tax + deliveryFee;
  const deposit = Math.round((total * (settings?.depositPercent ?? 40)) / 100);

  const onSubmit = async (values) => {
    if (method === 'DELIVERY' && (!values.street.trim() || !values.city.trim())) {
      toast.error('Please enter your delivery street and city.');
      return;
    }
    try {
      const order = await ordersApi.create({
        items: items.map((i) => ({ product: i.productId, quantity: i.quantity, color: i.color, size: i.size })),
        deliveryMethod: method,
        deliveryAddress: method === 'DELIVERY' ? { street: values.street, city: values.city, region: values.region, country: 'Tanzania' } : undefined,
        contactPhone: values.contactPhone,
        notes: values.notes,
      });
      clear();
      toast.success(`Order ${order.orderNumber} placed!`);
      navigate(`/account/orders/${order._id}?new=1`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-4xl font-semibold text-walnut-950">Checkout</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 font-semibold text-walnut-950">Delivery method</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['DELIVERY', Truck, 'Deliver & install', 'Our team delivers to your address'],
                ['PICKUP', Store, 'Collect from showroom', 'Pick up at our Dar es Salaam showroom'],
              ].map(([value, Icon, title, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMethod(value)}
                  aria-pressed={method === value}
                  className={clsx('flex gap-3 rounded-xl border-2 p-4 text-left transition', method === value ? 'border-walnut-700 bg-walnut-50' : 'border-stone-200 hover:border-walnut-300')}
                >
                  <Icon className="h-5 w-5 text-walnut-700" />
                  <span>
                    <span className="block font-medium text-walnut-950">{title}</span>
                    <span className="text-sm text-stone-500">{text}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
          {method === 'DELIVERY' && (
            <section className="card space-y-4 p-6">
              <h2 className="font-semibold text-walnut-950">Delivery address</h2>
              <Input label="Street / area" required {...register('street')} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="City" required {...register('city')} />
                <Input label="Region" {...register('region')} />
              </div>
            </section>
          )}
          <section className="card space-y-4 p-6">
            <Input label="Contact phone" type="tel" {...register('contactPhone')} />
            <Textarea label="Notes for our team (optional)" rows={3} {...register('notes')} />
          </section>
        </div>

        <aside className="h-fit rounded-2xl bg-white p-6 shadow-card">
          <h2 className="font-semibold text-walnut-950">Your order</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
              <li key={`${i.productId}${i.color}${i.size}`} className="flex justify-between gap-3">
                <span className="text-stone-700">
                  {i.name} × {i.quantity}
                  {i.color && <span className="block text-xs text-stone-500">{i.color}</span>}
                </span>
                <span className="tabular-nums">{money(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-600">Subtotal</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between">
                <dt className="text-stone-600">VAT ({taxRate}%)</dt>
                <dd className="tabular-nums">{money(tax)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-stone-600">Delivery</dt>
              <dd className="tabular-nums">{deliveryFee ? money(deliveryFee) : 'Free'}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(total)}</dd>
            </div>
            <div className="flex justify-between text-brass-800">
              <dt>Deposit to confirm</dt>
              <dd className="tabular-nums">{money(deposit)}</dd>
            </div>
          </dl>
          <Button type="submit" block size="lg" className="mt-6" loading={formState.isSubmitting}>
            Place order
          </Button>
          <p className="mt-3 text-xs text-stone-500">After placing your order you can pay the deposit by bank transfer or mobile money from your account.</p>
        </aside>
      </form>
    </div>
  );
}
