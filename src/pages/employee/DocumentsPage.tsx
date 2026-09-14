import { useState } from 'react';
import { employeeApi, type MyDocument } from '../../api/employee';
import type { Pagination } from '../../api/hr';
import { Loader2, FileText, Download, Eye, Search } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { useMyDocuments } from '../../hooks/queries/useEmployeeQueries';

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  Policy:    { bg: '#dbeafe', color: '#1d4ed8' },
  HR:        { bg: '#f0fdf4', color: '#15803d' },
  Finance:   { bg: '#fef9c3', color: '#854d0e' },
  General:   { bg: '#f1f5f9', color: '#475569' },
  Offer:     { bg: '#f5f3ff', color: '#6d28d9' },
  Compliance:{ bg: '#fff7ed', color: '#c2410c' },
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const LIMIT = 20;

export default function DocumentsPage() {
  const [search,    setSearch]    = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [page,      setPage]      = useState(1);

  const debouncedSearch = useDebouncedValue(search, 500);

  const docParams: Record<string, string> = { page: String(page), limit: String(LIMIT) };
  if (debouncedSearch) docParams.search = debouncedSearch;
  if (catFilter !== 'All') docParams.category = catFilter;

  const { data, isLoading: loading } = useMyDocuments(docParams);
  const docs       = ((data as { documents?: MyDocument[] } | undefined)?.documents   ?? []) as MyDocument[];
  const pagination = ((data as { pagination?: Pagination } | undefined)?.pagination   ?? { total: 0, page: 1, limit: LIMIT, totalPages: 1 }) as Pagination;

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleCatChange    = (v: string) => { setCatFilter(v); setPage(1); };
  const openDocument = async (doc: MyDocument, download = false) => {
    if (!doc.fileUrl) return;
    const { data } = await employeeApi.downloadDocument(doc.fileUrl);
    const url = URL.createObjectURL(data);
    if (download) {
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = doc.name; anchor.click();
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const CATS = ['All', 'Policy', 'HR', 'Finance', 'General', 'Offer', 'Compliance'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Documents</h1>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Company policies, HR documents, and other resources</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '280px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search documents..." style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {CATS.map((c) => (
              <button key={c} onClick={() => handleCatChange(c)} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: catFilter === c ? '#0d7470' : '#f1f5f9', color: catFilter === c ? 'white' : '#64748b', transition: 'all 0.15s' }}>{c}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} color="#0d7470" /></div>
        ) : docs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
            {pagination.total === 0 ? 'No documents available yet.' : 'No documents match your search.'}
          </div>
        ) : (
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {docs.map((d) => {
              const cm = CAT_COLORS[d.category] ?? CAT_COLORS['General']!;
              return (
                <div key={d.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: cm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={16} color={cm.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <span style={{ padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, backgroundColor: cm.bg, color: cm.color }}>{d.category}</span>
                        {d.version && <span style={{ fontSize: '10px', color: '#94a3b8' }}>v{d.version}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '10px', color: '#94a3b8' }}>{fmtDate(d.createdAt)}</p>
                      {d.fileSize && <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{d.fileSize}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => void openDocument(d)} disabled={!d.fileUrl} title={d.fileUrl ? 'View document' : 'No file available'} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: d.fileUrl ? 'pointer' : 'not-allowed', color: '#64748b', opacity: d.fileUrl ? 1 : 0.5 }}><Eye size={12} /></button>
                      <button onClick={() => void openDocument(d, true)} disabled={!d.fileUrl} title={d.fileUrl ? 'Download document' : 'No file available'} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: d.fileUrl ? '#0d7470' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: d.fileUrl ? 'pointer' : 'not-allowed', opacity: d.fileUrl ? 1 : 0.5 }}><Download size={12} color={d.fileUrl ? 'white' : '#94a3b8'} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={LIMIT} onPageChange={(p) => setPage(p)} />
    </div>
  );
}
