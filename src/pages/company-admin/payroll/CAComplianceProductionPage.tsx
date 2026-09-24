import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { payrollConfigApi, type ContributionRule, type PayrollComplianceConfig } from '../../../api/payrollConfig';
import { ErrorState, LoadingState, PageHeader, SuccessNotice, ValidationSummary } from '../../../components/ui/ProductPrimitives';
import { extractError } from '../../../utils/errorUtils';

const employeeGroups = ['All Employees', 'Permanent Staff', 'Contract Workers'];
const states = [['MH', 'Maharashtra'], ['DL', 'Delhi'], ['KA', 'Karnataka'], ['TN', 'Tamil Nadu'], ['TS', 'Telangana'], ['WB', 'West Bengal']];

export default function CAComplianceProductionPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['payroll', 'compliance'], queryFn: () => payrollConfigApi.getCompliance().then((response) => response.data) });
  const [draft, setDraft] = useState<PayrollComplianceConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  useEffect(() => { if (query.data) setDraft(structuredClone(query.data)); }, [query.data]);
  const mutation = useMutation({
    mutationFn: (config: PayrollComplianceConfig) => payrollConfigApi.saveCompliance(config).then((response) => response.data),
    onSuccess: (config) => { setDraft(config); setSaved(true); toast.success('Statutory configuration saved'); void queryClient.invalidateQueries({ queryKey: ['payroll', 'compliance'] }); },
    onError: (error) => toast.error(extractError(error, 'Unable to save statutory configuration')),
  });

  if (query.isLoading) return <LoadingState label="Loading statutory configuration…" />;
  if (query.isError) return <ErrorState description="Statutory configuration could not be loaded." onRetry={() => void query.refetch()} />;
  if (!draft) return <LoadingState label="Preparing statutory configuration…" />;

  const save = () => {
    const next: Array<{ field: string; message: string }> = [];
    if (!draft.effectiveFrom) next.push({ field: 'compliance-effective-from', message: 'Choose an effective date.' });
    for (const [key, rule] of [['pf', draft.pf], ['esi', draft.esi]] as const) {
      if (rule.employeeRate < 0 || rule.employerRate < 0) next.push({ field: `${key}-employee-rate`, message: `${key.toUpperCase()} rates cannot be negative.` });
      if (rule.wageCeiling < 0) next.push({ field: `${key}-wage-ceiling`, message: `${key.toUpperCase()} wage ceiling cannot be negative.` });
    }
    setErrors(next);
    if (!next.length) mutation.mutate(draft);
  };

  const updateContribution = (key: 'pf' | 'esi', patch: Partial<ContributionRule>) => { setSaved(false); setDraft({ ...draft, [key]: { ...draft[key], ...patch } }); };

  return <div className="product-page compliance-page">
    <PageHeader eyebrow="Payroll · India" title="Statutory configuration" description="Effective-dated PF, ESI, professional tax, labour welfare fund and TDS rules used by payroll preflight." actions={<button className="admin-button" disabled={mutation.isPending} onClick={save}><Save size={16} aria-hidden="true" /> {mutation.isPending ? 'Saving…' : 'Save changes'}</button>} />
    <ValidationSummary errors={errors} title="Compliance settings need attention" />
    {saved && <SuccessNotice>Saved as version {draft.version}. New payroll runs will use this effective-dated configuration.</SuccessNotice>}
    <section className="admin-card compliance-scope">
      <header><Landmark size={19} aria-hidden="true" /><div><h2>Applicability</h2><p>These settings apply to new payroll calculations from the selected date.</p></div></header>
      <div><label className="admin-label" htmlFor="compliance-effective-from">Effective from<input id="compliance-effective-from" className="admin-input" type="date" value={draft.effectiveFrom} onChange={(event) => { setSaved(false); setDraft({ ...draft, effectiveFrom: event.target.value }); }} /></label><label className="admin-label" htmlFor="compliance-state">Primary state<select id="compliance-state" className="admin-input" value={draft.stateCode} onChange={(event) => { setSaved(false); setDraft({ ...draft, stateCode: event.target.value, professionalTax: { ...draft.professionalTax, stateCode: event.target.value }, labourWelfareFund: { ...draft.labourWelfareFund, stateCode: event.target.value } }); }}>{states.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label><span>Version {draft.version}<small>Last saved {new Date(draft.updatedAt).toLocaleString('en-IN')}</small></span></div>
    </section>
    <div className="compliance-grid">
      <ContributionCard code="pf" title="Provident Fund (PF)" description="Employee and employer contribution rules" rule={draft.pf} onChange={(patch) => updateContribution('pf', patch)} />
      <ContributionCard code="esi" title="Employees’ State Insurance" description="ESI contribution and wage eligibility" rule={draft.esi} onChange={(patch) => updateContribution('esi', patch)} />
      <SimpleRuleCard title="Professional Tax" description="State-specific payroll deduction" enabled={draft.professionalTax.enabled} group={draft.professionalTax.employeeGroup} onChange={(patch) => { setSaved(false); setDraft({ ...draft, professionalTax: { ...draft.professionalTax, ...patch } }); }} />
      <SimpleRuleCard title="Labour Welfare Fund" description="State and periodicity-dependent contribution" enabled={draft.labourWelfareFund.enabled} group={draft.labourWelfareFund.employeeGroup} onChange={(patch) => { setSaved(false); setDraft({ ...draft, labourWelfareFund: { ...draft.labourWelfareFund, ...patch } }); }} />
      <section className="admin-card compliance-card compliance-card--wide">
        <header><div><ShieldCheck size={18} aria-hidden="true" /><span><h2>Tax Deducted at Source</h2><p>Employee declaration, proof, and projected annual tax behavior.</p></span></div><Toggle label="Enable automatic TDS" checked={draft.tds.enabled} onChange={(enabled) => { setSaved(false); setDraft({ ...draft, tds: { ...draft.tds, enabled } }); }} /></header>
        <div className="compliance-card__fields"><GroupSelect value={draft.tds.employeeGroup} onChange={(employeeGroup) => { setSaved(false); setDraft({ ...draft, tds: { ...draft.tds, employeeGroup } }); }} /><label className="admin-label">Default tax regime<select className="admin-input" value={draft.tds.defaultRegime} onChange={(event) => { setSaved(false); setDraft({ ...draft, tds: { ...draft.tds, defaultRegime: event.target.value as 'OLD' | 'NEW' } }); }}><option value="NEW">New regime</option><option value="OLD">Old regime</option></select></label></div>
        <div className="product-notice">Employee-level tax regime selection and verified declarations override this default during payroll calculation.</div>
      </section>
    </div>
  </div>;
}

function ContributionCard({ code, title, description, rule, onChange }: { code: string; title: string; description: string; rule: ContributionRule; onChange: (patch: Partial<ContributionRule>) => void }) {
  return <section className="admin-card compliance-card">
    <header><div><ShieldCheck size={18} aria-hidden="true" /><span><h2>{title}</h2><p>{description}</p></span></div><Toggle label={`Enable ${title}`} checked={rule.enabled} onChange={(enabled) => onChange({ enabled })} /></header>
    <div className="compliance-card__fields"><GroupSelect value={rule.employeeGroup} onChange={(employeeGroup) => onChange({ employeeGroup })} /><NumberField id={`${code}-wage-ceiling`} label="Monthly wage ceiling" value={rule.wageCeiling} onChange={(wageCeiling) => onChange({ wageCeiling })} /><NumberField id={`${code}-employee-rate`} label="Employee share (%)" value={rule.employeeRate} onChange={(employeeRate) => onChange({ employeeRate })} /><NumberField id={`${code}-employer-rate`} label="Employer share (%)" value={rule.employerRate} onChange={(employerRate) => onChange({ employerRate })} /></div>
  </section>;
}

function SimpleRuleCard({ title, description, enabled, group, onChange }: { title: string; description: string; enabled: boolean; group: string; onChange: (patch: { enabled?: boolean; employeeGroup?: string }) => void }) {
  return <section className="admin-card compliance-card"><header><div><ShieldCheck size={18} aria-hidden="true" /><span><h2>{title}</h2><p>{description}</p></span></div><Toggle label={`Enable ${title}`} checked={enabled} onChange={(value) => onChange({ enabled: value })} /></header><div className="compliance-card__fields"><GroupSelect value={group} onChange={(employeeGroup) => onChange({ employeeGroup })} /><div className="product-notice">State: configured from payroll applicability. Detailed slabs must be supplied by the backend statutory rules service.</div></div></section>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="product-switch"><span className="sr-only">{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span aria-hidden="true" /></label>;
}

function GroupSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="admin-label">Employee group<select className="admin-input" value={value} onChange={(event) => onChange(event.target.value)}>{employeeGroups.map((group) => <option key={group}>{group}</option>)}</select></label>;
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return <label className="admin-label" htmlFor={id}>{label}<input id={id} className="admin-input" type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
