import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ExternalLink, Layers, Trash2, X } from 'lucide-react';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { Card, PageHeader } from '../../../components/ui/misc';
import { Checkbox, Input, Select, Textarea } from '../../../components/ui/Field';
import { PageLoader } from '../../../components/ui/States';
import ImagePicker from '../../../components/ui/ImagePicker';
import { categoriesApi, productsApi } from '../../../api/endpoints';
import { errorMessage, fieldErrors, fileUrl } from '../../../api/client';
import { PRODUCT_STATUSES } from '../../../utils/constants';
import { label, money } from '../../../utils/format';

const num = z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must not be negative');
const optNum = z.preprocess((v) => (v === '' || v === null ? undefined : v), num.optional());
const list = (v) =>
  String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const productSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required'),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]+$/, 'Letters, numbers and dashes only'),
    category: z.string().min(1, 'Choose a category'),
    description: z.string().optional(),
    price: num,
    costPrice: num,
    sellingPrice: num,
    quantity: optNum,
    minStock: optNum,
    productionTimeDays: optNum,
    width: optNum,
    height: optNum,
    depth: optNum,
    unit: z.string(),
    colors: z.string().optional(),
    sizes: z.string().optional(),
    materials: z.string().optional(),
    status: z.string(),
    isFeatured: z.boolean(),
    madeToOrder: z.boolean(),
    allowLoss: z.boolean().optional(),
  })
  .refine((v) => v.sellingPrice >= v.costPrice || v.allowLoss, { message: 'Selling price is below cost — tick "allow selling at a loss" to confirm', path: ['sellingPrice'] });

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [images, setImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const categories = useQuery({ queryKey: ['categories', 'staff'], queryFn: () => categoriesApi.list().then((r) => r.items) });
  const product = useQuery({ queryKey: ['product', 'staff', id], queryFn: () => productsApi.get(id), enabled: !isNew });
  const p = product.data;

  const form = useForm({
    resolver: zodResolver(productSchema),
    values: p
      ? {
          name: p.name,
          sku: p.sku,
          category: p.category?._id,
          description: p.description || '',
          price: p.price,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          minStock: p.minStock,
          productionTimeDays: p.productionTimeDays,
          width: p.dimensions?.width ?? '',
          height: p.dimensions?.height ?? '',
          depth: p.dimensions?.depth ?? '',
          unit: p.dimensions?.unit || 'cm',
          colors: (p.colors || []).join(', '),
          sizes: (p.sizes || []).join(', '),
          materials: (p.materials || []).join(', '),
          status: p.status,
          isFeatured: p.isFeatured,
          madeToOrder: p.madeToOrder,
        }
      : undefined,
    defaultValues: { unit: 'cm', status: 'ACTIVE', isFeatured: false, madeToOrder: true, quantity: 0, minStock: 1, productionTimeDays: 7 },
  });
  const { errors, isSubmitting } = form.formState;
  const [cost, selling] = form.watch(['costPrice', 'sellingPrice']);
  const margin = Number(selling) - Number(cost);

  if (!isNew && product.isLoading) return <PageLoader />;

  const onSubmit = async (v) => {
    const body = {
      name: v.name,
      sku: v.sku,
      category: v.category,
      description: v.description,
      price: v.price,
      costPrice: v.costPrice,
      sellingPrice: v.sellingPrice,
      minStock: v.minStock,
      productionTimeDays: v.productionTimeDays,
      dimensions: { width: v.width, height: v.height, depth: v.depth, unit: v.unit },
      colors: list(v.colors),
      sizes: list(v.sizes),
      materials: list(v.materials),
      status: v.status,
      isFeatured: v.isFeatured,
      madeToOrder: v.madeToOrder,
    };
    try {
      if (isNew) {
        const created = await productsApi.create({ ...body, quantity: v.quantity || 0, allowLoss: v.allowLoss }, images);
        toast.success('Product created');
        navigate(`/app/products/${created._id}`, { replace: true });
      } else {
        await productsApi.update(id, { ...body, images: (p.images || []).filter((u) => !removedImages.includes(u)) }, images);
        toast.success('Product saved');
        setImages([]);
        setRemovedImages([]);
      }
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product'] });
    } catch (err) {
      Object.entries(fieldErrors(err)).forEach(([field, message]) => form.setError(field, { message }));
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    try {
      await productsApi.remove(id);
      toast.success('Product removed');
      qc.invalidateQueries({ queryKey: ['products'] });
      navigate('/app/products');
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <PageHeader
        back="/app/products"
        title={isNew ? 'New product' : p?.name}
        subtitle={!isNew && `${p?.sku} · ${p?.quantity} in stock · ${p?.soldQuantity} sold`}
        actions={
          <>
            {!isNew && (
              <>
                <Button variant="ghost" icon={ExternalLink} to={`/products/${p.slug}`} target="_blank">
                  View in shop
                </Button>
                <Button variant="secondary" icon={Layers} to={`/app/bom?product=${id}`}>
                  Bill of materials
                </Button>
              </>
            )}
            <Button type="submit" loading={isSubmitting}>
              {isNew ? 'Create product' : 'Save changes'}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" required error={errors.name?.message} {...form.register('name')} />
              <Input label="SKU" required error={errors.sku?.message} {...form.register('sku')} />
              <Select label="Category" required placeholder="Choose…" error={errors.category?.message} options={(categories.data || []).map((c) => ({ value: c._id, label: c.name }))} {...form.register('category')} />
              <Select label="Status" options={PRODUCT_STATUSES.map((s) => ({ value: s, label: label(s) }))} {...form.register('status')} />
              <Textarea label="Description" rows={5} containerClassName="sm:col-span-2" {...form.register('description')} />
            </div>
          </Card>
          <Card title="Options & specifications">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Colours" hint="Comma separated" {...form.register('colors')} />
              <Input label="Sizes" hint="Comma separated" {...form.register('sizes')} />
              <Input label="Materials" hint="Comma separated, shown to customers" containerClassName="sm:col-span-2" {...form.register('materials')} />
              <div className="grid grid-cols-4 gap-3 sm:col-span-2">
                <Input label="Width" type="number" step="any" {...form.register('width')} />
                <Input label="Height" type="number" step="any" {...form.register('height')} />
                <Input label="Depth" type="number" step="any" {...form.register('depth')} />
                <Select label="Unit" options={['cm', 'mm', 'm', 'in', 'ft']} {...form.register('unit')} />
              </div>
              <Input label="Production time (days)" type="number" min="0" {...form.register('productionTimeDays')} />
            </div>
          </Card>
          <Card title="Images">
            {!isNew && p.images?.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-3">
                {p.images
                  .filter((u) => !removedImages.includes(u))
                  .map((u) => (
                    <div key={u} className="relative">
                      <img src={fileUrl(u)} alt="Product" className="h-24 w-24 rounded-lg object-cover" />
                      <button type="button" onClick={() => setRemovedImages((r) => [...r, u])} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white" aria-label="Remove image">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
            <ImagePicker files={images} onChange={setImages} max={8} label="Add images" />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Pricing">
            <div className="space-y-4">
              <Input label="List price" type="number" step="any" required hint="Shown crossed-out when higher than the selling price" error={errors.price?.message} {...form.register('price')} />
              <Input label="Cost price" type="number" step="any" required error={errors.costPrice?.message} {...form.register('costPrice')} />
              <Input label="Selling price" type="number" step="any" required error={errors.sellingPrice?.message} {...form.register('sellingPrice')} />
              <p className={`rounded-lg p-3 text-sm ${margin < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
                Margin per unit: <strong>{money(margin || 0)}</strong>
                {Number(selling) > 0 && ` (${Math.round((margin / Number(selling)) * 100)}%)`}
              </p>
              {isNew && margin < 0 && <Checkbox label="Allow selling at a loss" {...form.register('allowLoss')} />}
            </div>
          </Card>
          <Card title="Stock">
            <div className="space-y-4">
              {isNew ? (
                <Input label="Opening stock" type="number" min="0" hint="Recorded as a stock-in transaction" {...form.register('quantity')} />
              ) : (
                <p className="text-sm text-stone-600">
                  Current stock: <strong>{p.quantity}</strong>. Adjust it from <a className="link" href="/app/inventory">Inventory</a> so every change is recorded.
                </p>
              )}
              <Input label="Minimum stock level" type="number" min="0" {...form.register('minStock')} />
              <Checkbox label="Made to order (can be ordered when out of stock)" {...form.register('madeToOrder')} />
              <Checkbox label="Featured on the homepage" {...form.register('isFeatured')} />
            </div>
          </Card>
          {!isNew && (
            <Button variant="ghost" icon={Trash2} className="text-red-600" onClick={() => setDeleting(true)}>
              Remove product
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} title="Remove this product?" message="It will be hidden from the shop. Products on open orders cannot be removed." confirmLabel="Remove" onConfirm={remove} />
    </form>
  );
}
