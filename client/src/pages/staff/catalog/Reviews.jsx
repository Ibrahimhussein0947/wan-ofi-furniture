import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import DataTable from '../../../components/ui/DataTable';
import Button from '../../../components/ui/Button';
import { FilterBar, PageHeader } from '../../../components/ui/misc';
import { Select } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { Stars } from '../../../components/ProductReviews';
import { reviewsApi } from '../../../api/endpoints';
import { errorMessage } from '../../../api/client';
import useListParams from '../../../hooks/useListParams';
import { date } from '../../../utils/format';
import { useT } from '../../../i18n/LanguageContext';

export default function Reviews() {
  const t = useT();
  const [params, set] = useListParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['reviews', 'staff', params], queryFn: () => reviewsApi.list(params), placeholderData: keepPreviousData });

  const toggle = async (r) => {
    try {
      await reviewsApi.setStatus(r._id, r.status === 'HIDDEN' ? 'PUBLISHED' : 'HIDDEN');
      toast.success(r.status === 'HIDDEN' ? 'Review published' : 'Review hidden');
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (r) => (
        <Link to={`/products/${r.product?.slug}`} className="font-medium text-stone-900 hover:underline" target="_blank" rel="noreferrer">
          {r.product?.name}
        </Link>
      ),
    },
    { key: 'customer', header: 'Customer', render: (r) => r.customer?.name },
    { key: 'rating', header: 'Rating', render: (r) => <Stars value={r.rating} size="h-3.5 w-3.5" /> },
    {
      key: 'comment',
      header: 'Review',
      render: (r) => (
        <span className="block max-w-md whitespace-normal">
          {r.title && <span className="block font-medium text-stone-900">{r.title}</span>}
          <span className="text-stone-600">{r.comment || '—'}</span>
        </span>
      ),
    },
    { key: 'createdAt', header: 'Date', mobile: false, render: (r) => date(r.createdAt) },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'HIDDEN' ? 'stone' : 'green'}>{r.status === 'HIDDEN' ? 'Hidden' : 'Published'}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Button size="sm" variant="ghost" icon={r.status === 'HIDDEN' ? Eye : EyeOff} onClick={() => toggle(r)}>
          {r.status === 'HIDDEN' ? 'Publish' : 'Hide'}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title={t('Reviews')} subtitle="Customer reviews of delivered products. Hidden reviews don't count toward a product's rating." />
      <FilterBar>
        <Select
          value={params.status || ''}
          onChange={(e) => set({ status: e.target.value })}
          options={[
            { value: 'PUBLISHED', label: 'Published' },
            { value: 'HIDDEN', label: 'Hidden' },
          ]}
          placeholder={t('All reviews')}
          aria-label={t('Status')}
          containerClassName="sm:w-44"
        />
      </FilterBar>
      <DataTable columns={columns} loading={query.isLoading} error={query.error} rows={query.data?.items} pagination={query.data?.pagination} onPageChange={(page) => set({ page })} />
    </div>
  );
}
