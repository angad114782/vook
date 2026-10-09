import type { CSSProperties } from 'react';

/**
 * YouTube/Instagram-style placeholders: grey blocks shaped like the real content with a soft shimmer.
 * Show them whenever data is slow to arrive so the page keeps its shape instead of jumping or showing a spinner.
 */

interface SkeletonProps { w?: number | string; h?: number | string; radius?: number | string; circle?: boolean; style?: CSSProperties; className?: string }

export function Skeleton({ w = '100%', h = 14, radius = 6, circle, style, className = '' }: SkeletonProps) {
  return <span aria-hidden="true" className={`sk ${className}`} style={{ width: w, height: h, borderRadius: circle ? '50%' : radius, ...style }} />;
}

/** Wrapper that tells screen readers "loading" once, instead of reading every placeholder. */
function Region({ label, children, style }: { label: string; children: React.ReactNode; style?: CSSProperties }) {
  return <div role="status" aria-busy="true" aria-live="polite" aria-label={label} style={style}>{children}<span className="sk-sr">{label}</span></div>;
}

export function TextSkeleton({ lines = 3, label = 'Loading' }: { lines?: number; label?: string }) {
  return <Region label={label} style={{ display: 'grid', gap: 10 }}>{Array.from({ length: lines }, (_, i) => <Skeleton key={i} w={i === lines - 1 ? '60%' : '100%'} />)}</Region>;
}

export function ListSkeleton({ rows = 6, label = 'Loading list' }: { rows?: number; label?: string }) {
  return (
    <Region label={label} style={{ display: 'grid', gap: 16, padding: 16 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton w={38} h={38} circle />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}><Skeleton w={`${55 + (i % 3) * 12}%`} h={13} /><Skeleton w={`${30 + (i % 4) * 8}%`} h={10} /></div>
          <Skeleton w={64} h={22} radius={11} />
        </div>
      ))}
    </Region>
  );
}

export function TableSkeleton({ rows = 7, cols = 5, label = 'Loading table' }: { rows?: number; cols?: number; label?: string }) {
  return (
    <Region label={label} style={{ padding: '4px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
        {Array.from({ length: cols }, (_, c) => <Skeleton key={c} w="50%" h={10} />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16, alignItems: 'center', padding: '14px 18px', borderBottom: r < rows - 1 ? '1px solid #f8fafc' : 0 }}>
          {Array.from({ length: cols }, (_, c) => c === 0
            ? <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Skeleton w={34} h={34} circle /><div style={{ flex: 1, display: 'grid', gap: 6 }}><Skeleton w="70%" h={12} /><Skeleton w="40%" h={9} /></div></div>
            : <Skeleton key={c} w={`${45 + ((r + c) % 4) * 12}%`} h={12} />)}
        </div>
      ))}
    </Region>
  );
}

export function CardGridSkeleton({ count = 4, label = 'Loading summary' }: { count?: number; label?: string }) {
  return (
    <Region label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sk-card" style={{ display: 'grid', gap: 12 }}><Skeleton w="45%" h={11} /><Skeleton w="35%" h={26} radius={8} /><Skeleton w="60%" h={10} /></div>
      ))}
    </Region>
  );
}

export function FormSkeleton({ fields = 5, label = 'Loading form' }: { fields?: number; label?: string }) {
  return (
    <Region label={label} style={{ display: 'grid', gap: 18, padding: 18 }}>
      {Array.from({ length: fields }, (_, i) => <div key={i} style={{ display: 'grid', gap: 7 }}><Skeleton w={110} h={10} /><Skeleton h={38} radius={8} /></div>)}
      <Skeleton w={130} h={38} radius={9} />
    </Region>
  );
}

/** Whole-page placeholder: title, summary cards and a table. Used while a page or its main data loads. */
export function PageSkeleton({ cards = 4, rows = 6, label = 'Loading page' }: { cards?: number; rows?: number; label?: string }) {
  return (
    <Region label={label} style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gap: 8 }}><Skeleton w={220} h={22} radius={8} /><Skeleton w={340} h={12} /></div>
      {cards > 0 && <CardGridSkeleton count={cards} label={label} />}
      <div className="sk-card" style={{ padding: 0 }}><TableSkeleton rows={rows} label={label} /></div>
    </Region>
  );
}

export function DashboardSkeleton({ label = 'Loading dashboard' }: { label?: string }) {
  return (
    <Region label={label} style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gap: 8 }}><Skeleton w={260} h={24} radius={8} /><Skeleton w={380} h={12} /></div>
      <CardGridSkeleton count={4} label={label} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="sk-card" style={{ display: 'grid', gap: 12 }}><Skeleton w="35%" h={14} /><Skeleton h={180} radius={10} /></div>
        <div className="sk-card" style={{ padding: 0 }}><ListSkeleton rows={4} label={label} /></div>
      </div>
    </Region>
  );
}
