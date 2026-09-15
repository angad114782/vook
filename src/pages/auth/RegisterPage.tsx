import { useEffect, useState } from 'react';
import { CreditCard, Loader2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { onboardingApi, type CheckoutRegistrationData } from '../../api/onboarding';
import type { PlanData } from '../../api/subscriptions';
import { extractError } from '../../utils/errorUtils';
import { openPaymentCheckout } from '../../payments/checkout';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ companyName: '', companyEmail: '', adminName: '', adminEmail: '', password: '', plan: '', billingCycle: 'Monthly' as 'Monthly' | 'Annual' });

  useEffect(() => {
    onboardingApi.plans()
      .then((response) => {
        const availablePlans = response.data.filter((plan) => plan.status === 'PUBLISHED');
        setPlans(availablePlans);
        setForm((current) => ({ ...current, plan: current.plan || availablePlans[0]?.type || '' }));
      })
      .catch((reason) => setError(extractError(reason, 'Could not load plans.')));
  }, []);

  const selected = plans.find((plan) => plan.type === form.plan);
  const amount = selected ? (form.billingCycle === 'Annual' ? selected.annualPrice : selected.price) : 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || amount <= 0) {
      setError('Choose a paid plan before continuing to checkout.');
      return;
    }
    setBusy(true);
    setError('');
    const payload: CheckoutRegistrationData = {
      company: { name: form.companyName.trim(), email: form.companyEmail.trim() || undefined },
      admin: { name: form.adminName.trim(), email: form.adminEmail.trim(), password: form.password },
      plan: selected.type,
      billingCycle: form.billingCycle,
    };
    try {
      const result = await onboardingApi.checkout(payload);
      const order = result.data;
      await openPaymentCheckout({
        keyId: order.keyId,
        amount: order.amount,
        currency: order.currency,
        orderId: order.orderId,
        description: `${selected.name} ${form.billingCycle} plan`,
      });
      navigate(`/register/complete?registration=${encodeURIComponent(order.registrationId)}`);
    } catch (reason) {
      setError(extractError(reason, 'Could not complete registration checkout.'));
      setBusy(false);
    }
  };

  return <main className="register-shell">
    <aside className="register-story">
      <Link to="/login" className="register-brand"><span>V</span>VOOK</Link>
      <div>
        <div className="register-kicker"><Sparkles size={13} /> WORKFORCE OPERATIONS</div>
        <h1>Set up the company around how work actually flows.</h1>
        <p>Create your company account with a secure online subscription purchase. Access starts after payment and email verification.</p>
      </div>
      <ol>
        <li><span>1</span><div><strong>Choose a paid plan</strong><small>Select monthly or annual billing.</small></div></li>
        <li><span>2</span><div><strong>Complete Razorpay checkout</strong><small>Your company is provisioned after payment confirmation.</small></div></li>
        <li><span>3</span><div><strong>Verify your email</strong><small>Then complete your profile and first branch.</small></div></li>
      </ol>
    </aside>
    <section className="register-form-wrap">
      <div className="register-top">Already registered? <Link to="/login">Sign in</Link></div>
      <div className="register-card">
        <header><h2>Create your company account</h2><p>Choose a plan and pay securely online to activate your account.</p></header>
        {error && <div className="form-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <fieldset>
            <legend>Company</legend>
            <div className="form-grid">
              <label className="admin-label">Company name<input className="admin-input" required value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></label>
              <label className="admin-label">Company email<input className="admin-input" type="email" value={form.companyEmail} onChange={(event) => setForm({ ...form, companyEmail: event.target.value })} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Administrator</legend>
            <div className="form-grid">
              <label className="admin-label">Full name<input className="admin-input" required value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} /></label>
              <label className="admin-label">Work email<input className="admin-input" required type="email" value={form.adminEmail} onChange={(event) => setForm({ ...form, adminEmail: event.target.value })} /></label>
              <label className="admin-label">Create password<input className="admin-input" required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Plan</legend>
            {plans.length === 0 ? <p className="admin-label">No paid plans are available for signup.</p> : <div className="public-plan-grid">{plans.map((plan) => <button type="button" key={plan.id} className={form.plan === plan.type ? 'is-selected' : ''} onClick={() => setForm({ ...form, plan: plan.type })}><strong>{plan.name}</strong><span>₹{(form.billingCycle === 'Annual' ? plan.annualPrice : plan.price).toLocaleString('en-IN')}<small>/{form.billingCycle === 'Annual' ? 'year' : 'month'}</small></span><small>{plan.maxUsers} employees</small></button>)}</div>}
            <div className="cycle-switch" style={{ marginTop: 12 }}>
              <button type="button" className={form.billingCycle === 'Monthly' ? 'is-active' : ''} onClick={() => setForm({ ...form, billingCycle: 'Monthly' })}>Monthly</button>
              <button type="button" className={form.billingCycle === 'Annual' ? 'is-active' : ''} onClick={() => setForm({ ...form, billingCycle: 'Annual' })}>Annual</button>
            </div>
            <p className="admin-label" style={{ marginTop: 12 }}>Checkout is securely processed by Razorpay.</p>
          </fieldset>
          <button className="admin-button register-submit" disabled={busy || !selected || amount <= 0}>
            {busy ? <><Loader2 size={16} /> Preparing checkout…</> : <><CreditCard size={16} /> Continue to secure checkout</>}
          </button>
        </form>
        <footer><span><LockKeyhole size={13} /> Encrypted credentials</span><span><ShieldCheck size={13} /> Verified email</span></footer>
      </div>
    </section>
  </main>;
}
