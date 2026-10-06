import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, ChevronDown, ChevronUp, FilePlus2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { purchasesApi } from '../../../api/endpoints';
import { errorMessage } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import { money, number } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

/**
 * Low-stock materials not yet on order, grouped by supplier. One click turns a group
 * into a draft purchase order the team can review before placing it.
 */
export default function ReorderSuggestions() {
  const t = useT();
  const { can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(null);
  const query = useQuery({ queryKey: ['purchases', 'suggestions'], queryFn: () => purchasesApi.get('suggestions') });
  const groups = query.data || [];
  if (!groups.length) return null;
  const count = groups.reduce((n, g) => n + g.items.length, 0);

  const createDraft = async (group) => {
    setCreating(group.supplier._id);
    try {
      const po = await purchasesApi.create({
        supplier: group.supplier._id,
        status: 'DRAFT',
        notes: 'Created from low-stock reorder suggestions.',
        items: group.items.map((i) => ({ material: i.material._id, quantity: i.suggestedQuantity, unitCost: i.unitCost })),
      });
      toast.success(`Draft ${po.poNumber} created — review and place it when ready`);
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      navigate(`/app/purchases/${po._id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCreating(null);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left" aria-expanded={open}>
        <span className="flex items-center gap-2 font-semibold text-amber-900">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          Reorder suggestions · {count} material{count === 1 ? '' : 's'} low on stock
        </span>
        {open ? <ChevronUp className="h-5 w-5 text-amber-800" /> : <ChevronDown className="h-5 w-5 text-amber-800" />}
      </button>
      {open && (
        <div className="space-y-4 px-5 pb-5">
          {groups.map((g) => (
            <div key={g.supplier?._id || 'none'} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
                <div>
                  <p className="font-semibold text-stone-900">{g.supplier ? g.supplier.name : 'No main supplier set'}</p>
                  <p className="text-xs text-stone-500">
                    {g.items.length} item{g.items.length === 1 ? '' : 's'} · estimated {money(g.total)}
                  </p>
                </div>
                {g.supplier && can('purchases:write') ? (
                  <Button size="sm" icon={FilePlus2} loading={creating === g.supplier._id} onClick={() => createDraft(g)}>
                    {t('Create draft order')}
                  </Button>
                ) : (
                  !g.supplier && <p className="text-xs text-stone-500">{t('Set a main supplier on these materials to order them in one click.')}</p>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-2">{t('Material')}</th>
                    <th className="px-4 py-2 text-right">{t('In stock')}</th>
                    <th className="hidden px-4 py-2 text-right sm:table-cell">{t('Minimum')}</th>
                    <th className="hidden px-4 py-2 text-right sm:table-cell">{t('On order')}</th>
                    <th className="px-4 py-2 text-right">{t('Suggested')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {g.items.map((i) => (
                    <tr key={i.material._id}>
                      <td className="px-4 py-2">
                        <Link to={`/app/materials/${i.material._id}`} className="font-medium text-stone-900 hover:underline">
                          {i.material.name}
                        </Link>
                        {i.openOrders.length > 0 && <span className="block text-xs text-stone-500">Partly on order: {i.openOrders.join(', ')}</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-600">
                        {number(i.quantity)} {i.material.unit}
                      </td>
                      <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{number(i.minStock)}</td>
                      <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{number(i.onOrder)}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">
                        {number(i.suggestedQuantity)} {i.material.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
