import { MoreHorizontal } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions, className = '', ...props }: PageHeaderProps) {
  return <header className={`responsive-page-header ${className}`} {...props}><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="responsive-page-header__actions">{actions}</div>}</header>;
}

export function MetricGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`responsive-metric-grid ${className}`}>{children}</div>;
}

export function FormGrid({ children, columns = 2, className = '' }: { children: ReactNode; columns?: 1 | 2 | 3; className?: string }) {
  return <div className={`responsive-form-grid responsive-form-grid--${columns} ${className}`}>{children}</div>;
}

export function ActionMenu({ label = 'More actions', children }: { label?: string; children: ReactNode }) {
  return <details className="responsive-action-menu"><summary aria-label={label}><MoreHorizontal size={18} aria-hidden /></summary><div>{children}</div></details>;
}
