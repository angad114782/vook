import { CheckCircle2, Gauge, LockKeyhole, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCaModules } from '../../hooks/queries/useCaQueries';
export default function CAModulesPage() {
  const { data, isLoading } = useCaModules();
  const modules = data?.modules ?? [];
  const included = modules.filter((module) => module.isEnabled);
  const locked = modules.filter((module) => !module.isEnabled);
  if (isLoading) return <div className="empty-state">Loading plan entitlements…</div>;
  return <div className="admin-page">
    <header className="admin-page__header"><div><h1>Plan and modules</h1><p>Your effective access combines the published plan version and any time-limited Super Admin overrides. Company admins cannot grant modules directly.</p></div><Link className="admin-button" to="/company-admin/plan"><Sparkles size={16} /> Upgrade plan</Link></header>
    <section className="entitlement-summary">
      <div className="admin-card"><small>Current plan</small><strong>{data?.plan.name ?? data?.plan.code ?? 'Custom'}</strong><span>Version-pinned entitlements</span></div>
      <div className="admin-card"><small>Employees</small><strong>{data?.limits.employees ?? '—'}</strong><span>Maximum active workforce</span></div>
      <div className="admin-card"><small>Storage</small><strong>{data?.limits.storageGB ?? '—'} GB</strong><span>Document allowance</span></div>
    </section>
    <section><h2 className="section-title">Included modules <span>{included.length}</span></h2><div className="entitlement-grid">{included.map((item) => <article className="admin-card entitlement-card" key={item.id}><CheckCircle2 size={18} /><div><strong>{item.module.name}</strong><p>{item.module.description || 'Included in your plan'}</p></div><small>{item.source === 'OVERRIDE_GRANT' ? 'Granted override' : 'Plan'}</small></article>)}</div></section>
    {!!locked.length && <section><h2 className="section-title">Available on other plans <span>{locked.length}</span></h2><div className="entitlement-grid">{locked.map((item) => <article className="admin-card entitlement entitlement-card is-locked" key={item.id}><LockKeyhole size={18} /><div><strong>{item.module.name}</strong><p>{item.source === 'OVERRIDE_DENY' ? 'Unavailable by platform override' : item.module.description || 'Upgrade to unlock'}</p></div><small>Locked</small></article>)}</div></section>}
    {!!data?.overrides.length && <section className="admin-card override-note"><Gauge size={18} /><div><strong>{data.overrides.length} custom entitlement override{data.overrides.length === 1 ? '' : 's'}</strong><p>Overrides are visible here for transparency. Contact support if an override needs review.</p></div></section>}
  </div>;
}
