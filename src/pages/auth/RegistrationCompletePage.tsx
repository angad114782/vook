import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { onboardingApi } from '../../api/onboarding';
import { isMockMode } from '../../config/runtime';

export default function RegistrationCompletePage() {
  const [params] = useSearchParams();
  const registrationId = params.get('registration');
  const [status, setStatus] = useState('Confirming your payment…');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!registrationId) {
      setStatus('Payment reference missing. Please contact support.');
      return false;
    }
    try {
      const response = await onboardingApi.status(registrationId);
      if (response.data.status === 'PAID') {
        setStatus('Payment confirmed. Check your inbox to verify your email, then sign in.');
        return true;
      }
      if (response.data.status === 'FAILED') {
        setStatus('Payment failed. Please try registering again.');
        return true;
      }
    } catch {
      // Keep polling while the checkout result is being confirmed.
    }
    return false;
  }, [registrationId]);

  useEffect(() => {
    if (!registrationId) {
      setStatus('Payment reference missing. Please contact support.');
      return;
    }
    let active = true;
    let timer: number | undefined;
    const poll = async () => {
      const done = await checkStatus();
      if (active && !done) timer = window.setTimeout(poll, 2500);
    };
    void poll();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [checkStatus, registrationId]);

  const resend = async () => {
    if (!registrationId) return;
    setResending(true);
    try {
      await onboardingApi.resendVerification(registrationId);
      setResent(true);
    } catch {
      setStatus('Could not send the email. Contact support or try again.');
    } finally {
      setResending(false);
    }
  };

  const paid = status.startsWith('Payment confirmed');
  const failed = status.startsWith('Payment failed');

  return <main className="registration-result"><div>
    {paid ? <CheckCircle2 size={30} /> : failed ? <CheckCircle2 size={30} /> : <Loader2 size={30} className="spin" />}
    <h1>{paid ? 'Verify your email' : failed ? 'Payment could not be confirmed' : 'Confirming your payment'}</h1>
    <p>{status}</p>
    {isMockMode && paid && registrationId && <Link className="admin-button" to={`/verify-email?token=${encodeURIComponent(registrationId)}`}>Verify demo email</Link>}
    {paid && <button className="admin-button" onClick={resend} disabled={resending || resent}>{resent ? 'Verification email sent' : resending ? 'Sending…' : 'Resend verification email'}</button>}
    {failed && <Link className="admin-button" to="/register">Try registration again</Link>}
    <Link to="/login">Back to sign in</Link>
  </div></main>;
}
