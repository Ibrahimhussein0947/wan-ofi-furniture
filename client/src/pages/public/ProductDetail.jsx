import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Check, ChevronRight, Clock, Minus, PencilRuler, Plus, Ruler, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import Button from '../../components/ui/Button';
import ProductImage from '../../components/ProductImage';
import ProductCard from '../../components/ProductCard';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader, ErrorState } from '../../components/ui/States';
import { productsApi } from '../../api/endpoints';
import { useCart } from '../../context/CartContext';
import { money } from '../../utils/format';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const query = useQuery({ queryKey: ['product', slug], queryFn: () => productsApi.get(slug) });
  const [image, setImage] = useState(0);
  const [color, setColor] = useState(null);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);

  if (query.isLoading) return <PageLoader />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} title="Product not found" />;
  const p = query.data;
  const selectedColor = color || p.colors?.[0];
  const selectedSize = size || p.sizes?.[0];
  const canBuy = p.availability !== 'OUT_OF_STOCK';
  const d = p.dimensions || {};

  const addToCart = (goToCart) => {
    add(p, { quantity: qty, color: selectedColor, size: selectedSize });
    toast.success('Added to cart');
    if (goToCart) navigate('/cart');
  };

  return (
    <div className="container-page py-8">
      <nav className="mb-6 flex items-center gap-1 text-sm text-stone-500" aria-label="Breadcrumb">
        <Link to="/products" className="hover:text-walnut-700">
          Shop
        </Link>
        <ChevronRight className="h-4 w-4" />
        {p.category && (
          <>
            <Link to={`/products?category=${p.category.slug}`} className="hover:text-walnut-700">
              {p.category.name}
            </Link>
            <ChevronRight className="h-4 w-4" />
          </>
        )}
        <span className="truncate text-stone-800">{p.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <ProductImage src={p.images?.[image]} name={p.name} className="aspect-square w-full rounded-3xl" iconClassName="h-32 w-32" />
          {p.images?.length > 1 && (
            <div className="mt-3 flex gap-3 overflow-x-auto">
              {p.images.map((src, i) => (
                <button key={src} type="button" onClick={() => setImage(i)} className={clsx('h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2', i === image ? 'border-walnut-700' : 'border-transparent')}>
                  <ProductImage src={src} name={p.name} className="h-full w-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass-600">{p.category?.name}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-walnut-950">{p.name}</h1>
          <p className="mt-1 text-sm text-stone-500">SKU {p.sku}</p>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-walnut-900">{money(p.sellingPrice)}</span>
            {p.price > p.sellingPrice && <span className="text-lg text-stone-400 line-through">{money(p.price)}</span>}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <StatusBadge status={p.availability} />
            {p.availability === 'IN_STOCK' && <span className="text-stone-600">{p.inStock} ready to ship</span>}
            {p.availability === 'MADE_TO_ORDER' && <span className="text-stone-600">Built to order in about {p.productionTimeDays} days</span>}
          </div>

          <p className="mt-6 leading-relaxed text-stone-700">{p.description}</p>

          {p.colors?.length > 0 && (
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-semibold text-walnut-950">
                Colour: <span className="font-normal text-stone-600">{selectedColor}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {p.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={clsx('flex items-center gap-1 rounded-full border px-4 py-1.5 text-sm', selectedColor === c ? 'border-walnut-800 bg-walnut-800 text-white' : 'border-stone-300 hover:border-walnut-400')}
                    aria-pressed={selectedColor === c}
                  >
                    {selectedColor === c && <Check className="h-3.5 w-3.5" />}
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {p.sizes?.length > 0 && (
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-semibold text-walnut-950">Size</legend>
              <div className="flex flex-wrap gap-2">
                {p.sizes.map((s) => (
                  <button key={s} type="button" onClick={() => setSize(s)} className={clsx('rounded-full border px-4 py-1.5 text-sm', selectedSize === s ? 'border-walnut-800 bg-walnut-800 text-white' : 'border-stone-300')} aria-pressed={selectedSize === s}>
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-stone-300 bg-white">
              <button type="button" className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">
                {qty}
              </span>
              <button type="button" className="p-3" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Increase quantity">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button size="lg" icon={ShoppingBag} disabled={!canBuy} onClick={() => addToCart(false)}>
              Add to cart
            </Button>
            <Button size="lg" variant="accent" disabled={!canBuy} onClick={() => addToCart(true)}>
              Buy now
            </Button>
          </div>

          <div className="mt-8 grid gap-3 rounded-2xl border border-walnut-100 bg-white p-5 text-sm sm:grid-cols-2">
            {(d.width || d.height) && (
              <p className="flex items-center gap-2 text-stone-700">
                <Ruler className="h-4 w-4 text-brass-600" /> W {d.width} × H {d.height} × D {d.depth || d.length} {d.unit}
              </p>
            )}
            <p className="flex items-center gap-2 text-stone-700">
              <Clock className="h-4 w-4 text-brass-600" /> Production time: {p.productionTimeDays} days
            </p>
            <p className="flex items-center gap-2 text-stone-700">
              <Truck className="h-4 w-4 text-brass-600" /> Delivery & installation available
            </p>
            <p className="flex items-center gap-2 text-stone-700">
              <ShieldCheck className="h-4 w-4 text-brass-600" /> Quality checked before delivery
            </p>
            {p.materials?.length > 0 && <p className="text-stone-700 sm:col-span-2">Materials: {p.materials.join(', ')}</p>}
          </div>

          <Link to="/custom-furniture" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-walnut-700 hover:underline">
            <PencilRuler className="h-4 w-4" /> Need different dimensions or fabric? Request a custom version
          </Link>
        </div>
      </div>

      {p.related?.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-semibold text-walnut-950">You may also like</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {p.related.map((r) => (
              <ProductCard key={r._id} product={{ ...r, category: p.category }} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
