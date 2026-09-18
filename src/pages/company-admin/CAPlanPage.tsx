import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { caApi } from '../../api/companyAdmin';
import { onboardingApi } from '../../api/onboarding';
import { paymentsApi } from '../../api/payments';
import { openPaymentCheckout } from '../../payments/checkout';

export default function CAPlanPage() {
  const client = useQueryClient();
  const [cycle, setCycle] = useState<'Monthly' | 'Annual'>('Monthly');
  const [busy, setBusy] = useState('');
  const current = useQuery({ queryKey: ['ca', 'subscription'], queryFn: () => caApi.getSubscription().then((response) => response.data) });
  const plans = useQuery({ queryKey: ['public-plans'], queryFn: () => onboardingApi.plans().then((response) => response.data) });
  const payments = useQuery({ queryKey: ['ca', 'payments'], queryFn: () => paymentsApi.mine().then((response) => response.data) });
  const status: any = current.data?.status;
  const entitlements = current.data?.entitlements;
  const needsRecovery = ['SUSPENDED', 'PAST_DUE', 'CANCELLED'].includes(status?.state);

  const subscribe = async (versionId: string, planName: string) => {
    setBusy(versionId);
    try {
      const { data: order } = await caApi.createSubscriptionCheckout(versionId, cycle);
      if (order.scheduled) {
        toast.success(`Plan change scheduled for ${order.effectiveAt ? new Date(order.effectiveAt).toLocaleDateString('en-IN') : 'the next renewal'}.`);
        await client.invalidateQueries({ queryKey: ['ca', 'subscription'] });
        setBusy('');
        return;
      }
      await openPaymentCheckout({ keyId: order.keyId, amount: order.amount, currency: order.currency, orderId: order.orderId, description: `${planName} ${cycle} subscription` });
      toast.success('Payment received. Access updates after secure confirmation.');
      await client.invalidateQueries({ queryKey: ['ca'] });
      await client.invalidateQueries({ queryKey: ['auth', 'access'] });
      setBusy('');
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? error?.message ?? 'Could not start checkout');
      setBusy('');
    }
  };

  return <div className="admin-page">
    <header className="admin-page__header"><div><h1>Subscription and billing</h1><p>Review version-pinned entitlements, recover access, or purchase an upgrade through one-time Razorpay checkout.</p></div><div className="health-chip"><ShieldCheck size={15} /> {status?.state ?? 'Loading'}</div></header>
    <section className="admin-card current-plan"><div><small>Current plan</small><h2>{entitlements?.plan.name ?? entitlements?.plan.code ?? '—'}</h2><p>{status?.state === 'TRIAL' ? `Trial ends ${new Date(status.trialEndsAt).toLocaleDateString('en-IN')}` : status?.currentPeriodEnd ? `Current period ends ${new Date(status.currentPeriodEnd).toLocaleDateString('en-IN')}` : 'No active paid period'}</p></div><div><span>{entitlements?.limits.employees ?? '—'} employees</span><span>{entitlements?.limits.branches ?? '—'} branches</span><span>{entitlements?.limits.storageGB ?? '—'} GB</span></div></section>
    <div className="cycle-switch" aria-label="Billing cycle"><button className={cycle === 'Monthly' ? 'is-active' : ''} onClick={() => setCycle('Monthly')}>Monthly</button><button className={cycle === 'Annual' ? 'is-active' : ''} onClick={() => setCycle('Annual')}>Annual <small>best value</small></button></div>
    <section className="plan-grid">{plans.data?.map((plan) => {
      const version: any = plan.currentVersionId;
      const price = cycle === 'Annual' ? version?.pricing.annual ?? plan.annualPrice : version?.pricing.monthly ?? plan.price;
      const currentPlan = entitlements?.plan.code === plan.type;
      const disabled = (currentPlan && !needsRecovery) || busy === version?.id || !version?.id;
      const label = busy === version?.id ? 'Opening checkout…' : currentPlan && !needsRecovery ? 'Current plan' : needsRecovery ? 'Restore with this plan' : 'Choose plan';
      return <article className="admin-card plan-card" key={plan.id}><div className="plan-card__head"><div><small>{plan.type}</small><h2>{plan.name}</h2></div>{currentPlan && <span data-status="PUBLISHED">CURRENT</span>}</div><p className="plan-card__price">₹{price?.toLocaleString('en-IN')}<small>/{cycle === 'Annual' ? 'year' : 'month'}</small></p><div className="module-list">{(version?.moduleIds ?? []).slice(0, 6).map((module: any) => <span key={typeof module === 'string' ? module : module.id}><Check size={13} />{typeof module === 'string' ? 'Included module' : module.name}</span>)}</div><button className="admin-button" disabled={disabled} onClick={() => subscribe(version.id, plan.name)}>{needsRecovery ? <LockKeyhole size={16} /> : <CreditCard size={16} />}{label}</button></article>;
    })}</section>
    <section className="admin-card" style={{ marginTop: 24, padding: 24 }} aria-labelledby="billing-history-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <div><h2 id="billing-history-title" style={{ margin: 0, fontSize: 18 }}>Billing history</h2><p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 12 }}>Invoices and payment records for this company.</p></div>
      </div>
      {payments.isLoading ? <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Loading billing history...</p> : payments.data?.length ? <div style={{ display: 'grid', gap: 8 }}>
        {payments.data.map((payment) => <div key={payment.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(110px, .8fr) minmax(100px, .7fr) auto', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid #e2e8f0', fontSize: 12 }}>
          <div><strong style={{ display: 'block', color: '#0f172a' }}>{payment.plan} · {payment.billingCycle}</strong><span style={{ color: '#64748b' }}>{payment.reference ?? payment.razorpayPaymentId ?? 'Payment record'} · {new Date(payment.paidAt ?? payment.createdAt).toLocaleDateString('en-IN')}</span></div>
          <span style={{ color: '#475569' }}>{payment.source}</span>
          <span style={{ fontWeight: 700, color: payment.status === 'PAID' ? '#15803d' : '#a16207' }}>{payment.status}</span>
          <strong style={{ textAlign: 'right', color: '#0f172a' }}>{payment.currency} {payment.amount.toLocaleString('en-IN')}</strong>
        </div>)}
      </div> : <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>No billing history is available yet.</p>}
    </section>
  </div>;
}
