import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, FileText, Search, UserRound, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { searchApi, type SearchResult, type GlobalSearchResponse } from '../../api/search';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const groups: Array<{ key: keyof Omit<GlobalSearchResponse, 'query'>; label: string; icon: typeof Building2 }> = [
  { key: 'companies', label: 'Companies', icon: Building2 },
  { key: 'employees', label: 'Employees', icon: UserRound },
  { key: 'users', label: 'Users', icon: UserRound },
  { key: 'documents', label: 'Documents', icon: FileText },
];

export default function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [value, setValue] = useState('');
  const [data, setData] = useState<GlobalSearchResponse | null>(null);
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(value.trim().replace(/\s+/g, ' '), 500);
  const inputRef = useRef<HTMLInputElement>(null);
  const flat = useMemo(() => groups.flatMap((g) => (data?.[g.key] ?? [])), [data]);

  useEffect(() => {
    const q = debounced.slice(0, 100);
    if (q.length < 2) { setData(null); setActive(0); return; }
    const controller = new AbortController();
    searchApi.global(q, controller.signal).then((r) => { setData(r.data); setActive(0); }).catch((err) => {
      if (err?.code !== 'ERR_CANCELED' && err?.name !== 'CanceledError') setData(null);
    });
    return () => controller.abort();
  }, [debounced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); }
      if (!data || flat.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % flat.length); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + flat.length) % flat.length); }
      if (e.key === 'Enter') { e.preventDefault(); select(flat[active]); }
      if (e.key === 'Escape') { setValue(''); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const select = (item?: SearchResult) => {
    if (!item) return;
    if (item.type === 'company') navigate(`/companies?search=${encodeURIComponent(item.companyCode ?? item.name)}`);
    else if (item.type === 'employee') {
      const path = user?.role === 'COMPANY_ADMIN' ? '/company-admin/workforce' : user?.role === 'MANAGER' ? '/manager/workforce' : user?.role === 'SUPERVISOR' ? '/supervisor/workforce' : user?.role === 'FINANCE' ? '/finance/payslips' : '/hr/employees';
      navigate(`${path}?search=${encodeURIComponent(item.employeeId ?? item.name)}`);
    }
    else if (item.type === 'document') {
      const path = user?.role === 'EMPLOYEE' ? '/employee/documents' : user?.role === 'COMPANY_ADMIN' ? '/company-admin/workforce' : '/hr/document-policies';
      navigate(`${path}?search=${encodeURIComponent(item.name)}`);
    }
    else navigate(user?.role === 'COMPANY_ADMIN' ? '/company-admin/users' : location.pathname);
    setValue(''); setData(null);
  };

  const count = flat.length;
  return <div style={{ position: 'relative', width: '280px' }}>
    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
    <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search people, companies, IDs..." aria-label="Global search" style={{ width: '100%', padding: '8px 32px 8px 36px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#0f172a', outline: 'none', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }} />
    {value && <button onClick={() => { setValue(''); setData(null); }} aria-label="Clear search" style={{ position: 'absolute', right: 8, top: 7, border: 0, background: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={14} /></button>}
    {data && <div role="listbox" style={{ position: 'absolute', top: 44, left: 0, width: 360, maxHeight: 420, overflowY: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 12px 30px rgba(15,23,42,.14)', zIndex: 100 }}>
      {count === 0 ? <p style={{ padding: 16, fontSize: 12, color: '#64748b' }}>No matching records.</p> : groups.map((g) => data[g.key].length > 0 && <div key={g.key}><p style={{ padding: '10px 12px 5px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{g.label}</p>{data[g.key].map((item) => { const index = flat.indexOf(item); const Icon = g.icon; return <button key={`${item.type}-${item.id}`} role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => select(item)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', border: 0, background: index === active ? '#f0fdfa' : 'white', textAlign: 'left', cursor: 'pointer' }}><Icon size={15} color="#0d7470" /><span style={{ minWidth: 0, flex: 1 }}><span style={{ display: 'block', fontSize: 12, color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span><span style={{ display: 'block', fontSize: 10, color: '#64748b' }}>{item.companyCode ?? item.employeeId ?? item.subtitle}</span></span></button>; })}</div>)}
    </div>}
  </div>;
}
