import { AlertTriangle, CheckCircle2, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccess } from '../../hooks/queries/useAccess';

const date = (value: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function SubscriptionBanner() {
  const { data } = useAccess();
  const subscription = data?.subscription;
  if (!subscription || subscription.state === 'UNKNOWN') return null;
  if (subscription.state === 'ACTIVE') return (
    <div className="subscription-banner subscription-banner--ok" role="status">
      <CheckCircle2 size={15} />
      <span><strong>{subscription.plan ?? 'Current plan'}</strong> active · renews {date(subscription.currentPeriodEnd)}</span>
    </div>
  );
  if (subscription.state === 'TRIAL') return (
    <div className="subscription-banner subscription-banner--trial" role="status">
      <AlertTriangle size={16} />
      <span><strong>{subscription.plan} trial</strong> · {subscription.daysRemaining} days left, ending {date(subscription.trialEndsAt)}</span>
      <Link to="/company-admin/plan">View plan</Link>
    </div>
  );
  const grace = subscription.state === 'PAST_DUE';
  return (
    <div className={`subscription-banner ${grace ? 'subscription-banner--warning' : 'subscription-banner--danger'}`} role="alert">
      {grace ? <AlertTriangle size={16} /> : <LockKeyhole size={16} />}
      <span><strong>{grace ? 'Payment overdue — read-only access' : 'Operational access suspended'}</strong> · {grace ? `Renew by ${date(subscription.gracePeriodEnd)}` : 'Renew or contact support to restore access.'}</span>
      <Link to="/company-admin/plan">{grace ? 'Renew now' : 'Restore access'}</Link>
    </div>
  );
}
