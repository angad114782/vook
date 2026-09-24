import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Copy, Plus, Trash2 } from 'lucide-react';
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
    <PageHeader eyebrow="Time & attendance" title="Holiday calendar" description="Manage national, state, company, and restricted holidays by year and workforce scope." actions={canManage ? <button className="admin-button" onClick={() => setShowCreate(true)}><Plus size={16} aria-hidden="true" /> New calendar</button> : undefined} />

    <section className="calendar-toolbar" aria-label="Holiday calendar filters">
      <label className="admin-label" htmlFor="holiday-year">Calendar year
        <select id="holiday-year" className="admin-input" value={year} onChange={(event) => { setYear(Number(event.target.value)); setSelectedId(null); }}>
          {yearOptions(currentYear).map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <div className="calendar-toolbar__summary"><CalendarDays size={18} aria-hidden="true" /><span><strong>{calendars.length}</strong> calendar{calendars.length === 1 ? '' : 's'} configured for {year}</span></div>
    </section>

    {query.isLoading ? <LoadingState label="Loading holiday calendars…" /> : query.isError ? <ErrorState description="Holiday calendars could not be loaded." onRetry={() => void query.refetch()} /> : !calendars.length ? <EmptyState title="No calendar for this year" description={canManage ? 'Create a calendar before configuring holidays for branches and employee groups.' : 'Your HR team has not published a holiday calendar for this year.'} action={canManage ? <button className="admin-button" onClick={() => setShowCreate(true)}>Create calendar</button> : undefined} /> : <div className="calendar-layout">
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

  return <section className="admin-card calendar-detail">
    <header>
      <div><h2>{calendar.name}</h2><p>{calendar.year} · {calendar.branchIds.length ? `${calendar.branchIds.length} branch scope` : 'All branches'} · Version {calendar.version}</p></div>
      {canManage && <div><button className="admin-button admin-button--secondary" disabled={copying} onClick={onCopy}><Copy size={15} aria-hidden="true" /> Copy to {calendar.year + 1}</button><button className="admin-button" onClick={() => setShowAdd(true)}><Plus size={15} aria-hidden="true" /> Add holiday</button></div>}
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
  </section>;
}

function CreateCalendarDialog({ open, year, onOpenChange, onCreated }: { open: boolean; year: number; onOpenChange: (open: boolean) => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ name: 'India company calendar', year, stateCode: 'ALL' });
  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  const mutation = useMutation({ mutationFn: () => timeOffApi.createHolidayCalendar({ name: form.name.trim(), year: form.year, stateCode: form.stateCode === 'ALL' ? null : form.stateCode, branchIds: [], employeeGroupIds: [] }).then((response) => response.data), onSuccess: (calendar) => { toast.success('Holiday calendar created'); onOpenChange(false); onCreated(calendar.id); }, onError: (error) => toast.error(extractError(error, 'Unable to create the calendar')) });
  const submit = () => { const next = form.name.trim() ? [] : [{ field: 'calendar-name', message: 'Enter a calendar name.' }]; setErrors(next); if (!next.length) mutation.mutate(); };
  return <AppDialog open={open} onOpenChange={onOpenChange} title="Create holiday calendar" description="Start with a scoped calendar, then add or import holidays." footer={<><button className="admin-button admin-button--secondary" onClick={() => onOpenChange(false)}>Cancel</button><button className="admin-button" disabled={mutation.isPending} onClick={submit}>{mutation.isPending ? 'Creating…' : 'Create calendar'}</button></>}>
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
