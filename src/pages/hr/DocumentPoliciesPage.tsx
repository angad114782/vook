import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { hrApi, type Document } from '../../api/hr';
import { Search, Upload, Plus, Eye, Download, Edit2, Trash2, Loader2, X, ChevronDown } from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PaginationBar from '../../components/data/Pagination';
import { extractError } from '../../utils/errorUtils';
import { useDocuments } from '../../hooks/queries/useHrQueries';
import { useCreateDocument, useDeleteDocument } from '../../hooks/mutations/useHrMutations';

const CATEGORIES = ['Safety', 'HR Policy', 'Compliance', 'IT Policy', 'Finance'];
const CAT_COLOR: Record<string, { bg: string; color: string }> = {
  Safety:    { bg: '#fef2f2', color: '#b91c1c' },
  'HR Policy':{ bg: '#dbeafe', color: '#1d4ed8' },
  Compliance:{ bg: '#ede9fe', color: '#6d28d9' },
  'IT Policy':{ bg: '#dcfce7', color: '#15803d' },
  Finance:   { bg: '#fff7ed', color: '#c2410c' },
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function CreateDocModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: '', category: '', version: 'v1.0', visibility: 'All Employees' });
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const createDocument = useCreateDocument();

  const handleSubmit = () => {
    if (!form.name || !form.category) { setError('Name and category are required'); return; }
    if (!file) { setError('Please select a file to upload'); return; }
    setError('');
    createDocument.mutate({ file, ...form }, {
      onSuccess: () => { toast.success('Document created successfully'); onClose(); },
      onError: (err) => setError(extractError(err, 'Failed to upload or create document')),
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      if (!form.name) {
        const baseName = e.dataTransfer.files[0].name.replace(/\.[^/.]+$/, '');
        set('name', baseName);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!form.name) {
        const baseName = e.target.files[0].name.replace(/\.[^/.]+$/, '');
        set('name', baseName);
      }
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#0f172a' };
  const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' };
  const loading = createDocument.isPending;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Create Policy</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '13px' }}>{error}</div>}

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '24px 20px', textAlign: 'center', backgroundColor: '#f8fafc', cursor: 'pointer', outline: 'none' }}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.csv" />
            {file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ padding: '8px', backgroundColor: '#e6f4f2', borderRadius: '8px', color: '#0d7470', marginBottom: '8px', fontWeight: 600, fontSize: '12px' }}>{file.name.split('.').pop()?.toUpperCase() || 'FILE'}</div>
                <p style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600, wordBreak: 'break-all', padding: '0 10px' }}>{file.name}</p>
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} style={{ marginTop: '12px', fontSize: '11px', color: '#b91c1c', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>Remove file</button>
              </div>
            ) : (
              <>
                <Upload size={24} color="#0d7470" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>Click or Drag file to upload</p>
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>PDF, PNG, JPG, DOCX, XLSX up to 10MB</p>
              </>
            )}
          </div>

          <div><label style={labelStyle}>Document Name *</label><input value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} /></div>
          <div>
            <label style={labelStyle}>Category *</label>
            <div style={{ position: 'relative' }}>
              <select value={form.category} onChange={(e) => set('category', e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: '28px' }}>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={labelStyle}>Version</label><input value={form.version} onChange={(e) => set('version', e.target.value)} style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Visibility</label>
              <div style={{ position: 'relative' }}>
                <select value={form.visibility} onChange={(e) => set('visibility', e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: '28px' }}>
                  <option value="All Employees">All Employees</option>
                  <option value="Management">Management</option>
                  <option value="HR Only">HR Only</option>
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', backgroundColor: '#0d7470', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />} Create Policy
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentPoliciesPage() {
  const [search,         setSearch]         = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showCreate,     setShowCreate]     = useState(false);
  const [page,           setPage]           = useState(1);
  const limit = 20;

  const debouncedSearch = useDebouncedValue(search, 500);

  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (debouncedSearch) params.search = debouncedSearch;
  if (categoryFilter !== 'ALL') params.category = categoryFilter;

  const { data, isLoading: loading } = useDocuments(params);
  const docs: Document[] = data?.documents ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const deleteDocument = useDeleteDocument();

  const handleSearchChange   = (v: string) => { setSearch(v); setPage(1); };
  const handleCategoryChange = (v: string) => { setCategoryFilter(v); setPage(1); };
  const openDocument = async (doc: Document, download = false) => {
    if (!doc.fileUrl) return;
    const { data } = await hrApi.downloadDocument(doc.fileUrl);
    const url = URL.createObjectURL(data);
    if (download) {
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = doc.name; anchor.click();
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleDelete = (id: string) => {
    deleteDocument.mutate(id, {
      onSuccess: () => toast.success('Document deleted'),
      onError: (err) => toast.error(extractError(err, 'Failed to delete document')),
    });
  };

  const selectStyle: React.CSSProperties = { padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#374151', backgroundColor: 'white', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Document & Policies</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Manage company documents, policies, and compliance files</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: '1.5px solid #e2e8f0', borderRadius: '9px', backgroundColor: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            <Upload size={14} /> Upload Document
          </button>
          <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: '#0d7470', border: 'none', borderRadius: '9px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            <Plus size={14} /> Create Policy
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search documents..." style={{ width: '100%', paddingLeft: '34px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: '#f8fafc' }} />
          </div>
          <select value={categoryFilter} onChange={(e) => handleCategoryChange(e.target.value)} style={selectStyle}>
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select style={selectStyle}><option>All Visibility</option><option>All Employees</option><option>Management</option></select>
          <button onClick={() => { setSearch(''); handleCategoryChange('ALL'); }} style={{ padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px', color: '#374151', fontFamily: 'Inter, sans-serif' }}>Clear Filters</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', gap: '10px', color: '#64748b' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span style={{ fontSize: '14px' }}>Loading...</span></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Document Name', 'Category', 'Uploaded By', 'Upload Date', 'Visibility', 'Action'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 18px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((d, i) => {
                  const cc = CAT_COLOR[d.category] ?? { bg: '#f1f5f9', color: '#475569' };
                  const fileExt = d.fileUrl ? d.fileUrl.split('.').pop()?.toUpperCase() : 'PDF';
                  return (
                    <tr key={d.id} style={{ borderBottom: i < docs.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <td style={{ padding: '13px 18px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{d.name}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8' }}>{fileExt} • {d.fileSize ?? '—'} • {d.version ?? '—'}</p>
                      </td>
                      <td style={{ padding: '13px 18px' }}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: cc.bg, color: cc.color }}>{d.category}</span></td>
                      <td style={{ padding: '13px 18px' }}><span style={{ fontSize: '13px', color: '#374151' }}>{d.uploadedBy}</span></td>
                      <td style={{ padding: '13px 18px' }}><span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(d.createdAt)}</span></td>
                      <td style={{ padding: '13px 18px' }}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, backgroundColor: '#dbeafe', color: '#1d4ed8' }}>{d.visibility}</span></td>
                      <td style={{ padding: '13px 18px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => void openDocument(d)} disabled={!d.fileUrl} style={{ opacity: d.fileUrl ? 1 : 0.4, width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: d.fileUrl ? 'pointer' : 'not-allowed', color: '#64748b' }} title="View document"><Eye size={13} /></button>
                          <button onClick={() => void openDocument(d, true)} disabled={!d.fileUrl} style={{ opacity: d.fileUrl ? 1 : 0.4, width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: d.fileUrl ? 'pointer' : 'not-allowed', color: '#64748b' }} title="Download document"><Download size={13} /></button>
                          <button style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'not-allowed', opacity: 0.4, color: '#64748b' }}><Edit2 size={13} /></button>
                          <button onClick={() => handleDelete(d.id)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#b91c1c' }}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {docs.length === 0 && <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>No documents found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaginationBar page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={limit} onPageChange={(p) => setPage(p)} />
      {showCreate && <CreateDocModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
