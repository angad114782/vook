import { useEffect, useState } from 'react';
import { CreditCard, Loader2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { onboardingApi } from '../../api/onboarding';
import type { PlanData } from '../../api/subscriptions';
import { extractError } from '../../utils/errorUtils';
import { openPaymentCheckout } from '../../payments/checkout';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ companyName: '', companyEmail: '', adminName: '', adminEmail: '', password: '', plan: '', acquisition: 'TRIAL' as 'TRIAL' | 'PAID', billingCycle: 'Monthly' as 'Monthly' | 'Annual', provider: 'RAZORPAY' as 'RAZORPAY' | 'PAYU' });
  useEffect(() => { onboardingApi.plans().then((response) => { setPlans(response.data); setForm((current) => ({ ...current, plan: response.data[0]?.type ?? '' })); }).catch((reason) => setError(extractError(reason, 'Could not load plans.'))); }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    const payload = { company: { name: form.companyName, email: form.companyEmail }, admin: { name: form.adminName, email: form.adminEmail, password: form.password }, plan: form.plan, billingCycle: form.billingCycle, provider: form.provider, idempotencyKey: `registration:${form.adminEmail}:${form.plan}:${form.billingCycle}` };
    try {
      if (form.acquisition === 'TRIAL') {
        const result = await onboardingApi.trial(payload);
        navigate(`/register/complete?registration=${result.data.registrationId}&mode=trial`); return;
      }
      const result = await onboardingApi.checkout(payload);
      const order = result.data;
      await openPaymentCheckout({ provider: order.provider, keyId: order.keyId, amount: order.amount, currency: order.currency, orderId: order.orderId, redirectUrl: order.redirectUrl, description: `${form.plan} ${form.billingCycle} plan` });
      navigate(`/register/complete?registration=${order.registrationId}`);
    } catch (reason) { setError(extractError(reason, 'Could not start registration.')); setBusy(false); }
  };
  const selected = plans.find((plan) => plan.type === form.plan);
  return <main className="register-shell">
    <aside className="register-story"><Link to="/login" className="register-brand"><span>V</span>VOOK</Link><div><div className="register-kicker"><Sparkles size={13} /> WORKFORCE OPERATIONS</div><h1>Set up the company around how work actually flows.</h1><p>Start with a verified cardless trial, or purchase a full billing cycle through the simulated Razorpay or PayU flow.</p></div><ol><li><span>1</span><div><strong>Choose plan and trial</strong><small>No card is needed for an eligible trial.</small></div></li><li><span>2</span><div><strong>Verify your email</strong><small>One self-service trial per administrator by default.</small></div></li><li><span>3</span><div><strong>Complete the essentials</strong><small>Profile and first branch unlock the dashboard.</small></div></li></ol></aside>
    <section className="register-form-wrap"><div className="register-top">Already registered? <Link to="/login">Sign in</Link></div><div className="register-card"><header><h2>Create your company account</h2><p>Choose how you want to start. You can upgrade from the company workspace later.</p></header>
      <div className="cycle-switch register-mode"><button className={form.acquisition === 'TRIAL' ? 'is-active' : ''} onClick={() => setForm({ ...form, acquisition: 'TRIAL' })}>Start free trial</button><button className={form.acquisition === 'PAID' ? 'is-active' : ''} onClick={() => setForm({ ...form, acquisition: 'PAID' })}>Buy now</button></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <fieldset><legend>Company</legend><div className="form-grid"><label className="admin-label">Company name<input className="admin-input" required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></label><label className="admin-label">Company email<input className="admin-input" type="email" value={form.companyEmail} onChange={(event) => setForm({ ...form, companyEmail: event.target.value })} /></label></div></fieldset>
        <fieldset><legend>Administrator</legend><div className="form-grid"><label className="admin-label">Full name<input className="admin-input" required value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} /></label><label className="admin-label">Work email<input className="admin-input" required type="email" value={form.adminEmail} onChange={(event) => setForm({ ...form, adminEmail: event.target.value })} /></label><label className="admin-label">Create password<input className="admin-input" required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label></div></fieldset>
        <fieldset><legend>Plan</legend><div className="public-plan-grid">{plans.map((plan) => <button type="button" key={plan.id} className={form.plan === plan.type ? 'is-selected' : ''} onClick={() => setForm({ ...form, plan: plan.type })}><strong>{plan.name}</strong><span>₹{plan.price.toLocaleString('en-IN')}<small>/month</small></span><small>{plan.maxUsers} employees · {plan.defaultTrialDays} trial days</small></button>)}</div>{form.acquisition === 'PAID' && <><div className="cycle-switch" style={{ marginTop: 12 }}><button type="button" className={form.billingCycle === 'Monthly' ? 'is-active' : ''} onClick={() => setForm({ ...form, billingCycle: 'Monthly' })}>Monthly</button><button type="button" className={form.billingCycle === 'Annual' ? 'is-active' : ''} onClick={() => setForm({ ...form, billingCycle: 'Annual' })}>Annual</button></div><label className="admin-label" style={{ marginTop: 12 }}>Checkout provider<select className="admin-input" value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value as 'RAZORPAY' | 'PAYU' })}><option value="RAZORPAY">Razorpay</option><option value="PAYU">PayU</option></select></label></>}</fieldset>
        <button className="admin-button register-submit" disabled={busy || !selected}>{busy ? <><Loader2 size={16} /> Preparing…</> : form.acquisition === 'TRIAL' ? <><Sparkles size={16} /> Verify email and start {selected?.defaultTrialDays ?? 5}-day trial</> : <><CreditCard size={16} /> Continue to secure checkout</>}</button>
      </form><footer><span><LockKeyhole size={13} /> Encrypted credentials</span><span><ShieldCheck size={13} /> Verified email</span></footer>
    </div></section>
  </main>;
}
