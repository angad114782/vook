import { Link, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAccess } from '../../hooks/queries/useAccess';

export default function AccessGuard({ permission, module, children }: { permission?: string; module?: string; children: React.ReactNode }) {
  const location = useLocation();
  const access = useAccess();
  if (access.isLoading) return <div style={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><Loader2 size={20} /></div>;
  const permissionMissing = !!permission && !access.can(permission);
  const moduleMissing = !!module && !access.moduleEnabled(module);
  if (permissionMissing || moduleMissing) {
    const reason = access.denialReason(permission, module);
    const explanation = reason === 'SUBSCRIPTION'
      ? `Operational access is locked because this company's subscription is ${access.data?.subscription?.state?.toLowerCase().replace('_', ' ')}. Billing, account, subscription and support remain available.`
      : reason === 'ENTITLEMENT'
        ? `${module} is not included in the company's pinned plan version. A Super Admin can migrate the subscription or add a time-bound override.`
        : `Your current role assignments do not grant ${permission ?? 'the required action'} for this record scope.`;
    const dashboardPath = `${location.pathname.split('/').slice(0, 2).join('/')}/dashboard`;
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 280 }}>
        <div style={{ maxWidth: 430, width: '100%', padding: '24px', textAlign: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Access unavailable</h2>
          <p style={{ margin: '10px 0 16px', color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
            {explanation}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {permissionMissing && <span style={{ padding: '4px 8px', borderRadius: 5, background: '#fff7ed', color: '#9a3412', fontSize: 11 }}>Permission: {permission}</span>}
            {moduleMissing && <span style={{ padding: '4px 8px', borderRadius: 5, background: '#eff6ff', color: '#1d4ed8', fontSize: 11 }}>Module: {module}</span>}
            <span style={{ padding: '4px 8px', borderRadius: 5, background: '#f1f5f9', color: '#475569', fontSize: 11 }}>Reason: {reason ?? 'SCOPE'}</span>
          </div>
          <Link to={dashboardPath} style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 7, background: '#0d4a47', color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
