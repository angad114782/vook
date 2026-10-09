import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { extractError } from '../../utils/errorUtils';

export interface SelectOption { value: string; label: string }

interface CreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Persist a new option and return it. Omit when the user may not add items. */
  onCreate?: (name: string) => Promise<SelectOption>;
  /** Singular plain-language noun, e.g. "department". Used in every visible message. */
  entityLabel?: string;
  placeholder?: string;
  /** Removes an option for good. Omit when the user may not delete. A small bin button appears on each row and asks "Delete?" first. */
  onDelete?: (value: string) => Promise<void>;
  /** Hide the bin on rows that cannot be removed (for example a value that is not in the master list). */
  canDelete?: (value: string) => boolean;
  loading?: boolean;
  disabled?: boolean;
  id?: string;
}

const SEARCH_THRESHOLD = 7;
const norm = (s: string) => s.trim().toLowerCase();

/**
 * Dropdown that looks and behaves like a normal select, with an always-visible
 * "+ Add new …" button at the bottom of the list. Nothing to discover or type-to-trigger.
 * Data-agnostic: callers pass `options` and `onCreate`, so swapping mock for a real API never touches this file.
 */
export default function CreatableSelect({ value, onChange, options, onCreate, onDelete, canDelete, entityLabel = 'item', placeholder, loading, disabled, id }: CreatableSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const selected = options.find((o) => o.value === value);
  const shown = search ? options.filter((o) => norm(o.label).includes(norm(search))) : options;

  const close = () => { setConfirming(null); setOpen(false); setAdding(false); setSearch(''); setNewName(''); };

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => { if (adding) newInputRef.current?.focus(); }, [adding]);

  const choose = (v: string) => { onChange(v); close(); };
  const remove = async (v: string) => {
    if (!onDelete || removing) return;
    setRemoving(true);
    try { await onDelete(v); toast.success(`${entityLabel[0]!.toUpperCase()}${entityLabel.slice(1)} deleted`); if (v === value) onChange(''); setConfirming(null); }
    catch (err) { setConfirming(null); toast.error(extractError(err, `Could not delete this ${entityLabel}.`)); }
    finally { setRemoving(false); }
  };
  const startAdding = () => { setNewName(search.trim()); setAdding(true); };
  const save = async () => {
    const name = newName.trim();
    if (!name || !onCreate || saving) return;
    const existing = options.find((o) => norm(o.label) === norm(name));
    if (existing) { choose(existing.value); return; } // already there — just pick it
    setSaving(true);
    try {
      const created = await onCreate(name);
      toast.success(`“${created.label}” added`);
      choose(created.value);
    } catch (err) {
      toast.error(extractError(err, `Could not add the ${entityLabel}. Please try again.`));
    } finally { setSaving(false); }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }} onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); close(); } }}>
      <button
        type="button" id={id} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: disabled ? '#f8fafc' : 'white', fontSize: 13, fontFamily: 'Inter, sans-serif', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer', color: selected || value ? '#0f172a' : '#94a3b8' }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected?.label ?? (value || (loading ? 'Loading…' : placeholder ?? `Select ${entityLabel}`))}</span>
        <ChevronDown size={14} aria-hidden style={{ color: '#94a3b8', flexShrink: 0 }} />
      </button>
      {value && !disabled && (
        <button type="button" aria-label={`Clear ${entityLabel}`} onClick={() => onChange('')} style={{ position: 'absolute', right: 30, top: 8, border: 0, background: 'none', padding: 2, color: '#94a3b8', cursor: 'pointer', display: 'flex' }}><X size={13} aria-hidden /></button>
      )}

      {open && (
        <div style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,.12)', overflow: 'hidden' }}>
          {options.length > SEARCH_THRESHOLD && (
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${entityLabel}…`} aria-label={`Search ${entityLabel}`} style={{ width: '100%', padding: '9px 12px', border: 0, borderBottom: '1px solid #f1f5f9', outline: 'none', fontSize: 13, fontFamily: 'Inter, sans-serif' }} />
          )}
          <div role="listbox" aria-label={entityLabel} style={{ maxHeight: 200, overflowY: 'auto', padding: 4 }}>
            {shown.length === 0 && (
              <p style={{ padding: '10px 12px', fontSize: 12, color: '#64748b', margin: 0 }}>
                {loading ? 'Loading…' : search ? `No ${entityLabel} matches “${search}”.` : onCreate ? `No ${entityLabel} yet. Add your first one below.` : `No ${entityLabel} yet. Ask your admin to add one.`}
              </p>
            )}
            {shown.map((o) => {
              const deletable = Boolean(onDelete) && (canDelete ? canDelete(o.value) : true);
              if (confirming === o.value) {
                return (
                  <div key={o.value} role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, background: '#fef2f2', fontSize: 12, color: '#7f1d1d' }}>
                    <span style={{ flex: 1 }}>Delete “{o.label}”?</span>
                    <button type="button" disabled={removing} onClick={() => void remove(o.value)} style={{ padding: '3px 10px', border: 0, borderRadius: 5, background: '#b91c1c', color: 'white', fontSize: 12, cursor: 'pointer' }}>{removing ? 'Deleting…' : 'Yes, delete'}</button>
                    <button type="button" disabled={removing} onClick={() => setConfirming(null)} style={{ padding: '3px 10px', border: '1px solid #e2e8f0', borderRadius: 5, background: 'white', fontSize: 12, cursor: 'pointer' }}>No</button>
                  </div>
                );
              }
              return (
                <div key={o.value} style={{ display: 'flex', alignItems: 'center', borderRadius: 6, background: o.value === value ? '#f0fdfa' : 'transparent' }}>
                  <button type="button" role="option" aria-selected={o.value === value} onClick={() => choose(o.value)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 0, borderRadius: 6, background: 'transparent', fontSize: 13, color: '#0f172a', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    <span style={{ flex: 1 }}>{o.label}</span>{o.value === value && <Check size={13} aria-hidden style={{ color: '#0d7470' }} />}
                  </button>
                  {deletable && <button type="button" aria-label={`Delete ${o.label}`} title="Delete" onClick={() => setConfirming(o.value)} style={{ border: 0, background: 'none', padding: 6, marginRight: 4, color: '#94a3b8', cursor: 'pointer', display: 'flex', borderRadius: 4 }} onMouseEnter={(e) => { e.currentTarget.style.color = '#b91c1c'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}><Trash2 size={13} aria-hidden /></button>}
                </div>
              );
            })}
          </div>

          {!onCreate && options.length > 0 && (
            <p style={{ margin: 0, padding: '8px 12px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', fontSize: 12, color: '#64748b' }}>Can’t find it? Ask your admin to add a new {entityLabel}.</p>
          )}
          {onCreate && (
            <div style={{ borderTop: '1px solid #f1f5f9', padding: 6, background: '#f8fafc' }}>
              {!adding ? (
                <button type="button" onClick={startAdding} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: 0, borderRadius: 6, background: 'transparent', color: '#0d7470', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  <Plus size={14} aria-hidden /> Add new {entityLabel}
                </button>
              ) : (
                <div onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (newName.trim() && !saving) void save(); } }} style={{ display: 'flex', gap: 6 }}>
                  <input ref={newInputRef} value={newName} onChange={(e) => setNewName(e.target.value)} aria-label={`Name of new ${entityLabel}`} placeholder={`Name of new ${entityLabel}`} maxLength={80} style={{ flex: 1, minWidth: 0, padding: '7px 10px', border: '1.5px solid #cbd5e1', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                  <button type="button" onClick={() => void save()} disabled={!newName.trim() || saving} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', border: 0, borderRadius: 6, background: '#0d7470', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !newName.trim() || saving ? 0.6 : 1 }}>
                    {saving && <Loader2 size={12} className="employee-form-drawer__spinner" aria-hidden />} Add
                  </button>
                  <button type="button" onClick={() => { setAdding(false); setNewName(''); }} disabled={saving} style={{ padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', color: '#475569', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
