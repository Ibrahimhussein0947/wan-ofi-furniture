import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Star } from 'lucide-react';
import { productsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { date } from '../utils/format';
import Button from './ui/Button';
import { Input, Textarea } from './ui/Field';

export function Stars({ value, size = 'h-4 w-4', className }) {
  return (
    <span className={clsx('inline-flex', className)} aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={clsx(size, n <= Math.round(value) ? 'fill-brass-400 text-brass-400' : 'text-stone-300')} />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }) {
  const t = useT();
  const [hover, setHover] = useState(0);
  return (
    <fieldset className="flex gap-1" onMouseLeave={() => setHover(0)}>
      <legend className="sr-only">{t('Your rating')}</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          aria-label={t('{count} stars', { count: n })}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="rounded p-0.5 focus-visible:ring-2 focus-visible:ring-brass-400"
        >
          <Star className={clsx('h-7 w-7 transition', n <= (hover || value) ? 'fill-brass-400 text-brass-400' : 'text-stone-300')} />
        </button>
      ))}
    </fieldset>
  );
}

function ReviewForm({ productId }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return toast.error(t('Please choose a star rating.'));
    setSaving(true);
    try {
      await productsApi.addReview(productId, { rating, title: title || undefined, comment: comment || undefined });
      toast.success(t('Thank you for your review!'));
      queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-brass-200 bg-brass-50/50 p-5">
      <h3 className="font-semibold text-walnut-950">{t('Write a review')}</h3>
      <StarPicker value={rating} onChange={setRating} />
      <Input label={t('Title (optional)')} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea label={t('Your review (optional)')} rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button type="submit" loading={saving}>
        {t('Submit review')}
      </Button>
    </form>
  );
}

export default function ProductReviews({ productId, rating, reviewCount }) {
  const t = useT();
  const { user } = useAuth();
  const [limit, setLimit] = useState(5);
  const query = useQuery({ queryKey: ['product-reviews', productId, limit, user?._id], queryFn: () => productsApi.reviews(productId, { limit }) });
  const reviews = query.data;
  const total = reviews?.pagination.total ?? reviewCount ?? 0;

  return (
    <section className="mt-16" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="mb-6 font-display text-2xl font-semibold text-walnut-950">
        {t('Customer reviews')}
      </h2>
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          {total > 0 ? (
            <div>
              <p className="font-display text-4xl font-semibold text-walnut-950">{Number(rating || 0).toFixed(1)}</p>
              <Stars value={rating} className="mt-1" />
              <p className="mt-1 text-sm text-stone-500">{total === 1 ? t('1 review') : t('{count} reviews', { count: total })}</p>
              <div className="mt-4 space-y-1.5">
                {[5, 4, 3, 2, 1].map((n) => {
                  const count = reviews?.breakdown?.[n] || 0;
                  return (
                    <div key={n} className="flex items-center gap-2 text-xs text-stone-600">
                      <span className="w-3">{n}</span>
                      <Star className="h-3 w-3 fill-brass-400 text-brass-400" aria-hidden />
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <span className="block h-full rounded-full bg-brass-400" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
                      </span>
                      <span className="w-5 text-right tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-600">{t('No reviews yet.')}</p>
          )}
          {!reviews?.canReview && !reviews?.myReview && (
            <p className="text-xs text-stone-500">{t('Customers who have received this product can review it from here.')}</p>
          )}
          {reviews?.myReview && <p className="text-xs text-sage-700">{t('Thanks — you have reviewed this product.')}</p>}
        </div>

        <div className="space-y-6">
          {reviews?.canReview && <ReviewForm productId={productId} />}
          {reviews?.items?.map((r) => (
            <article key={r._id} className="border-b border-stone-200 pb-5 last:border-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} />
                {r.title && <h3 className="font-semibold text-walnut-950">{r.title}</h3>}
              </div>
              {r.comment && <p className="mt-2 text-sm leading-relaxed text-stone-700">{r.comment}</p>}
              <p className="mt-2 text-xs text-stone-500">
                {r.author} · {date(r.createdAt)} · <span className="text-sage-700">{t('Verified purchase')}</span>
              </p>
            </article>
          ))}
          {reviews && reviews.items.length < total && (
            <Button variant="secondary" onClick={() => setLimit((l) => l + 10)} loading={query.isFetching}>
              {t('Show more reviews')}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
