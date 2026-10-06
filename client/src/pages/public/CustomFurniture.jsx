import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { CheckCircle2, LogIn, PencilRuler } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Field';
import ImagePicker from '../../components/ui/ImagePicker';
import { useAuth } from '../../context/AuthContext';
import { customOrdersApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { useT } from '../../i18n/LanguageContext';
import usePageMeta from '../../hooks/usePageMeta';

const optionalNumber = z.preprocess((v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v)), z.number().min(0).optional());

export const customRequestSchema = z.object({
  furnitureType: z.string().trim().min(2, 'What would you like us to make?'),
  description: z.string().trim().min(10, 'Please describe it in a bit more detail (10+ characters)'),
  width: optionalNumber,
  height: optionalNumber,
  length: optionalNumber,
  depth: optionalNumber,
  unit: z.enum(['cm', 'm', 'in', 'ft', 'mm']),
  preferredMaterial: z.string().optional(),
  preferredColor: z.string().optional(),
  fabric: z.string().optional(),
  designRequirements: z.string().optional(),
  quantity: z.coerce.number().int().min(1, 'At least 1').max(10000),
  budget: optionalNumber,
  requiredDate: z
    .string()
    .optional()
    .refine((d) => !d || new Date(d) > new Date(), 'Pick a future date'),
  deliveryMethod: z.enum(['DELIVERY', 'PICKUP']),
  additionalNotes: z.string().optional(),
});

const TYPES = ['Bed', 'Sofa', 'Chair', 'Dining table', 'Coffee table', 'Wardrobe', 'Kitchen cabinets', 'TV stand', 'Office desk', 'Bookshelf', 'Other'];

export default function CustomFurniture() {
  const t = useT();
  usePageMeta({ title: t('Custom furniture'), description: t('Tell us what you need. Include measurements and photos if you have them — the more detail, the more accurate your quote.') });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [submitted, setSubmitted] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(customRequestSchema), defaultValues: { unit: 'cm', quantity: 1, deliveryMethod: 'DELIVERY' } });

  const onSubmit = async (values) => {
    if (!user) {
      toast('Please log in or create an account to send your request.');
      navigate('/login', { state: { from: { pathname: '/custom-furniture' } } });
      return;
    }
    const { width, height, length, depth, unit, requiredDate, ...rest } = values;
    try {
      const request = await customOrdersApi.create({ ...rest, requiredDate: requiredDate || undefined, dimensions: { width, height, length, depth, unit } }, images);
      setSubmitted(request);
      reset();
      setImages([]);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (submitted) {
    return (
      <div className="container-page flex flex-col items-center py-20 text-center">
        <CheckCircle2 className="h-16 w-16 text-sage-600" />
        <h1 className="mt-4 font-display text-3xl font-semibold text-walnut-950">Request {submitted.requestNumber} received</h1>
        <p className="mt-2 max-w-md text-stone-600">{t("Our designers will review it and send you a price proposal, usually within 48 hours. You'll get a notification when it's ready.")}</p>
        <div className="mt-6 flex gap-3">
          <Button to={`/account/custom-requests/${submitted._id}`}>{t('Track my request')}</Button>
          <Button variant="secondary" onClick={() => setSubmitted(null)}>
            {t('Send another')}
          </Button>
        </div>
      </div>
    );
  }

  const isCustomer = user?.role === 'CUSTOMER';

  return (
    <div className="container-page py-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brass-600">{t('Custom furniture')}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-walnut-950">{t('Design your own piece')}</h1>
          <p className="mt-3 max-w-2xl text-stone-600">{t('Tell us what you need. Include measurements and photos if you have them — the more detail, the more accurate your quote.')}</p>

          {user && !isCustomer && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t("You're signed in as staff. Custom requests are submitted by customers from their accounts.")}</p>}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8" noValidate>
            <section className="card space-y-4 p-6">
              <h2 className="font-semibold text-walnut-950">{t('1. What should we make?')}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={t('Furniture type')} list="furniture-types" required error={errors.furnitureType?.message} {...register('furnitureType')} />
                <datalist id="furniture-types">
                  {TYPES.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
                <Input label={t('Quantity')} type="number" min="1" required error={errors.quantity?.message} {...register('quantity')} />
              </div>
              <Textarea label={t('Describe your piece')} rows={4} required placeholder={t("Style, how you'll use it, where it will go…")} error={errors.description?.message} {...register('description')} />
              <Textarea label={t('Design requirements')} rows={3} placeholder={t('Drawers, doors, shelves, legs, headboard style…')} {...register('designRequirements')} />
            </section>

            <section className="card space-y-4 p-6">
              <h2 className="flex items-center gap-2 font-semibold text-walnut-950">
                <PencilRuler className="h-4 w-4 text-brass-600" /> {t('2. Measurements')}
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <Input label={t('Width')} type="number" step="0.1" min="0" error={errors.width?.message} {...register('width')} />
                <Input label={t('Height')} type="number" step="0.1" min="0" error={errors.height?.message} {...register('height')} />
                <Input label={t('Length')} type="number" step="0.1" min="0" error={errors.length?.message} {...register('length')} />
                <Input label={t('Depth')} type="number" step="0.1" min="0" error={errors.depth?.message} {...register('depth')} />
                <Select label={t('Unit')} options={['cm', 'mm', 'm', 'in', 'ft']} {...register('unit')} />
              </div>
            </section>

            <section className="card space-y-4 p-6">
              <h2 className="font-semibold text-walnut-950">{t('3. Materials & finish')}</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label={t('Preferred material')} placeholder={t('e.g. Eucalyptus')} {...register('preferredMaterial')} />
                <Input label={t('Colour')} placeholder={t('e.g. Dark walnut')} {...register('preferredColor')} />
                <Input label={t('Fabric')} placeholder={t('e.g. Grey linen')} {...register('fabric')} />
              </div>
              <div>
                <p className="label">{t('Reference images')}</p>
                <ImagePicker files={images} onChange={setImages} max={6} label={t('Add photos')} />
                <p className="mt-1 text-xs text-stone-500">{t('JPG, PNG or WEBP, up to 5 MB each.')}</p>
              </div>
            </section>

            <section className="card space-y-4 p-6">
              <h2 className="font-semibold text-walnut-950">{t('4. Budget & delivery')}</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label={t('Budget (optional)')} type="number" min="0" error={errors.budget?.message} {...register('budget')} />
                <Input label={t('Needed by')} type="date" error={errors.requiredDate?.message} {...register('requiredDate')} />
                <Select
                  label={t('Delivery method')}
                  options={[
                    { value: 'DELIVERY', label: 'Deliver to me' },
                    { value: 'PICKUP', label: 'I will collect' },
                  ]}
                  {...register('deliveryMethod')}
                />
              </div>
              <Textarea label={t('Anything else?')} rows={2} {...register('additionalNotes')} />
            </section>

            <Button type="submit" size="lg" loading={isSubmitting} disabled={user && !isCustomer} icon={user ? undefined : LogIn}>
              {user ? t('Send request for a quote') : t('Log in to send request')}
            </Button>
          </form>
        </div>

        <aside className="space-y-4 lg:pt-24">
          <div className="theme-static rounded-2xl bg-walnut-900 p-6 text-white">
            <h2 className="font-display text-xl font-semibold">{t('How it works')}</h2>
            <ol className="mt-4 space-y-4 text-sm text-walnut-100">
              {['Request', 'Review by our designers', 'Estimate & price proposal', 'You approve the quote', 'Pay the deposit', 'Production & quality check', 'Delivery & completion'].map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brass-500 text-xs font-bold text-walnut-950">{i + 1}</span>
                  {t(s)}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
