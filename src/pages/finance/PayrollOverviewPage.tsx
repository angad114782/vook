import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, IndianRupee, LockKeyhole, Plus, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import type { PayrollRunAction, PayrollRunSummary } from '../../api/finance';
import { usePayrollRunAction } from '../../hooks/mutations/useFinanceMutations';
import { usePayrollRuns } from '../../hooks/queries/useFinanceQueries';
import { useAccess } from '../../hooks/queries/useAccess';
import { extractError } from '../../utils/errorUtils';
import AppDialog from '../../components/ui/AppDialog';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../../components/ui/ProductPrimitives';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ACTION_COPY: Record<PayrollRunAction, { label: string; title: string; description: string }> = {
  review: { label: 'Send for approval', title: 'Send payroll for approval?', description: 'The prepared snapshot will move to the checker queue. Add a concise review note for the audit trail.' },
  approve: { label: 'Approve payroll', title: 'Approve this payroll?', description: 'You are confirming that employee inputs, deductions and net pay have been reviewed.' },
  finalize: { label: 'Finalize & lock', title: 'Finalize and lock payroll?', description: 'The payroll snapshot becomes immutable. Further changes require a controlled reversal or off-cycle run.' },
  publish: { label: 'Publish payslips', title: 'Publish employee payslips?', description: 'Employees will be notified and can immediately view and download their finalized payslips.' },
};

const formatMoney = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minor / 100);
const periodLabel = (run: PayrollRunSummary) => `${MONTHS[run.month - 1] ?? `Month ${run.month}`} ${run.year}`;

export default function PayrollOverviewPage() {
  const location = useLocation();
  const access = useAccess();
  const canProcess = access.can('PAYROLL.PROCESS');
  const basePath = location.pathname.startsWith('/company-admin') ? '/company-admin/payroll' : '/finance/payroll';
  const runsQuery = usePayrollRuns();
  const actionMutation = usePayrollRunAction();
  const [pending, setPending] = useState<{ run: PayrollRunSummary; action: PayrollRunAction } | null>(null);
  const [reason, setReason] = useState('');

  const runs = runsQuery.data ?? [];
  const summary = useMemo(() => ({
    active: runs.filter((run) => !['PUBLISHED', 'PAID', 'CANCELLED'].includes(run.status)).length,
    review: runs.filter((run) => ['UNDER_REVIEW', 'APPROVED'].includes(run.status)).length,
    employees: runs[0]?.employeeCount ?? 0,
    latestNet: runs[0]?.totalNetMinor ?? 0,
  }), [runs]);

  const submitAction = async () => {
    if (!pending || !reason.trim()) return;
    try {
      await actionMutation.mutateAsync({ id: pending.run.id, action: pending.action, version: pending.run.version, reason: reason.trim() });
      toast.success(`${periodLabel(pending.run)} moved to ${ACTION_COPY[pending.action].label.toLowerCase()}.`);
      setPending(null);
      setReason('');
    } catch (error) {
      toast.error(extractError(error, 'Unable to update this payroll run'));
    }
  };

  return <div className="payroll-overview">
    <PageHeader
      eyebrow="Payroll operations"
      title="Payroll"
      description="Prepare, review, approve and publish payroll through one controlled workspace."
      actions={canProcess ? <Link className="admin-button admin-button--primary" to={`${basePath}/run`}><Plus size={16} aria-hidden="true" /> New payroll run</Link> : undefined}
    />

    <section className="payroll-summary-grid" aria-label="Payroll summary">
      <article><span className="payroll-summary-grid__icon"><CalendarDays size={18} /></span><div><span>Active runs</span><strong>{summary.active}</strong></div></article>
      <article><span className="payroll-summary-grid__icon"><LockKeyhole size={18} /></span><div><span>Awaiting action</span><strong>{summary.review}</strong></div></article>
      <article><span className="payroll-summary-grid__icon"><Users size={18} /></span><div><span>Latest employees</span><strong>{summary.employees}</strong></div></article>
      <article><span className="payroll-summary-grid__icon"><IndianRupee size={18} /></span><div><span>Latest net payroll</span><strong>{formatMoney(summary.latestNet)}</strong></div></article>
    </section>

    <section className="product-panel" aria-labelledby="payroll-runs-heading">
      <div className="product-panel__header">
        <div><h2 id="payroll-runs-heading">Payroll runs</h2><p>Each status change is version checked and recorded in the audit trail.</p></div>
      </div>
      {runsQuery.isLoading ? <LoadingState label="Loading payroll runs…" /> : runsQuery.isError ? <ErrorState description="Payroll runs could not be loaded." onRetry={() => void runsQuery.refetch()} /> : runs.length === 0 ? <EmptyState title="No payroll runs yet" description="Create the first run after attendance is resolved and locked." action={canProcess ? <Link className="admin-button admin-button--primary" to={`${basePath}/run`}>Create payroll run</Link> : undefined} /> :
        <div className="payroll-run-list">
          {runs.map((run) => {
            const nextAction = (run.permittedActions ?? [])[0];
            return <article className="payroll-run-card" key={run.id}>
              <div className="payroll-run-card__period"><span>{String(run.month).padStart(2, '0')}</span><div><strong>{periodLabel(run)}</strong><small>Created {new Date(run.createdAt).toLocaleDateString('en-IN')}</small></div></div>
              <dl>
                <div><dt>Employees</dt><dd>{run.employeeCount}</dd></div>
                <div><dt>Gross pay</dt><dd>{formatMoney(run.grossPayMinor)}</dd></div>
                <div><dt>Deductions</dt><dd>{formatMoney(run.deductionsMinor)}</dd></div>
                <div><dt>Net pay</dt><dd>{formatMoney(run.totalNetMinor)}</dd></div>
              </dl>
              <div className="payroll-run-card__state">
                <StatusBadge status={run.status} />
                {nextAction ? <button className="admin-button admin-button--primary" onClick={() => setPending({ run, action: nextAction })}>{ACTION_COPY[nextAction].label}<ArrowRight size={15} aria-hidden="true" /></button> : <span className="payroll-run-card__waiting">No action available for your role</span>}
              </div>
            </article>;
          })}
        </div>}
    </section>

    {pending && <AppDialog open onOpenChange={(open) => { if (!open && !actionMutation.isPending) { setPending(null); setReason(''); } }} title={ACTION_COPY[pending.action].title} description={`${periodLabel(pending.run)} · ${ACTION_COPY[pending.action].description}`} footer={<><button className="admin-button admin-button--secondary" disabled={actionMutation.isPending} onClick={() => { setPending(null); setReason(''); }}>Cancel</button><button className="admin-button admin-button--primary" disabled={!reason.trim() || actionMutation.isPending} onClick={() => void submitAction()}>{actionMutation.isPending ? 'Saving…' : ACTION_COPY[pending.action].label}</button></>}>
      <label className="product-field" htmlFor="payroll-action-reason"><span>Audit reason</span><textarea id="payroll-action-reason" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Summarize the checks completed and any approved exceptions." autoFocus /><small>This note is retained with the transition history.</small></label>
    </AppDialog>}
  </div>;
}
