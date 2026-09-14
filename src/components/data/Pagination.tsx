interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
}

export default function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50],
}: PaginationProps) {
  if (totalPages <= 1 && total <= limit) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  const btn = (label: string | number, active: boolean, disabled: boolean, onClick: () => void) => (
    <button
      key={String(label)}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        fontSize: 13,
        border: '1px solid',
        borderColor: active ? '#0d7470' : '#e2e8f0',
        background: active ? '#0d7470' : 'white',
        color: active ? 'white' : disabled ? '#94a3b8' : '#374151',
        borderRadius: 6,
        cursor: disabled ? 'default' : 'pointer',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#64748b' }}>
        Showing {from}–{to} of {total} results
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {onLimitChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Rows:</span>
            <select
              value={limit}
              onChange={(e) => { onLimitChange(parseInt(e.target.value)); onPageChange(1); }}
              style={{ fontSize: 13, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6 }}
            >
              {limitOptions.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}
        {btn('‹', false, page === 1, () => onPageChange(page - 1))}
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`ellipsis-${i}`} style={{ padding: '4px 6px', color: '#94a3b8' }}>…</span>
            : btn(p, p === page, false, () => onPageChange(p as number))
        )}
        {btn('›', false, page >= totalPages, () => onPageChange(page + 1))}
      </div>
    </div>
  );
}
