import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Inbox, Loader2, RefreshCw } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="product-page-header">
    <div>
      {eyebrow && <span className="product-page-header__eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="product-page-header__actions">{actions}</div>}
  </header>;
}

export function StatusBadge({ status, children }: { status: string; children?: ReactNode }) {
  const normalized = status.toUpperCase().replaceAll(' ', '_');
  return <span className="product-status" data-tone={statusTone(normalized)}><span aria-hidden="true" />{children ?? titleCase(status)}</span>;
}

function statusTone(status: string) {
  if (['ACTIVE', 'APPROVED', 'PAID', 'PUBLISHED', 'COMPLETED', 'READY', 'RESOLVED'].includes(status)) return 'success';
  if (['REJECTED', 'FAILED', 'VALIDATION_FAILED', 'SUSPENDED', 'CANCELLED', 'BLOCKER'].includes(status)) return 'danger';
  if (['PENDING', 'UNDER_REVIEW', 'INPUTS_PENDING', 'NOTICE_PERIOD', 'WARNING'].includes(status)) return 'warning';
  return 'neutral';
}

function titleCase(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="product-state" role="status"><Loader2 className="spin" size={22} aria-hidden="true" /><strong>{label}</strong></div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="product-state"><Inbox size={24} aria-hidden="true" /><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function ErrorState({ title = 'Something went wrong', description, onRetry }: { title?: string; description: string; onRetry?: () => void }) {
  return <div className="product-state product-state--error" role="alert"><AlertCircle size={24} aria-hidden="true" /><strong>{title}</strong><p>{description}</p>{onRetry && <button className="admin-button admin-button--secondary" onClick={onRetry}><RefreshCw size={15} aria-hidden="true" /> Retry</button>}</div>;
}

export function ValidationSummary({ title = 'Check the highlighted fields', errors }: { title?: string; errors: Array<{ field: string; message: string }> }) {
  if (!errors.length) return null;
  return <div className="validation-summary" role="alert" tabIndex={-1}>
    <div><AlertCircle size={18} aria-hidden="true" /><strong>{title}</strong></div>
    <ul>{errors.map((error) => <li key={`${error.field}-${error.message}`}><a href={`#${error.field}`}>{error.message}</a></li>)}</ul>
  </div>;
}

export function CompletionMeter({ value, label }: { value: number; label: string }) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  return <div className="completion-meter">
    <div><span>{label}</span><strong>{safe}%</strong></div>
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safe}><span style={{ width: `${safe}%` }} /></div>
  </div>;
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return <div className="product-notice product-notice--success" role="status"><CheckCircle2 size={17} aria-hidden="true" />{children}</div>;
}
