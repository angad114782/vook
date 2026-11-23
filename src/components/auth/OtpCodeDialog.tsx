import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import AppDialog from '../ui/AppDialog';

const LENGTH = 6;

interface OtpCodeDialogProps {
  open: boolean;
  /** Number the code was sent to, shown so people can spot a typo. */
  mobile: string;
  /** Seconds before "Resend" works (restarts every time `sentAt` changes). */
  resendAfterSeconds?: number;
  sentAt: number;
  /** Shown on development servers where no real message is sent. */
  devCode?: string;
  /** Throws a readable Error when the code is wrong. Resolves when verified. */
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onClose: () => void;
}

/** Six boxes for a one-time code. Fills from typing or paste, and submits by itself on the last digit. */
export default function OtpCodeDialog({ open, mobile, resendAfterSeconds = 30, sentAt, devCode, onVerify, onResend, onClose }: OtpCodeDialogProps) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(resendAfterSeconds);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const reset = useCallback(() => {
    setDigits(Array(LENGTH).fill(''));
    window.setTimeout(() => refs.current[0]?.focus(), 30);
  }, []);

  useEffect(() => { if (open) { setError(''); reset(); } }, [open, sentAt, reset]);
  useEffect(() => { if (open) setWait(resendAfterSeconds); }, [open, sentAt, resendAfterSeconds]);
  useEffect(() => {
    if (!open || wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [open, wait]);

  const submit = async (code: string) => {
    setBusy(true);
    setError('');
    try {
      await onVerify(code);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That code is not correct. Please try again.');
      reset();
    } finally {
      setBusy(false);
    }
  };

  const update = (next: string[]) => {
    setDigits(next);
    if (error) setError('');
    const code = next.join('');
    if (code.length === LENGTH && next.every(Boolean)) void submit(code);
  };

  const onChange = (index: number, value: string) => {
    const typed = value.replace(/\D/g, '');
    if (!typed) { update(digits.map((d, i) => (i === index ? '' : d))); return; }
    // A paste (or an autofill) arrives as several digits at once: spread them across the boxes.
    const next = [...digits];
    typed.slice(0, LENGTH - index).split('').forEach((digit, offset) => { next[index + offset] = digit; });
    const focusAt = Math.min(index + typed.length, LENGTH - 1);
    refs.current[focusAt]?.focus();
    update(next);
  };

  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) { refs.current[index - 1]?.focus(); }
    if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const resend = async () => {
    setError('');
    try { await onResend(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send a new code.'); }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => { if (!next && !busy) onClose(); }}
      title="Verify your mobile number"
      description={<>Enter the 6-digit code we sent to <strong>{mobile}</strong>.</>}
      className="otp-dialog"
    >
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center', padding: '4px 0 8px' }}>
        <div style={{ display: 'flex', gap: 10 }} role="group" aria-label="One-time code">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(node) => { refs.current[index] = node; }}
              value={digit}
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              aria-label={`Digit ${index + 1}`}
              disabled={busy}
              maxLength={LENGTH}
              onChange={(event) => onChange(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(index, event)}
              onFocus={(event) => event.target.select()}
              style={{
                width: 46, height: 54, textAlign: 'center', fontSize: 22, fontWeight: 700, color: '#0f172a',
                border: `1.5px solid ${error ? '#fca5a5' : digit ? '#0d7470' : '#cbd5e1'}`, borderRadius: 10, outline: 'none', background: 'white',
              }}
            />
          ))}
        </div>
        <div style={{ minHeight: 20, fontSize: 13, textAlign: 'center' }} aria-live="polite">
          {busy ? <span style={{ color: '#0d7470', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Loader2 size={14} className="spin" /> Verifying…</span>
            : error ? <span role="alert" style={{ color: '#b91c1c' }}>{error}</span>
            : devCode ? <span style={{ color: '#64748b' }}>Development server: your code is <strong>{devCode}</strong></span>
            : <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={14} /> It submits by itself when all 6 digits are in.</span>}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 13 }}>
          <button type="button" disabled={busy || wait > 0} onClick={() => void resend()} style={{ border: 0, background: 'none', color: wait > 0 ? '#94a3b8' : '#0d7470', fontWeight: 700, cursor: wait > 0 || busy ? 'default' : 'pointer' }}>
            {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
          </button>
          <button type="button" disabled={busy} onClick={onClose} style={{ border: 0, background: 'none', color: '#475569', cursor: 'pointer' }}>Change number</button>
        </div>
      </div>
    </AppDialog>
  );
}
