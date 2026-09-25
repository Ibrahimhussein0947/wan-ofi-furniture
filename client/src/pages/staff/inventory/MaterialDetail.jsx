import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Pencil } from 'lucide-react';
import Button from '../../../components/ui/Button';
import DataTable from '../../../components/ui/DataTable';
import { Card, DetailList, PageHeader, StatCard } from '../../../components/ui/misc';
import { Badge } from '../../../components/ui/Badge';
import { QueryState } from '../../../components/ui/States';
import StockAdjustModal from './StockAdjustModal';
import { MaterialModal } from './Materials';
import { materialsApi } from '../../../api/endpoints';
import { useAuth } from '../../../context/AuthContext';
import { date, dateTime, label, money, number } from '../../../utils/format';

export default function MaterialDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [modal, setModal] = useState(null);
  const query = useQuery({ queryKey: ['material', id], queryFn: () => materialsApi.get(id) });
  return (
    <QueryState query={query}>
      {(m) => (
        <div className="space-y-6">
          <PageHeader
            back="/app/materials"
            title={m.name}
            subtitle={`${m.code || 'No code'} · ${label(m.category)}`}
            actions={
              <>
                {can('inventory:write') && <Button icon={ArrowUpDown} onClick={() => setModal('adjust')}>Adjust stock</Button>}
                {can('materials:write') && <Button variant="secondary" icon={Pencil} onClick={() => setModal('edit')}>Edit</Button>}
              </>
            }
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="In stock" value={`${number(m.quantity)} ${m.unit}`} tone={m.isLowStock ? 'red' : 'green'} hint={m.isLowStock ? `Below minimum (${m.minStock})` : `Minimum ${m.minStock}`} />
            <StatCard label="Unit cost" value={money(m.unitCost)} tone="brass" />
            <StatCard label="Stock value" value={money(m.quantity * m.unitCost)} />
          </div>
          <Card title="Details">
            <DetailList
              columns={3}
              items={[
                { label: 'Supplier', value: m.supplier ? <Link className="link" to={`/app/suppliers/${m.supplier._id}`}>{m.supplier.name}</Link> : '—' },
                { label: 'Last purchase', value: date(m.purchaseDate) },
                { label: 'Expiry', value: date(m.expirationDate) },
                { label: 'Location', value: m.location || '—' },
                { label: 'Used in', value: m.usedIn.length ? m.usedIn.map((u) => `${u.product?.name} (${u.quantity}/unit)`).join(', ') : 'No bills of materials' },
                { label: 'Notes', value: m.notes || '—' },
              ]}
            />
          </Card>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Stock movements</h2>
            <DataTable
              dense
              rows={m.transactions}
              columns={[
                { key: 'createdAt', header: 'Date', render: (t) => dateTime(t.createdAt) },
                { key: 'type', header: 'Type', render: (t) => <Badge>{label(t.type)}</Badge> },
                { key: 'quantity', header: 'Change', align: 'right', render: (t) => <span className={t.quantity < 0 ? 'text-red-600' : 'text-emerald-700'}>{t.quantity > 0 ? '+' : ''}{number(t.quantity)}</span> },
                { key: 'balanceAfter', header: 'Balance', align: 'right' },
                { key: 'referenceNumber', header: 'Reference' },
                { key: 'note', header: 'Note', mobile: false },
                { key: 'by', header: 'By', mobile: false, render: (t) => t.createdBy?.name },
              ]}
            />
          </div>
          <StockAdjustModal open={modal === 'adjust'} onClose={() => setModal(null)} item={m} itemType="MATERIAL" />
          <MaterialModal open={modal === 'edit'} onClose={() => setModal(null)} material={m} />
        </div>
      )}
    </QueryState>
  );
}
