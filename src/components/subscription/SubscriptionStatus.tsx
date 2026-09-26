import { AlertTriangle, CheckCircle2, LockKeyhole } from 'lucide-react';
import { useAccess } from '../../hooks/queries/useAccess';

const date = (value: string | null) => value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

export default function SubscriptionStatus({ onViewPlan }: { onViewPlan: () => void }) {
  const { data } = useAccess();
  const subscription = data?.subscription;
  if (!subscription || subscription.state === 'UNKNOWN') return null;

  const trial = subscription.state === 'TRIAL';
  const active = subscription.state === 'ACTIVE';
  const pastDue = subscription.state === 'PAST_DUE';
  const Icon = active ? CheckCircle2 : trial || pastDue ? AlertTriangle : LockKeyhole;
  const tone = active ? activeTone : trial ? trialTone : pastDue ? warningTone : dangerTone;
  const message = active
    ? <><strong>{subscription.plan ?? 'Current plan'}</strong> active · renews {date(subscription.currentPeriodEnd)}</>
    : trial
      ? <><strong>{subscription.plan ?? 'Current plan'} trial</strong> · {subscription.daysRemaining ?? '—'} days left, ending {date(subscription.trialEndsAt)}</>
      : pastDue
        ? <><strong>Payment overdue</strong> · renew by {date(subscription.gracePeriodEnd)}</>
        : <><strong>Operational access suspended</strong> · renew to restore access.</>;

  return (
    <div role={active ? 'status' : 'alert'} style={{ ...status, ...tone }}>
      <Icon size={14} aria-hidden="true" />
      <span style={copy}>{message}</span>
      {!active && <button type="button" onClick={onViewPlan} style={action}>{pastDue ? 'Renew' : 'View plan'}</button>}
    </div>
  );
}

const status: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, minHeight: 36, padding: '7px 12px',
  borderBottom: '1px solid', fontSize: 10.5, lineHeight: 1.4,
};
const copy: React.CSSProperties = { flex: 1, minWidth: 0 };
const action: React.CSSProperties = {
  border: 0, padding: 0, background: 'transparent', color: 'inherit', cursor: 'pointer',
  fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
};
const activeTone: React.CSSProperties = { background: '#eefbf5', borderColor: '#c6eedb', color: '#17603d' };
const trialTone: React.CSSProperties = { background: '#eef8ff', borderColor: '#cce7f8', color: '#145d84' };
const warningTone: React.CSSProperties = { background: '#fff8e8', borderColor: '#f3dfaa', color: '#81560c' };
const dangerTone: React.CSSProperties = { background: '#fff0ef', borderColor: '#f3cac5', color: '#8f2c23' };
