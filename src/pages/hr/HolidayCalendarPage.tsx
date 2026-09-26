import { useMemo, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Copy, Download, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { timeOffApi } from '../../api/timeOff';
import AppDialog from '../../components/ui/AppDialog';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, ValidationSummary } from '../../components/ui/ProductPrimitives';
import { extractError } from '../../utils/errorUtils';
import type { HolidayCalendar, HolidayKind } from '../../types/hrms';
import { useAccess } from '../../hooks/queries/useAccess';

const yearOptions = (center: number) => Array.from({ length: 5 }, (_, index) => center - 1 + index);
const indianStates = [
  ['ALL', 'All India'], ['AP', 'Andhra Pradesh'], ['DL', 'Delhi'], ['GJ', 'Gujarat'], ['KA', 'Karnataka'],
  ['KL', 'Kerala'], ['MH', 'Maharashtra'], ['RJ', 'Rajasthan'], ['TN', 'Tamil Nadu'], ['TS', 'Telangana'], ['UP', 'Uttar Pradesh'], ['WB', 'West Bengal'],
];

type HolidayCsvRow = { name: string; date: string; kind: HolidayKind; optional: boolean };

type HolidayCsvResult = { holidays: HolidayCsvRow[]; errors: string[] };

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted value.');
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseHolidayCsv(csv: string, year: number, existingDates: string[]): HolidayCsvResult {
  const rows = parseCsvRows(csv);
  if (!rows.length) return { holidays: [], errors: ['The CSV file is empty.'] };

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase());
  const nameIndex = headers.indexOf('name');
  const dateIndex = headers.indexOf('date');
  const kindIndex = headers.indexOf('kind');
  const optionalIndex = headers.indexOf('optional');
  if (nameIndex < 0 || dateIndex < 0) {
    return { holidays: [], errors: ["The CSV needs 'name' and 'date' columns. Download the template for the supported format."] };
  }

  const holidays: HolidayCsvRow[] = [];
  const errors: string[] = [];
  const usedDates = new Set(existingDates);
  const supportedKinds: HolidayKind[] = ['NATIONAL', 'STATE', 'COMPANY', 'RESTRICTED'];

  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const name = (cells[nameIndex] ?? '').trim();
    const date = (cells[dateIndex] ?? '').trim();
    const rawKind = (kindIndex >= 0 ? cells[kindIndex] : '')?.trim().toUpperCase() || 'COMPANY';
    const rawOptional = (optionalIndex >= 0 ? cells[optionalIndex] : '')?.trim().toLowerCase() || 'false';
    const rowErrors: string[] = [];

    if (!name) rowErrors.push('holiday name is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      rowErrors.push('date must use YYYY-MM-DD');
    } else {
      const parsedDate = new Date(`${date}T00:00:00.000Z`);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
        rowErrors.push('date is not valid');
      } else if (Number(date.slice(0, 4)) !== year) {
        rowErrors.push(`date must be in ${year}`);
      } else if (usedDates.has(date)) {
        rowErrors.push('a holiday already exists on this date');
      }
    }

    if (!supportedKinds.includes(rawKind as HolidayKind)) rowErrors.push('kind must be NATIONAL, STATE, COMPANY, or RESTRICTED');
    const optionalIsTrue = ['true', 'yes', 'y', '1'].includes(rawOptional);
    const optionalIsValid = optionalIsTrue || ['false', 'no', 'n', '0'].includes(rawOptional);
    if (!optionalIsValid) rowErrors.push('optional must be true or false');

    if (rowErrors.length) {
      errors.push(`Row ${rowNumber}: ${rowErrors.join('; ')}.`);
      return;
    }

    usedDates.add(date);
    holidays.push({ name, date, kind: rawKind as HolidayKind, optional: optionalIsTrue });
  });

  if (!holidays.length && !errors.length) errors.push('The CSV has a header but no holiday rows.');
  return { holidays, errors };
}

class HolidayCsvImportFailure extends Error {
  importedCount: number;

  constructor(importedCount: number, message: string) {
    super(message);
    this.importedCount = importedCount;
  }
}

export default function HolidayCalendarPage() {
  const currentYear = new Date().getFullYear();
  const access = useAccess();
  const canManage = access.can('LEAVE_MANAGEMENT.CONFIGURE');
  const [year, setYear] = useState(currentYear);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['time-off', 'holiday-calendars', year], queryFn: () => timeOffApi.listHolidayCalendars(year).then((response) => response.data) });
  const calendars = query.data?.calendars ?? [];
  const selected = calendars.find((calendar) => calendar.id === selectedId) ?? calendars[0] ?? null;
  const refresh = () => client.invalidateQueries({ queryKey: ['time-off', 'holiday-calendars'] });

  const copyCalendar = useMutation({
    mutationFn: ({ id, targetYear }: { id: string; targetYear: number }) => timeOffApi.copyHolidayCalendar(id, targetYear),
    onSuccess: () => { toast.success('Holiday calendar copied'); void refresh(); },
    onError: (error) => toast.error(extractError(error, 'Unable to copy the calendar')),
  });

  return <div className="product-page">
    <PageHeader eyebrow="Time & attendance" title="Holiday calendar" description="Manage national, state, company, and restricted holidays by year." actions={canManage ? <button className="admin-button" onClick={() => setShowCreate(true)}><Plus size={16} aria-hidden="true" /> New calendar</button> : undefined} />

    <section className="calendar-toolbar" aria-label="Holiday calendar filters">
      <label className="admin-label" htmlFor="holiday-year">Calendar year
        <select id="holiday-year" className="admin-input" value={year} onChange={(event) => { setYear(Number(event.target.value)); setSelectedId(null); }}>
          {yearOptions(currentYear).map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <div className="calendar-toolbar__summary"><CalendarDays size={18} aria-hidden="true" /><span><strong>{calendars.length}</strong> calendar{calendars.length === 1 ? '' : 's'} configured for {year}</span></div>
    </section>

    {query.isLoading ? <LoadingState label="Loading holiday calendars…" /> : query.isError ? <ErrorState description="Holiday calendars could not be loaded." onRetry={() => void query.refetch()} /> : !calendars.length ? <EmptyState title="No calendar for this year" description={canManage ? 'Create a calendar to configure company holidays.' : 'Your HR team has not published a holiday calendar for this year.'} action={canManage ? <button className="admin-button" onClick={() => setShowCreate(true)}>Create calendar</button> : undefined} /> : <div className="calendar-layout">
      <aside className="admin-card calendar-list" aria-label="Available calendars">
        {calendars.map((calendar) => <button key={calendar.id} className={calendar.id === selected?.id ? 'is-active' : ''} onClick={() => setSelectedId(calendar.id)}>
          <span><strong>{calendar.name}</strong><small>{calendar.stateCode ? indianStates.find(([code]) => code === calendar.stateCode)?.[1] ?? calendar.stateCode : 'All India'} · {calendar.holidays.length} holidays</small></span>
          <StatusBadge status={calendar.holidays.length ? 'ACTIVE' : 'DRAFT'} />
        </button>)}
      </aside>
      {selected && <HolidayCalendarDetail calendar={selected} canManage={canManage} onChanged={refresh} onCopy={() => copyCalendar.mutate({ id: selected.id, targetYear: selected.year + 1 })} copying={copyCalendar.isPending} />}
    </div>}

    <CreateCalendarDialog open={showCreate} year={year} onOpenChange={setShowCreate} onCreated={(id) => { setSelectedId(id); void refresh(); }} />
  </div>;
}

function HolidayCalendarDetail({ calendar, canManage, onChanged, onCopy, copying }: { calendar: HolidayCalendar; canManage: boolean; onChanged: () => Promise<unknown>; onCopy: () => void; copying: boolean }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvPreview, setCsvPreview] = useState<HolidayCsvResult | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvError, setCsvError] = useState('');
  const client = useQueryClient();
  const sorted = useMemo(() => [...calendar.holidays].sort((left, right) => left.date.localeCompare(right.date)), [calendar.holidays]);
  const remove = useMutation({
    mutationFn: (holidayId: string) => timeOffApi.deleteHoliday(calendar.id, holidayId, calendar.version),
    onSuccess: () => { toast.success('Holiday removed'); void onChanged(); },
    onError: (error) => toast.error(extractError(error, 'Unable to remove the holiday')),
  });
  const add = useMutation({
    mutationFn: (data: { name: string; date: string; kind: HolidayKind; optional: boolean }) => timeOffApi.addHoliday(calendar.id, calendar.version, data),
    onSuccess: () => { toast.success('Holiday added'); setShowAdd(false); void client.invalidateQueries({ queryKey: ['time-off', 'holiday-calendars'] }); },
    onError: (error) => toast.error(extractError(error, 'Unable to add the holiday')),
  });
  const importCsv = useMutation({
    mutationFn: async (holidays: HolidayCsvRow[]) => {
      let version = calendar.version;
      let importedCount = 0;
      for (const holiday of holidays) {
        try {
          const response = await timeOffApi.addHoliday(calendar.id, version, holiday);
          version = response.data.version;
          importedCount += 1;
        } catch (error) {
          throw new HolidayCsvImportFailure(importedCount, extractError(error, 'Unable to import the holiday'));
        }
      }
      return importedCount;
    },
    onSuccess: (count) => {
      toast.success(`${count} holiday${count === 1 ? '' : 's'} imported`);
      setCsvError('');
      setShowImport(false);
      setCsvPreview(null);
      setCsvFileName('');
      void onChanged();
    },
    onError: async (error) => {
      const partialCount = error instanceof HolidayCsvImportFailure ? error.importedCount : 0;
      const detail = error instanceof HolidayCsvImportFailure ? error.message : extractError(error, 'Unable to import the CSV');
      const message = partialCount
        ? `Imported ${partialCount} holiday${partialCount === 1 ? '' : 's'} before the import stopped. ${detail} Choose the file again to retry the remaining rows.`
        : detail;
      setCsvError(message);
      toast.error(message);
      await onChanged();
      setCsvPreview(null);
      setCsvFileName('');
    },
  });

  const handleCsvFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setCsvFileName(file.name);
    setCsvError('');
    setCsvPreview(null);
    try {
      setCsvPreview(parseHolidayCsv(await file.text(), calendar.year, calendar.holidays.map((holiday) => holiday.date)));
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Unable to read this CSV file.');
    }
  };

  return <section className="admin-card calendar-detail">
    <header>
      <div><h2>{calendar.name}</h2><p>{calendar.year} · Version {calendar.version}</p></div>
      {canManage && <div><button className="admin-button admin-button--secondary" disabled={copying} onClick={onCopy}><Copy size={15} aria-hidden="true" /> Copy to {calendar.year + 1}</button><button className="admin-button admin-button--secondary" onClick={() => { setShowImport(true); setCsvPreview(null); setCsvFileName(''); setCsvError(''); }}><Upload size={15} aria-hidden="true" /> Import CSV</button><button className="admin-button" onClick={() => setShowAdd(true)}><Plus size={15} aria-hidden="true" /> Add holiday</button></div>}
    </header>
    <div className="holiday-list" role="list">
      {sorted.map((holiday) => <article key={holiday.id} role="listitem">
        <time dateTime={holiday.date}><strong>{new Intl.DateTimeFormat('en-IN', { day: '2-digit' }).format(new Date(`${holiday.date}T00:00:00`))}</strong><span>{new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(`${holiday.date}T00:00:00`))}</span></time>
        <div><strong>{holiday.name}</strong><span>{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${holiday.date}T00:00:00`))}</span></div>
        <StatusBadge status={holiday.optional ? 'RESTRICTED' : holiday.kind}>{holiday.optional ? 'Optional' : holiday.kind.toLowerCase()}</StatusBadge>
        {canManage && <button className="icon-button" aria-label={`Remove ${holiday.name}`} disabled={remove.isPending} onClick={() => remove.mutate(holiday.id)}><Trash2 size={16} aria-hidden="true" /></button>}
      </article>)}
      {!sorted.length && <EmptyState title="No holidays added" description="Add the first holiday to make this calendar operational." />}
    </div>
    <AddHolidayDialog open={showAdd} onOpenChange={setShowAdd} year={calendar.year} saving={add.isPending} onSave={(data) => add.mutate(data)} />
    <AppDialog
      open={showImport}
      onOpenChange={(open) => {
        if (importCsv.isPending) return;
        setShowImport(open);
        if (!open) {
          setCsvPreview(null);
          setCsvFileName('');
          setCsvError('');
        }
      }}
      title="Import holidays from CSV"
      description={`Add holidays to ${calendar.name} for ${calendar.year}.`}
      footer={<><button className="admin-button admin-button--secondary" disabled={importCsv.isPending} onClick={() => { setShowImport(false); setCsvPreview(null); setCsvFileName(''); setCsvError(''); }}>Cancel</button><button className="admin-button" disabled={importCsv.isPending || !csvPreview?.holidays.length} onClick={() => csvPreview?.holidays.length && importCsv.mutate(csvPreview.holidays)}>{importCsv.isPending ? 'Importing…' : `Import ${csvPreview?.holidays.length ?? 0} holidays`}</button></>}
    >
      <div className="product-form">
        <label className="admin-label" htmlFor="holiday-csv-file">Choose a CSV file<input id="holiday-csv-file" className="admin-input" type="file" accept=".csv,text/csv" onChange={handleCsvFile} /></label>
        <section className="holiday-csv-guide" aria-labelledby="holiday-csv-guide-title">
          <div className="holiday-csv-guide__heading"><strong id="holiday-csv-guide-title">CSV format</strong><p>Use these column names in the first row of your file.</p></div>
          <dl>
            <div><dt><code>name</code><span>Required</span></dt><dd>Holiday name</dd></div>
            <div><dt><code>date</code><span>Required</span></dt><dd><code>YYYY-MM-DD</code><small>Must fall in {calendar.year}</small></dd></div>
            <div><dt><code>kind</code><span>Optional</span></dt><dd><code>NATIONAL · STATE · COMPANY · RESTRICTED</code><small>Defaults to COMPANY</small></dd></div>
            <div><dt><code>optional</code><span>Optional</span></dt><dd><code>true / false</code><small>Defaults to false</small></dd></div>
          </dl>
        </section>
        <a className="admin-button admin-button--secondary" href={`data:text/csv;charset=utf-8,${encodeURIComponent(`name,date,kind,optional\r\nRepublic Day,${calendar.year}-01-26,NATIONAL,false\r\n`)}`} download={`holiday-calendar-${calendar.year}-template.csv`}><Download size={15} aria-hidden="true" /> Download template</a>
        {csvFileName && <p>Selected file: <strong>{csvFileName}</strong></p>}
        {csvPreview && <div className="holiday-csv-preview" role="status"><div className="holiday-csv-preview__heading"><strong>Import preview</strong><span>{csvPreview.holidays.length} row{csvPreview.holidays.length === 1 ? '' : 's'} ready</span></div>{csvPreview.holidays.length > 0 && <ul>{csvPreview.holidays.slice(0, 5).map((holiday) => <li key={holiday.date}><time>{holiday.date}</time><span>{holiday.name}</span><small>{holiday.kind}{holiday.optional ? ' · Optional' : ''}</small></li>)}</ul>}{csvPreview.holidays.length > 5 && <p>And {csvPreview.holidays.length - 5} more rows.</p>}{csvPreview.errors.length > 0 && <div className="holiday-csv-preview__issues"><strong>{csvPreview.errors.length} row{csvPreview.errors.length === 1 ? '' : 's'} will be skipped</strong><ul>{csvPreview.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}</div>}
        {csvError && <div className="holiday-csv-error" role="alert">{csvError}</div>}
      </div>
    </AppDialog>
  </section>;
}

function CreateCalendarDialog({ open, year, onOpenChange, onCreated }: { open: boolean; year: number; onOpenChange: (open: boolean) => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ name: 'India company calendar', year, stateCode: 'ALL' });
  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  const mutation = useMutation({ mutationFn: () => timeOffApi.createHolidayCalendar({ name: form.name.trim(), year: form.year, stateCode: form.stateCode === 'ALL' ? null : form.stateCode, employeeGroupIds: [] }).then((response) => response.data), onSuccess: (calendar) => { toast.success('Holiday calendar created'); onOpenChange(false); onCreated(calendar.id); }, onError: (error) => toast.error(extractError(error, 'Unable to create the calendar')) });
  const submit = () => { const next = form.name.trim() ? [] : [{ field: 'calendar-name', message: 'Enter a calendar name.' }]; setErrors(next); if (!next.length) mutation.mutate(); };
  return <AppDialog open={open} onOpenChange={onOpenChange} title="Create holiday calendar" description="Create a calendar for the selected region, then add or import holidays." footer={<><button className="admin-button admin-button--secondary" onClick={() => onOpenChange(false)}>Cancel</button><button className="admin-button" disabled={mutation.isPending} onClick={submit}>{mutation.isPending ? 'Creating…' : 'Create calendar'}</button></>}>
    <div className="product-form"><ValidationSummary errors={errors} /><label className="admin-label" htmlFor="calendar-name">Calendar name<input id="calendar-name" className="admin-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="admin-label" htmlFor="calendar-year">Year<select id="calendar-year" className="admin-input" value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })}>{yearOptions(year).map((option) => <option key={option}>{option}</option>)}</select></label><label className="admin-label" htmlFor="calendar-state">State applicability<select id="calendar-state" className="admin-input" value={form.stateCode} onChange={(event) => setForm({ ...form, stateCode: event.target.value })}>{indianStates.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label></div>
  </AppDialog>;
}

function AddHolidayDialog({ open, year, saving, onOpenChange, onSave }: { open: boolean; year: number; saving: boolean; onOpenChange: (open: boolean) => void; onSave: (data: { name: string; date: string; kind: HolidayKind; optional: boolean }) => void }) {
  const [form, setForm] = useState<{ name: string; date: string; kind: HolidayKind; optional: boolean }>({ name: '', date: `${year}-01-01`, kind: 'COMPANY', optional: false });
  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  const submit = () => { const next = [...(!form.name.trim() ? [{ field: 'holiday-name', message: 'Enter the holiday name.' }] : []), ...(!form.date.startsWith(String(year)) ? [{ field: 'holiday-date', message: `Choose a date in ${year}.` }] : [])]; setErrors(next); if (!next.length) onSave({ ...form, name: form.name.trim() }); };
  return <AppDialog open={open} onOpenChange={onOpenChange} title="Add holiday" description={`Add a holiday to the ${year} calendar.`} footer={<><button className="admin-button admin-button--secondary" onClick={() => onOpenChange(false)}>Cancel</button><button className="admin-button" disabled={saving} onClick={submit}>{saving ? 'Adding…' : 'Add holiday'}</button></>}>
    <div className="product-form"><ValidationSummary errors={errors} /><label className="admin-label" htmlFor="holiday-name">Holiday name<input id="holiday-name" className="admin-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="admin-label" htmlFor="holiday-date">Date<input id="holiday-date" type="date" className="admin-input" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label className="admin-label" htmlFor="holiday-kind">Type<select id="holiday-kind" className="admin-input" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as HolidayKind })}>{['NATIONAL', 'STATE', 'COMPANY', 'RESTRICTED'].map((kind) => <option key={kind}>{kind}</option>)}</select></label><label className="product-check"><input type="checkbox" checked={form.optional} onChange={(event) => setForm({ ...form, optional: event.target.checked })} /> Employees may choose whether to observe this holiday</label></div>
  </AppDialog>;
}
