import { useState } from 'react';
import { Download, Eye, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { employeeApi, type MyPayslip } from '../../api/employee';
import { useMyPayslips } from '../../hooks/queries/useEmployeeQueries';
import AppDialog from '../../components/ui/AppDialog';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../../components/ui/ProductPrimitives';
import { extractError } from '../../utils/errorUtils';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

export default function EmployeePayslipsPage() {
  const query = useMyPayslips();
  const [selected, setSelected] = useState<MyPayslip | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (payslip: MyPayslip) => {
    setDownloading(payslip.id);
    try {
      const response = await employeeApi.downloadPayslip(payslip.id);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${payslip.payslipId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(extractError(error, 'Unable to download this payslip'));
    } finally {
      setDownloading(null);
    }
  };

  return <div className="product-page">
    <PageHeader eyebrow="My compensation" title="Payslips" description="View finalized salary details and download published payslips." />
    {query.isLoading ? <LoadingState label="Loading your payslips…" /> : query.isError ? <ErrorState description="Your payslips could not be loaded." onRetry={() => void query.refetch()} /> : !query.data?.length ? <EmptyState title="No published payslips" description="A payslip will appear here after payroll is finalized and published." /> : <section className="payslip-card-grid" aria-label="Published payslips">
      {query.data.map((payslip) => <article className="admin-card employee-payslip-card" key={payslip.id}>
        <header><div><FileText size={18} aria-hidden="true" /></div><span><strong>{payslip.period}</strong><small>{payslip.payslipId}</small></span><StatusBadge status={payslip.status} /></header>
        <dl><div><dt>Gross pay</dt><dd>{money(payslip.grossSalary)}</dd></div><div><dt>Deductions</dt><dd>{money(payslip.totalDeductions)}</dd></div><div><dt>Net pay</dt><dd>{money(payslip.netPay)}</dd></div></dl>
        <footer><button className="admin-button admin-button--secondary" onClick={() => setSelected(payslip)}><Eye size={15} aria-hidden="true" /> View details</button><button className="admin-button" disabled={downloading === payslip.id || !['PUBLISHED', 'PAID', 'Published', 'Paid'].includes(payslip.status)} onClick={() => void download(payslip)}><Download size={15} aria-hidden="true" /> {downloading === payslip.id ? 'Downloading…' : 'Download'}</button></footer>
      </article>)}
    </section>}
    <PayslipDialog payslip={selected} onClose={() => setSelected(null)} />
  </div>;
}

function PayslipDialog({ payslip, onClose }: { payslip: MyPayslip | null; onClose: () => void }) {
  if (!payslip) return null;
  const snapshot = payslip.snapshot;
  return <AppDialog open onOpenChange={(open) => !open && onClose()} title={`Payslip · ${payslip.period}`} description={payslip.payslipId} footer={<button className="admin-button admin-button--secondary" onClick={onClose}>Close</button>}>
    <div className="payslip-breakdown">
      <div className="payslip-breakdown__net"><span>Net pay</span><strong>{money(payslip.netPay)}</strong><StatusBadge status={payslip.status} /></div>
      <dl>
        <div><dt>Payable days</dt><dd>{snapshot?.payableDays ?? '—'}</dd></div>
        <div><dt>Basic salary</dt><dd>{money(snapshot?.basicSalary ?? 0)}</dd></div>
        <div><dt>Allowances</dt><dd>{money(snapshot?.allowances ?? 0)}</dd></div>
        <div><dt>Overtime pay</dt><dd>{money(snapshot?.overtimePay ?? 0)}</dd></div>
        <div><dt>Reimbursements</dt><dd>{money(snapshot?.reimbursementAmount ?? 0)}</dd></div>
        <div><dt>Total deductions</dt><dd>{money(payslip.totalDeductions)}</dd></div>
      </dl>
      <p>Values are shown from the immutable payroll snapshot used when this payslip was published.</p>
    </div>
  </AppDialog>;
}
