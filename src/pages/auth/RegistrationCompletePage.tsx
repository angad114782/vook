import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { onboardingApi } from '../../api/onboarding';
export default function RegistrationCompletePage() {
  const [params] = useSearchParams(); const trial = params.get('mode') === 'trial'; const registrationId = params.get('registration');
  const [status, setStatus] = useState(trial ? 'Check your inbox to verify your email and start the trial.' : 'Confirming your payment…');
  const [resending, setResending] = useState(false); const [resent, setResent] = useState(false);
  useEffect(() => {
    if (trial) return; const id = registrationId; if (!id) { setStatus('Payment reference missing.'); return; }
    const timer = window.setInterval(() => onboardingApi.status(id).then((response) => { if (response.data.status === 'PAID') { setStatus('Payment confirmed. Check your inbox to verify your email, then sign in.'); clearInterval(timer); } else if (response.data.status === 'FAILED') { setStatus('Payment failed. Please try registering again.'); clearInterval(timer); } }).catch(() => undefined), 2500);
    return () => clearInterval(timer);
  }, [registrationId, trial]);
  const resend = async () => { const id = params.get('registration'); if (!id) return; setResending(true); try { await onboardingApi.resendVerification(id); setResent(true); } catch { setStatus('Could not send the email. Contact support or try again.'); } finally { setResending(false); } };
  return <main className="registration-result"><div>{trial ? <MailCheck size={30} /> : <CheckCircle2 size={30} />}<h1>{trial ? 'Verify to start your trial' : 'Almost there'}</h1><p>{status}</p>{registrationId && <Link className="admin-button" to={`/verify-email?token=${encodeURIComponent(registrationId)}`}>Verify demo email</Link>}{!trial && status.startsWith('Payment confirmed') && <button className="admin-button" onClick={resend} disabled={resending || resent}>{resent ? 'Verification email sent' : resending ? 'Sending…' : 'Resend verification email'}</button>}<Link to="/login">Back to sign in</Link></div></main>;
}
