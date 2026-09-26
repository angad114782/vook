import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Building2, Check, Circle, SkipForward } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { caApi } from '../../api/companyAdmin';

const STEP_META = [
  ['company-profile', 'Company profile', 'Legal and operating identity'],
  ['organization', 'Organization', 'Departments, designations, and reporting'],
  ['roles', 'Roles and access', 'Scoped assignments by company, department, or team'],
  ['shifts-holidays', 'Shifts and holidays', 'Working templates and calendars'],
  ['leave-policy', 'Leave policies', 'Types, balances, and eligibility'],
  ['workflows', 'Approval workflows', 'Leave, expense, and correction routing'],
  ['payroll', 'Payroll', 'Salary and compliance settings'],
  ['expenses', 'Expenses', 'Categories and reimbursement policy'],
  ['employees', 'Employees', 'Create staff or validate an import'],
  ['invitations', 'Invitations', 'Review access before launch'],
] as const;
const deepLinks: Record<string, string> = { organization: '/company-admin/departments', roles: '/company-admin/settings/roles', workflows: '/company-admin/settings/workflows', payroll: '/company-admin/payroll/overview', employees: '/company-admin/workforce' };
const stepModules: Record<string, string> = { payroll: 'Payroll', expenses: 'Expense Management' };

export default function CAOnboardingPage() {
  const navigate = useNavigate(); const client = useQueryClient();
  const query = useQuery({ queryKey: ['ca', 'onboarding'], queryFn: () => caApi.getOnboarding().then((response) => response.data) });
  const [active, setActive] = useState('company-profile');
  const [profile, setProfile] = useState({ name: '', legalName: '', industry: '', email: '', phone: '', timezone: 'Asia/Kolkata' });
  const current = query.data;
  useEffect(() => {
    if (!current?.company) return;
    setProfile({ name: current.company.name ?? '', legalName: (current.company as any).legalName ?? '', industry: current.company.industry ?? '', email: current.company.email ?? '', phone: current.company.phone ?? '', timezone: (current.company as any).timezone ?? 'Asia/Kolkata' });
  }, [current?.company]);
  const steps = useMemo(() => current?.onboarding.steps ?? [], [current?.onboarding.steps]);
  const lockedSteps = useMemo(() => new Set<string>(STEP_META.filter(([key]) => { const moduleName = stepModules[key]; return moduleName && !current?.entitlements.modules.some((item) => item.name === moduleName && (item.enabled || item.isEnabled)); }).map(([key]) => key)), [current?.entitlements.modules]);
  const completeCount = STEP_META.filter(([key]) => steps.some((step) => step.key === key && ['COMPLETED', 'SKIPPED'].includes(step.status)) || lockedSteps.has(key)).length;
  const progress = Math.round((completeCount / STEP_META.length) * 100);
  const mutation = useMutation({ mutationFn: (payload: { key: string; status: 'COMPLETED' | 'SKIPPED'; data?: Record<string, unknown> }) => caApi.updateOnboardingStep(payload.key, { status: payload.status, data: payload.data }), onSuccess: async (_data, payload) => { toast.success('Setup progress saved'); await client.invalidateQueries({ queryKey: ['ca', 'onboarding'] }); await client.invalidateQueries({ queryKey: ['auth', 'access'] }); const index = STEP_META.findIndex(([key]) => key === payload.key); if (index >= 0 && index < STEP_META.length - 1) setActive(STEP_META[index + 1][0]); }, onError: (error: any) => toast.error(error?.response?.data?.message ?? 'Could not save this step') });
  const selectedIndex = STEP_META.findIndex(([key]) => key === active);
  const selectedLocked = lockedSteps.has(active);
  const requiredReady = useMemo(() => steps.find((step) => step.key === 'company-profile')?.status === 'COMPLETED', [steps]);
  const save = () => mutation.mutate({ key: active, status: 'COMPLETED', data: active === 'company-profile' ? profile : undefined });
  const choose = (key: string) => setActive(key);
  return <div className="admin-page onboarding-page">
    <header className="admin-page__header"><div><h1>Set up your company</h1><p>Complete the essentials now, then continue optional setup from the dashboard checklist. Your progress is saved after every step.</p></div>{requiredReady && <button className="admin-button" onClick={() => navigate('/company-admin/dashboard')}>Open dashboard <ArrowRight size={16} /></button>}</header>
    <div className="setup-progress"><div><strong>{progress}% complete</strong><span>{completeCount} of {STEP_META.length} steps</span></div><div><i style={{ width: `${progress}%` }} /></div></div>
    <div className="onboarding-layout">
      <nav className="admin-card onboarding-nav" aria-label="Company setup steps">{STEP_META.map(([key, title, description], index) => { const status = lockedSteps.has(key) ? 'SKIPPED' : steps.find((step) => step.key === key)?.status ?? 'NOT_STARTED'; return <button key={key} className={`${active === key ? 'is-active' : ''} ${lockedSteps.has(key) ? 'is-locked' : ''}`} onClick={() => choose(key)}><span>{status === 'COMPLETED' || status === 'SKIPPED' ? <Check size={14} /> : <Circle size={12} />}</span><div><strong>{index + 1}. {title}</strong><small>{lockedSteps.has(key) ? 'Not included in pinned plan · available after upgrade' : description}</small></div></button>; })}</nav>
      <section className="admin-card onboarding-form">
        {active === 'company-profile' && <><div className="form-title"><Building2 size={19} /><div><h2>Company profile</h2><p>This information appears across reports and invitations.</p></div></div><div className="form-grid"><label className="admin-label">Display name<input className="admin-input" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label className="admin-label">Legal name<input className="admin-input" value={profile.legalName} onChange={(event) => setProfile({ ...profile, legalName: event.target.value })} /></label><label className="admin-label">Industry<input className="admin-input" value={profile.industry} onChange={(event) => setProfile({ ...profile, industry: event.target.value })} /></label><label className="admin-label">Work email<input className="admin-input" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label><label className="admin-label">Phone<input className="admin-input" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label><label className="admin-label">Timezone<select className="admin-input" value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })}><option>Asia/Kolkata</option><option>Asia/Dubai</option><option>Europe/London</option></select></label></div></>}
        {active !== 'company-profile' && <div className="setup-detail"><h2>{STEP_META[selectedIndex]?.[1]}</h2><p>{selectedLocked ? `${stepModules[active]} is not included in the company's pinned plan version. Existing permissions stay dormant and this step is excluded from completion.` : `${STEP_META[selectedIndex]?.[2]}. Save this checkpoint now, or skip it and return from the dashboard checklist.`}</p>{deepLinks[active] && !selectedLocked && <button className="admin-button admin-button--secondary" disabled={!requiredReady} onClick={() => navigate(deepLinks[active])}>Open {STEP_META[selectedIndex]?.[1]} <ArrowRight size={16} /></button>}{!requiredReady && deepLinks[active] && !selectedLocked && <small>Complete the company profile before opening operational settings.</small>}{selectedLocked && <button className="admin-button admin-button--secondary" onClick={() => navigate('/company-admin/modules')}>Review plan modules</button>}</div>}
        <footer className="setup-actions"><button className="admin-button admin-button--secondary" disabled={selectedIndex === 0} onClick={() => setActive(STEP_META[Math.max(0, selectedIndex - 1)][0])}><ArrowLeft size={16} /> Back</button><div>{!selectedLocked && active !== 'company-profile' && <button className="admin-button admin-button--secondary" onClick={() => mutation.mutate({ key: active, status: 'SKIPPED' })}><SkipForward size={16} /> Skip for now</button>}<button className="admin-button" onClick={selectedLocked ? () => setActive(STEP_META[Math.min(STEP_META.length - 1, selectedIndex + 1)][0]) : save}>{selectedLocked ? 'Continue' : active === 'invitations' ? 'Finish setup' : 'Save and continue'} <ArrowRight size={16} /></button></div></footer>
      </section>
    </div>
  </div>;
}
