import { useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, Building2, CalendarDays, CircleUserRound, FileText, IndianRupee, KeyRound, Landmark, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEmployee } from '../../hooks/queries/useHrQueries';
import { CompletionMeter, ErrorState, LoadingState, PageHeader, StatusBadge } from '../../components/ui/ProductPrimitives';
import type { Employee } from '../../api/hr';
import { useAccess } from '../../hooks/queries/useAccess';
import { useEmployeeLifecycleAction } from '../../hooks/mutations/useHrMutations';
import AppDialog from '../../components/ui/AppDialog';
import { toast } from 'sonner';
import { extractError } from '../../utils/errorUtils';

const tabs = ['overview', 'job', 'personal', 'statutory', 'compensation', 'attendance', 'leave', 'documents', 'assets', 'timeline', 'access'] as const;
type Tab = typeof tabs[number];

const tabLabels: Record<Tab, string> = {
  overview: 'Overview', job: 'Job', personal: 'Personal', statutory: 'Statutory', compensation: 'Compensation',
  attendance: 'Attendance', leave: 'Leave', documents: 'Documents', assets: 'Assets', timeline: 'Timeline', access: 'Access',
};

const lifecycleActions: Record<string, Array<{ action: string; label: string; target: string }>> = {
  DRAFT: [{ action: 'ACTIVATE', label: 'Activate employee', target: 'ACTIVE' }],
  INVITED: [{ action: 'ACTIVATE', label: 'Activate employee', target: 'ACTIVE' }],
  PREBOARDING: [{ action: 'ACTIVATE', label: 'Activate employee', target: 'ACTIVE' }],
  ONBOARDING: [{ action: 'ACTIVATE', label: 'Activate employee', target: 'ACTIVE' }],
  PROBATION: [{ action: 'ACTIVATE', label: 'Confirm employment', target: 'ACTIVE' }, { action: 'START_NOTICE', label: 'Start notice period', target: 'NOTICE_PERIOD' }, { action: 'SUSPEND', label: 'Suspend access', target: 'SUSPENDED' }],
  ACTIVE: [{ action: 'START_NOTICE', label: 'Start notice period', target: 'NOTICE_PERIOD' }, { action: 'SUSPEND', label: 'Suspend access', target: 'SUSPENDED' }],
  SUSPENDED: [{ action: 'ACTIVATE', label: 'Reactivate employee', target: 'ACTIVE' }],
  NOTICE_PERIOD: [{ action: 'EXIT', label: 'Complete exit', target: 'EXITED' }],
  RESIGNATION: [{ action: 'EXIT', label: 'Complete exit', target: 'EXITED' }],
  EXITED: [{ action: 'ARCHIVE', label: 'Archive record', target: 'ARCHIVED' }],
};

export default function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = requestedTab && tabs.includes(requestedTab) ? requestedTab : 'overview';
  const query = useEmployee(id);
  const access = useAccess();
  const lifecycleMutation = useEmployeeLifecycleAction();
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState('');
  const [reason, setReason] = useState('');
  const portal = `/${location.pathname.split('/')[1]}`;
  const workforcePath = portal === '/hr' ? '/hr/employees' : `${portal}/workforce`;

  if (query.isLoading) return <LoadingState label="Loading employee record…" />;
  if (query.isError || !query.data) return <ErrorState title="Employee record unavailable" description="The employee may have been removed or you may not have access to this record." onRetry={() => void query.refetch()} />;
  const employee = query.data;
  const availableActions = lifecycleActions[employee.status.toUpperCase()] ?? [];
  const chosenAction = availableActions.find((item) => item.action === selectedAction) ?? availableActions[0];
  const canChangeLifecycle = access.can('EMPLOYEE_MANAGEMENT.EDIT') && availableActions.length > 0;
  const completeness = [employee.user.name, employee.user.email, employee.department, employee.designation, employee.joiningDate, employee.employmentType, employee.branchName, employee.bankName, employee.annualCtc].filter(Boolean).length / 9 * 100;

  const submitLifecycle = async () => {
    if (!chosenAction || !reason.trim()) return;
    try {
      await lifecycleMutation.mutateAsync({ id: employee.id, action: chosenAction.action, version: employee.version ?? 1, reason: reason.trim() });
      toast.success(`Employee moved to ${chosenAction.target.toLowerCase().replaceAll('_', ' ')}.`);
      setLifecycleOpen(false);
      setReason('');
      setSelectedAction('');
    } catch (error) {
      toast.error(extractError(error, 'Unable to change this employee lifecycle state'));
    }
  };

  return <div className="product-page employee-workspace">
    <Link className="product-back-link" to={workforcePath}><ArrowLeft size={16} aria-hidden="true" /> Back to employees</Link>
    <PageHeader eyebrow={`${employee.employeeId} · Employee record`} title={employee.user.name} description={[employee.designation, employee.department].filter(Boolean).join(' · ') || 'Employment details are incomplete.'} actions={<><StatusBadge status={employee.status}>{employee.status}</StatusBadge>{canChangeLifecycle && <button className="admin-button admin-button--secondary" onClick={() => { setSelectedAction(availableActions[0]?.action ?? ''); setLifecycleOpen(true); }}><RefreshCw size={15} aria-hidden="true" /> Change lifecycle</button>}</>} />
    <section className="employee-workspace__hero admin-card">
      <div className="employee-workspace__avatar" aria-hidden="true">{employee.user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
      <div><strong>{employee.user.name}</strong><span>{employee.user.email}</span><small>{employee.employmentType} · Joined {formatDate(employee.joiningDate)}</small></div>
      <CompletionMeter value={completeness} label="Profile completeness" />
    </section>
    <nav className="product-tabs" aria-label="Employee record sections">
      {tabs.map((tab) => <button key={tab} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true })}>{tabLabels[tab]}</button>)}
    </nav>
    <EmployeeTab tab={activeTab} employee={employee} portal={portal} />
    {lifecycleOpen && chosenAction && <AppDialog open onOpenChange={(open) => { if (!open && !lifecycleMutation.isPending) { setLifecycleOpen(false); setReason(''); } }} title="Change employee lifecycle" description={`Move ${employee.user.name} from ${employee.status.toLowerCase().replaceAll('_', ' ')} to a controlled next state.`} footer={<><button className="admin-button admin-button--secondary" disabled={lifecycleMutation.isPending} onClick={() => setLifecycleOpen(false)}>Cancel</button><button className="admin-button admin-button--primary" disabled={!reason.trim() || lifecycleMutation.isPending} onClick={() => void submitLifecycle()}>{lifecycleMutation.isPending ? 'Saving…' : chosenAction.label}</button></>}>
      <div className="product-form">
        <label className="product-field" htmlFor="employee-lifecycle-action"><span>Next step</span><select id="employee-lifecycle-action" className="admin-input" value={chosenAction.action} onChange={(event) => setSelectedAction(event.target.value)}>{availableActions.map((item) => <option key={item.action} value={item.action}>{item.label} → {item.target.toLowerCase().replaceAll('_', ' ')}</option>)}</select></label>
        <label className="product-field" htmlFor="employee-lifecycle-reason"><span>Reason</span><textarea id="employee-lifecycle-reason" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Record the decision, effective context and any handoff required." /><small>This reason is retained in the employee audit timeline.</small></label>
      </div>
    </AppDialog>}
  </div>;
}

function EmployeeTab({ tab, employee, portal }: { tab: Tab; employee: Employee; portal: string }) {
  const fields = useMemo(() => ({
    overview: [
      ['Employee ID', employee.employeeId], ['Lifecycle status', employee.status], ['Department', employee.department], ['Designation', employee.designation],
      ['Manager', 'Not assigned'], ['Joining date', formatDate(employee.joiningDate)], ['Worker category', employee.employmentType],
    ],
    job: [['Department', employee.department], ['Designation', employee.designation], ['Employment type', employee.employmentType], ['Shift type', employee.shiftType], ['Shift timing', employee.shiftTiming], ['Cost centre', 'Not provided'], ['Probation end', 'Not provided'], ['Notice period', 'Not provided']],
    personal: [['Legal name', employee.user.name], ['Preferred name', 'Not provided'], ['Work email', employee.user.email], ['Personal mobile', employee.mobile ?? 'Not provided'], ['Date of birth', 'Not provided'], ['Emergency contact', 'Not provided'], ['Current address', 'Not provided'], ['Permanent address', 'Not provided']],
    statutory: [['PAN', 'Not provided'], ['Aadhaar', 'Not provided'], ['UAN', 'Not provided'], ['ESIC number', 'Not provided'], ['PF applicable', 'Needs review'], ['ESI applicable', 'Needs review'], ['Tax regime', 'Not selected'], ['Professional tax state', 'Not provided']],
    compensation: [['Annual CTC', employee.annualCtc ? formatCurrency(employee.annualCtc) : 'Not configured'], ['Salary structure', employee.annualCtc ? 'Employee-specific structure' : 'Not assigned'], ['Effective from', formatDate(employee.joiningDate)], ['Bank name', employee.bankName], ['Bank branch', employee.branchName], ['Account holder', employee.accountHolder], ['Payment status', 'Setup review required']],
    access: [['Account status', employee.user.accountStatus ?? 'Not created'], ['Assigned role', employee.user.role ?? 'Employee'], ['Last sign in', employee.user.lastLoginAt ? new Date(employee.user.lastLoginAt).toLocaleString('en-IN') : 'Never'], ['Record scope', 'Self / assigned organization']],
  }), [employee]);

  if (tab === 'attendance') return <ModuleLinkCard icon={<CalendarDays />} title="Attendance record" description="Review punches, attendance exceptions, regularization requests and overtime evidence." to={`${portal}/attendance?employeeId=${employee.id}`} />;
  if (tab === 'leave') return <ModuleLinkCard icon={<CalendarDays />} title="Leave record" description="Review leave requests, balances and approval history for this employee." to={`${portal}/leaves?employeeId=${employee.id}`} />;
  if (tab === 'documents') return <ModuleLinkCard icon={<FileText />} title="Employee documents" description="Employee file access will respect document category and record scope permissions." to={`${portal}/documents?employeeId=${employee.id}`} />;
  if (tab === 'assets') return <ComingModule icon={<BriefcaseBusiness />} title="Assets and clearance" description="Asset assignment is scheduled after the core employment-to-payroll lifecycle." />;
  if (tab === 'timeline') return <section className="admin-card employee-timeline"><h2>Employment timeline</h2><ol><li><span /><div><strong>Employee record created</strong><small>{formatDate(employee.joiningDate)} · Initial employment record</small></div></li><li><span /><div><strong>Current lifecycle state</strong><small>{employee.status} · Version {employee.version ?? 1}</small></div></li></ol></section>;

  const section = fields[tab as keyof typeof fields] ?? fields.overview;
  const icon = tab === 'personal' ? <CircleUserRound /> : tab === 'statutory' ? <ShieldCheck /> : tab === 'compensation' ? <IndianRupee /> : tab === 'access' ? <KeyRound /> : tab === 'job' ? <Building2 /> : <BriefcaseBusiness />;
  return <section className="admin-card employee-detail-section">
    <header>{icon}<div><h2>{tabLabels[tab]}</h2><p>Authoritative employee information used across HR operations and payroll.</p></div></header>
    <dl>{section.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={!value || String(value).startsWith('Not ') || String(value).startsWith('Needs ') ? 'is-missing' : ''}>{value || 'Not provided'}</dd></div>)}</dl>
    {(tab === 'statutory' || tab === 'compensation') && <div className="product-notice"><Landmark size={17} aria-hidden="true" /> Missing or unverified details will be surfaced as payroll preflight blockers before a run can be finalized.</div>}
  </section>;
}

function ModuleLinkCard({ icon, title, description, to }: { icon: React.ReactNode; title: string; description: string; to: string }) {
  return <section className="admin-card module-link-card"><div>{icon}</div><span><strong>{title}</strong><p>{description}</p></span><Link className="admin-button admin-button--secondary" to={to}>Open module</Link></section>;
}

function ComingModule({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <section className="admin-card module-link-card"><div>{icon}</div><span><strong>{title}</strong><p>{description}</p></span><StatusBadge status="PLANNED">Planned</StatusBadge></section>;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not provided';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}
