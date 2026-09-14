import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Building2, CalendarDays, Check, Loader2, ShieldCheck, Users, X } from 'lucide-react';
import { subscriptionsApi, type PlanData } from '../../api/subscriptions';
import type { Company } from '../../api/companies';
import { extractError } from '../../utils/errorUtils';

type Props = { plans: PlanData[]; companies: Company[]; defaultPlan?: string; onClose: () => void; onSave: () => void };

export default function PlanAssignmentModal({ plans, companies, defaultPlan, onClose, onSave }: Props) {
  const published = useMemo(() => plans.filter((plan) => plan.status === 'PUBLISHED' && plan.currentVersionId), [plans]);
  const initial = published.find((plan) => plan.type === defaultPlan) ?? published[0];
  const [companyId, setCompanyId] = useState('');
  const [planVersionId, setPlanVersionId] = useState(initial?.currentVersionId?.id ?? '');
  const [billingCycle, setBillingCycle] = useState<'Monthly' | 'Annual'>('Monthly');
  const [months, setMonths] = useState(12);
  const [reason, setReason] = useState('Commercial plan assignment approved by Super Admin');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const catalog = useQuery({ queryKey: ['sa', 'module-catalog'], queryFn: () => subscriptionsApi.getModuleCatalog().then((response) => response.data) });
  const selectedPlan = published.find((plan) => plan.currentVersionId?.id === planVersionId);
  const version = selectedPlan?.currentVersionId;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!companyId || !planVersionId) { setError('Select a company and a published plan version.'); return; }
    setSaving(true);
    try { await subscriptionsApi.assign({ companyId, planVersionId, billingCycle, months, reason }); onSave(); }
    catch (caught) { setError(extractError(caught, 'The plan could not be assigned.')); }
    finally { setSaving(false); }
  };

  return <div className="plan-builder-backdrop"><section className="assignment-dialog" role="dialog" aria-modal="true" aria-label="Assign published plan">
    <header><div><span className="plan-builder__eyebrow">Company provisioning</span><h2>Assign a published plan</h2><p>The company will be pinned to the exact version shown below.</p></div><button type="button" className="icon-button" aria-label="Close assignment" onClick={onClose}><X size={19} /></button></header>
    <form onSubmit={submit}>
      {error && <div className="plan-builder__error">{error}</div>}
      <div className="assignment-dialog__fields">
        <label className="admin-label"><span><Building2 size={14} /> Company</span><select className="admin-input" value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">Select company</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label>
        <label className="admin-label"><span><ShieldCheck size={14} /> Published plan</span><select className="admin-input" value={planVersionId} onChange={(event) => setPlanVersionId(event.target.value)}>{published.map((plan) => <option key={plan.id} value={plan.currentVersionId!.id}>{plan.name} · version {plan.currentVersionId!.version}</option>)}</select></label>
        <label className="admin-label"><span><CalendarDays size={14} /> Billing</span><select className="admin-input" value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as 'Monthly' | 'Annual')}><option>Monthly</option><option>Annual</option></select></label>
        <label className="admin-label"><span><CalendarDays size={14} /> Duration</span><select className="admin-input" value={months} onChange={(event) => setMonths(Number(event.target.value))}>{[1, 3, 6, 12, 24].map((value) => <option value={value} key={value}>{value} {value === 1 ? 'month' : 'months'}</option>)}</select></label>
      </div>
      {version && <section className="assignment-impact"><header><div><strong>{selectedPlan.name}</strong><span>Version {version.version} · immutable</span></div><strong>₹{(billingCycle === 'Annual' ? version.pricing.annual : version.pricing.monthly).toLocaleString('en-IN')}<small> / {billingCycle === 'Annual' ? 'year' : 'month'}</small></strong></header><div className="assignment-impact__stats"><span><Users size={15} /><strong>{version.limits.employees}</strong> employees</span><span><Building2 size={15} /><strong>{version.limits.branches}</strong> branches</span><span><Boxes size={15} /><strong>{version.limits.storageGB} GB</strong> storage</span><span><CalendarDays size={15} /><strong>{version.trial.enabled ? `${version.trial.days} days` : 'Off'}</strong> trial</span></div><div className="assignment-impact__modules"><strong>{version.moduleIds.length} included modules</strong><p>{version.moduleIds.map((module) => typeof module === 'string' ? catalog.data?.find((item) => item.id === module)?.name ?? module : module.name).slice(0, 8).join(' · ')}</p></div></section>}
      <label className="admin-label">Reason<textarea className="admin-input" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <footer><p><Check size={15} /> Existing companies stay on their current version until this assignment is confirmed.</p><button type="button" className="admin-button admin-button--secondary" onClick={onClose}>Cancel</button><button className="admin-button" disabled={saving || !published.length}>{saving && <Loader2 className="spin" size={15} />} Assign version</button></footer>
    </form>
  </section></div>;
}
