import { useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from './ui/Button';
import { exportCSV, exportPDF, exportXLSX } from '../utils/export';

/** Excel / CSV / PDF / print buttons for any tabular report. */
export default function ExportMenu({ filename, title, subtitle, columns, rows, summary }) {
  const [busy, setBusy] = useState(null);
  const disabled = !rows?.length;
  const exportable = columns.filter((c) => c.export !== false);

  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn();
    } catch {
      toast.error(`Could not generate the ${kind} file.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" icon={FileSpreadsheet} disabled={disabled} loading={busy === 'Excel'} onClick={() => run('Excel', () => exportXLSX(filename, exportable, rows))}>
        Excel
      </Button>
      <Button variant="secondary" size="sm" icon={FileText} disabled={disabled} onClick={() => exportCSV(filename, exportable, rows)}>
        CSV
      </Button>
      <Button variant="secondary" size="sm" icon={FileDown} disabled={disabled} loading={busy === 'PDF'} onClick={() => run('PDF', () => exportPDF({ filename, title, subtitle, columns: exportable, rows, summary }))}>
        PDF
      </Button>
      <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
        Print
      </Button>
    </div>
  );
}
