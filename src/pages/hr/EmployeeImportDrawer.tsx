import { useRef, useState } from 'react';
import { Download, FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AppDrawer from '../../components/ui/AppDrawer';
import { useImportEmployees, type EmployeeImportResult } from '../../hooks/mutations/useHrMutations';
import { extractError } from '../../utils/errorUtils';
import { EMPLOYEE_CSV_TEMPLATE, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, validateEmployeeCsv, type EmployeeCsvResult } from '../../utils/employeeCsv';

const PREVIEW_ROWS = 5;
const cell: React.CSSProperties = { padding: '6px 10px', fontSize: '12px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', textAlign: 'left' };

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([EMPLOYEE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: 'employee-import-sample.csv' });
  link.click();
  URL.revokeObjectURL(url);
}

export default function EmployeeImportDrawer({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<EmployeeCsvResult | null>(null);
  const [result, setResult] = useState<EmployeeImportResult | null>(null);
  const [error, setError] = useState('');
  const importEmployees = useImportEmployees();
  const busy = importEmployees.isPending;

  const handleFile = async (file?: File) => {
    setResult(null); setError('');
    if (!file) return;
    setFileName(file.name);
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') { setParsed({ rows: [], issues: [], fileError: 'Please choose a CSV file. In Excel use File → Save as → CSV.' }); return; }
    if (file.size > MAX_IMPORT_BYTES) { setParsed({ rows: [], issues: [], fileError: 'This file is too big (over 1 MB). Please split it into smaller files.' }); return; }
    setParsed(validateEmployeeCsv(await file.text()));
  };

  const submit = () => {
    if (!parsed?.rows.length) return;
    setError('');
    importEmployees.mutate(parsed.rows, {
      onSuccess: (data) => {
        setResult(data);
        if (data.imported) toast.success(`${data.imported} employee${data.imported === 1 ? '' : 's'} added`);
      },
      onError: (err) => setError(extractError(err, 'Import did not work. Please try again.')),
    });
  };

  const allIssues = result ? result.errors.map((e) => ({ row: e.row, message: e.message })) : parsed?.issues ?? [];
  const ready = !result && !!parsed && !parsed.fileError && parsed.rows.length > 0;

  return (
    <AppDrawer open onOpenChange={(open) => { if (!open && !busy) onClose(); }} placement="responsive" size="lg" title="Import employees" description="Add many employees at once from an Excel or Google Sheets file" footer={<>
      <button type="button" className="admin-button admin-button--secondary" onClick={onClose} disabled={busy}>{result ? 'Done' : 'Cancel'}</button>
      {!result && <button type="button" className="admin-button" onClick={submit} disabled={!ready || busy}>
        {busy && <Loader2 size={14} className="employee-form-drawer__spinner" aria-hidden="true" />}
        {ready ? `Add ${parsed.rows.length} employee${parsed.rows.length === 1 ? '' : 's'}` : 'Add employees'}
      </button>}
    </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#475569', lineHeight: 1.7 }}>
          <li>Download the sample file and fill in one employee per row.</li>
          <li>In Excel or Google Sheets choose <strong>File → Save as → CSV</strong>.</li>
          <li>Upload the saved file here. We will show you a preview before anything is added.</li>
        </ol>
        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
          Full Name and Mobile Number are required. Everything else is optional. You can add up to {MAX_IMPORT_ROWS} employees at a time.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="admin-button admin-button--secondary" onClick={downloadTemplate}><Download size={14} aria-hidden /> Download sample file</button>
          <button type="button" className="admin-button" onClick={() => inputRef.current?.click()} disabled={busy}><FileUp size={14} aria-hidden /> {fileName ? 'Choose a different file' : 'Choose file'}</button>
          <input ref={inputRef} type="file" accept=".csv,text/csv" hidden aria-label="Choose CSV file" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {fileName && <p style={{ fontSize: '12px', color: '#64748b' }}>{fileName}</p>}

        {error && <div role="alert" style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '13px' }}>{error}</div>}
        {parsed?.fileError && <div role="alert" style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '13px' }}>{parsed.fileError}</div>}

        {result && <div role="status" style={{ padding: '10px', borderRadius: '8px', backgroundColor: result.imported ? '#ecfdf3' : '#fffbeb', color: result.imported ? '#166534' : '#92400e', fontSize: '13px' }}>
          <strong>{result.imported}</strong> employee{result.imported === 1 ? '' : 's'} added{result.failed > 0 && <>, <strong>{result.failed}</strong> skipped (see below)</>}.
        </div>}

        {!result && parsed && !parsed.fileError && <div style={{ fontSize: '13px', color: '#0f172a' }}>
          <strong>{parsed.rows.length}</strong> employee{parsed.rows.length === 1 ? '' : 's'} ready to add{parsed.issues.length > 0 && <>. <strong style={{ color: '#b91c1c' }}>{parsed.issues.length}</strong> row{parsed.issues.length === 1 ? ' needs' : 's need'} fixing and will be skipped unless you correct the file</>}
        </div>}

        {!result && parsed && parsed.rows.length > 0 && <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ backgroundColor: '#f8fafc' }}>{['Name', 'Mobile', 'Email', 'Department', 'Designation'].map((h) => <th key={h} style={{ ...cell, fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>{parsed.rows.slice(0, PREVIEW_ROWS).map((r, i) => <tr key={i}><td style={cell}>{r.name}</td><td style={cell}>{r.mobile}</td><td style={cell}>{r.email || '—'}</td><td style={cell}>{r.department || '—'}</td><td style={cell}>{r.designation || '—'}</td></tr>)}</tbody>
          </table>
          {parsed.rows.length > PREVIEW_ROWS && <p style={{ padding: '6px 10px', fontSize: '12px', color: '#64748b' }}>+ {parsed.rows.length - PREVIEW_ROWS} more</p>}
        </div>}

        {allIssues.length > 0 && <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>{result ? 'Skipped rows' : 'Rows to fix'}</p>
          <ul style={{ maxHeight: '220px', overflowY: 'auto', margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#b91c1c', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {allIssues.map((i) => <li key={`${i.row}-${i.message}`}>Row {i.row} — {i.message}</li>)}
          </ul>
        </div>}
      </div>
    </AppDrawer>
  );
}
