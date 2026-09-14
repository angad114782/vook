import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, LockKeyhole, Search, X } from 'lucide-react';
import { subscriptionsApi, type ModuleCatalogItem, type PlanData } from '../../api/subscriptions';
import { extractError } from '../../utils/errorUtils';

type Props = { plan?: PlanData | null; onClose: () => void; onSave: () => void };

const ids = (items: PlanData['moduleIds'] | undefined) => (items ?? []).map((item) => typeof item === 'string' ? item : item.id);

export default function PlanBuilderModal({ plan, onClose, onSave }: Props) {
  const source = plan?.draft;
  const [catalog, setCatalog] = useState<ModuleCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    name: source?.name ?? plan?.name ?? '',
    type: plan?.type ?? '',
    price: source?.pricing.monthly ?? plan?.price ?? 0,
    annualPrice: source?.pricing.annual ?? plan?.annualPrice ?? 0,
    trialEnabled: source?.trial.enabled ?? plan?.trialEnabled ?? true,
    defaultTrialDays: source?.trial.days ?? plan?.defaultTrialDays ?? 5,
    maxUsers: source?.limits.employees ?? plan?.maxUsers ?? 50,
    maxBranches: source?.limits.branches ?? plan?.maxBranches ?? 2,
    storageGB: source?.limits.storageGB ?? plan?.storageGB ?? 5,
    apiRequests: (source?.limits as any)?.apiRequests ?? (plan as any)?.apiRequests ?? 10000,
    moduleIds: ids(source?.moduleIds ?? plan?.moduleIds),
    features: source?.features ?? plan?.features ?? [],
  });
  const [feature, setFeature] = useState('');

  useEffect(() => {
    subscriptionsApi.getModuleCatalog().then(({ data }) => {
      setCatalog(data);
      const core = data.filter((item) => item.isCore).map((item) => item.id);
      setForm((current) => ({ ...current, moduleIds: [...new Set([...core, ...current.moduleIds])] }));
    }).catch(() => setError('The module catalogue could not be loaded.')).finally(() => setLoadingCatalog(false));
  }, []);

  const groups = useMemo(() => {
    const visible = catalog.filter((item) => `${item.name} ${item.description ?? ''} ${item.category ?? ''}`.toLowerCase().includes(search.toLowerCase()));
    return Object.entries(visible.reduce<Record<string, ModuleCatalogItem[]>>((result, item) => {
      const category = item.category ?? 'Other';
      (result[category] ??= []).push(item);
      return result;
    }, {}));
  }, [catalog, search]);

  const toggleModule = (module: ModuleCatalogItem) => {
    if (module.isCore || !module.planSelectable) return;
    setForm((current) => ({ ...current, moduleIds: current.moduleIds.includes(module.id) ? current.moduleIds.filter((id) => id !== module.id) : [...current.moduleIds, module.id] }));
  };
  const addFeature = () => { const value = feature.trim(); if (value && !form.features.includes(value)) setForm((current) => ({ ...current, features: [...current.features, value] })); setFeature(''); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!form.name.trim() || !form.type.trim() || form.maxUsers < 1 || form.defaultTrialDays < 0) { setError('Add a plan name, unique code, and valid limits.'); return; }
    setSaving(true);
    try {
      if (plan) await subscriptionsApi.updatePlan(plan.id, { ...form, name: form.name.trim(), type: form.type.trim().toUpperCase(), draftRevision: plan.draftRevision ?? 0 });
      else await subscriptionsApi.createPlan({ ...form, name: form.name.trim(), type: form.type.trim().toUpperCase() });
      onSave();
    } catch (caught) { setError(extractError(caught, 'The plan draft could not be saved.')); }
    finally { setSaving(false); }
  };

  return <div className="plan-builder-backdrop" role="presentation">
    <section className="plan-builder" role="dialog" aria-modal="true" aria-label={plan ? `Edit ${plan.name}` : 'Create plan'}>
      <header><div><span className="plan-builder__eyebrow">Commercial package</span><h2>{plan ? `Edit ${plan.name}` : 'Create a plan'}</h2><p>Package modules, limits, pricing, and trial rules into one publishable version.</p></div><button type="button" className="icon-button" aria-label="Close plan builder" onClick={onClose}><X size={19} /></button></header>
      <form onSubmit={save}>
        {error && <div className="plan-builder__error">{error}</div>}
        <section><div className="plan-builder__section-title"><strong>1. Identity and billing</strong><span>What customers see and pay</span></div><div className="plan-builder__grid plan-builder__grid--4">
          <label className="admin-label">Plan name<input className="admin-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Business" /></label>
          <label className="admin-label">Plan code<input className="admin-input" disabled={Boolean(plan)} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value.toUpperCase() })} placeholder="BUSINESS" /></label>
          <label className="admin-label">Monthly price (₹)<input className="admin-input" type="number" min={0} value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label>
          <label className="admin-label">Annual price (₹)<input className="admin-input" type="number" min={0} value={form.annualPrice} onChange={(event) => setForm({ ...form, annualPrice: Number(event.target.value) })} /></label>
        </div></section>
        <section><div className="plan-builder__section-title"><strong>2. Trial and limits</strong><span>Applied when a company receives this version</span></div><div className="plan-builder__grid plan-builder__grid--5">
          <label className="admin-label plan-builder__switch"><span>Trial enabled</span><input type="checkbox" checked={form.trialEnabled} onChange={(event) => setForm({ ...form, trialEnabled: event.target.checked })} /></label>
          <label className="admin-label">Trial days<input className="admin-input" type="number" min={0} disabled={!form.trialEnabled} value={form.defaultTrialDays} onChange={(event) => setForm({ ...form, defaultTrialDays: Number(event.target.value) })} /></label>
          <label className="admin-label">Employees<input className="admin-input" type="number" min={1} value={form.maxUsers} onChange={(event) => setForm({ ...form, maxUsers: Number(event.target.value) })} /></label>
          <label className="admin-label">Branches<input className="admin-input" type="number" min={1} value={form.maxBranches} onChange={(event) => setForm({ ...form, maxBranches: Number(event.target.value) })} /></label>
          <label className="admin-label">Storage (GB)<input className="admin-input" type="number" min={1} value={form.storageGB} onChange={(event) => setForm({ ...form, storageGB: Number(event.target.value) })} /></label>
          <label className="admin-label">API requests / month<input className="admin-input" type="number" min={0} value={form.apiRequests} onChange={(event) => setForm({ ...form, apiRequests: Number(event.target.value) })} /></label>
        </div></section>
        <section><div className="plan-builder__section-title"><strong>3. Included modules</strong><span>{form.moduleIds.length} selected · core controls stay included</span></div><div className="plan-builder__search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search modules or categories" /></div>{loadingCatalog ? <div className="admin-loading"><Loader2 className="spin" size={18} /> Loading module catalogue…</div> : <div className="plan-module-groups">{groups.map(([category, modules]) => <section key={category}><h3>{category}</h3><div>{modules.map((module) => { const selected = form.moduleIds.includes(module.id); return <button type="button" key={module.id} aria-pressed={selected} className={selected ? 'is-selected' : ''} onClick={() => toggleModule(module)} disabled={module.isCore || !module.planSelectable}><span className="plan-module-check">{module.isCore ? <LockKeyhole size={13} /> : selected ? <Check size={14} /> : null}</span><span><strong>{module.name}</strong><small>{module.description}</small><em>{module.actions?.join(' · ')}</em></span></button>; })}</div></section>)}</div>}</section>
        <section><div className="plan-builder__section-title"><strong>4. Plan highlights</strong><span>Plain-language details displayed during selection</span></div><div className="plan-builder__feature-entry"><input className="admin-input" value={feature} onChange={(event) => setFeature(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addFeature(); } }} placeholder="Example: Multi-level approval workflows" /><button type="button" className="admin-button admin-button--secondary" onClick={addFeature}>Add</button></div><div className="plan-builder__features">{form.features.map((item) => <span key={item}>{item}<button type="button" aria-label={`Remove ${item}`} onClick={() => setForm((current) => ({ ...current, features: current.features.filter((feature) => feature !== item) }))}><X size={12} /></button></span>)}</div></section>
        <footer><div><strong>{plan ? 'Saving creates an unpublished revision.' : 'New plans start as drafts.'}</strong><span>Companies only receive immutable published versions.</span></div><button type="button" className="admin-button admin-button--secondary" onClick={onClose}>Cancel</button><button className="admin-button" disabled={saving || loadingCatalog}>{saving && <Loader2 size={15} className="spin" />} Save draft</button></footer>
      </form>
    </section>
  </div>;
}
