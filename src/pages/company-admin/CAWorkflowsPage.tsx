import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { type WorkflowData, type WorkflowStep } from '../../api/companyAdmin';
import { ArrowRight, Plus, Trash2, Loader2, Check } from 'lucide-react';
import { extractError } from '../../utils/errorUtils';
import { useWorkflows } from '../../hooks/queries/useCaQueries';
import { useSaveWorkflow } from '../../hooks/mutations/useCaMutations';

type WorkflowType = 'leave' | 'expense' | 'correction';

const ROLES_OPTIONS = ['SUPERVISOR', 'MANAGER', 'HR', 'COMPANY_ADMIN'];
const ACTIONS = ['Review & Approve', 'Final Approval', 'Acknowledge', 'Notify Only'];

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  SUPERVISOR:    { bg: '#fff7ed', color: '#d97706' },
  MANAGER:       { bg: '#f5f3ff', color: '#6366f1' },
  HR:            { bg: '#eff6ff', color: '#2563eb' },
  COMPANY_ADMIN: { bg: '#f0fdfa', color: '#0d7470' },
};

const TYPE_LABELS: Record<WorkflowType, string> = {
  leave:      'Leave Request',
  expense:    'Expense Claim',
  correction: 'Attendance Correction',
};

export default function CAWorkflowsPage() {
  const [workflows,   setWorkflows]   = useState<Record<WorkflowType, WorkflowData>>({} as any);
  const [activeTab,   setActiveTab]   = useState<WorkflowType>('leave');
  const [workflowsLoaded, setWorkflowsLoaded] = useState(false);
  const [saved,       setSaved]       = useState(false);

  const { data: workflowsData, isLoading: loading } = useWorkflows();
  const saveWorkflow = useSaveWorkflow();

  useEffect(() => {
    if (workflowsData && !workflowsLoaded) {
      const map = {} as Record<WorkflowType, WorkflowData>;
      workflowsData.forEach((w: WorkflowData) => { map[w.type as WorkflowType] = w; });
      setWorkflows(map);
      setWorkflowsLoaded(true);
    }
  }, [workflowsData, workflowsLoaded]);

  const wf = workflows[activeTab];

  const setWf = (updater: (prev: WorkflowData) => WorkflowData) => {
    setWorkflows((p) => ({ ...p, [activeTab]: updater(p[activeTab]) }));
  };

  const addStep = () => {
    const newStep: WorkflowStep = { order: (wf?.steps?.length ?? 0) + 1, role: 'HR', action: 'Review & Approve', escalateAfter: 24 };
    setWf((p) => ({ ...p, steps: [...p.steps, newStep] }));
  };

  const removeStep = (idx: number) =>
    setWf((p) => ({ ...p, steps: p.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })) }));

  const updateStep = (idx: number, field: keyof WorkflowStep, value: string | number) =>
    setWf((p) => ({ ...p, steps: p.steps.map((s, i) => i === idx ? { ...s, [field]: value } : s) }));

  const handleSave = () => {
    if (!wf) return;
    saveWorkflow.mutate(
      { type: activeTab, data: { steps: wf.steps, autoEscalate: wf.autoEscalate, escalateHours: wf.escalateHours } },
      {
        onSuccess: () => {
          setSaved(true);
          toast.success('Workflow saved successfully');
          setTimeout(() => setSaved(false), 2500);
        },
        onError: (err) => {
          toast.error(extractError(err, 'Failed to save workflow'));
        },
      },
    );
  };

  const saving = saveWorkflow.isPending;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', gap: '10px', color: '#64748b' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px' }}>Loading workflows…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Approval Workflows</h1>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Define multi-step approval chains for leave, expense, and attendance requests.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '3px', width: 'fit-content' }}>
        {(['leave', 'expense', 'correction'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', backgroundColor: activeTab === t ? 'white' : 'transparent', color: activeTab === t ? '#0d4a47' : '#64748b', boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {wf && (
        <>
          {/* Visual chain */}
          <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{TYPE_LABELS[activeTab]} — Approval Chain</h3>
              <button onClick={addStep} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', backgroundColor: '#0d7470', color: 'white', border: 'none', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <Plus size={11} /> Add Step
              </button>
            </div>

            {/* Chain visualisation */}
            <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: '8px' }}>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>EMP</span>
                </div>
                <p style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>Submits</p>
              </div>

              {wf.steps.map((step, idx) => {
                const rc = ROLE_COLORS[step.role] ?? { bg: '#f1f5f9', color: '#64748b' };
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ color: '#cbd5e1', padding: '0 4px' }}><ArrowRight size={16} /></div>
                    <div style={{ textAlign: 'center', position: 'relative' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: rc.bg, border: `2px solid ${rc.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: rc.color, textAlign: 'center', lineHeight: 1.2 }}>{step.role.replace('_', ' ').substring(0, 8)}</span>
                      </div>
                      <p style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>Step {idx + 1}</p>
                      {step.escalateAfter > 0 && <p style={{ fontSize: '8px', color: '#d97706' }}>↑ {step.escalateAfter}h</p>}
                      <button onClick={() => removeStep(idx)} style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', border: 'none', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        <Trash2 size={8} />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div style={{ color: '#cbd5e1', padding: '0 4px', flexShrink: 0 }}><ArrowRight size={16} /></div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#f0fdf4', border: '2px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a' }}>✓</span>
                </div>
                <p style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>Approved</p>
              </div>
            </div>

            {/* Steps table */}
            <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Configure Steps</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {wf.steps.map((step, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr auto', gap: '10px', alignItems: 'center', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>#{idx + 1}</span>
                    <select value={step.role} onChange={(e) => updateStep(idx, 'role', e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: 'white' }}>
                      {ROLES_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <select value={step.action} onChange={(e) => updateStep(idx, 'action', e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', backgroundColor: 'white' }}>
                      {ACTIONS.map((a) => <option key={a}>{a}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="number" value={step.escalateAfter} onChange={(e) => updateStep(idx, 'escalateAfter', Number(e.target.value))} min={0} style={{ width: '60px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', textAlign: 'center' }} />
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>hrs</span>
                    </div>
                    <button onClick={() => removeStep(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={13} /></button>
                  </div>
                ))}
                {wf.steps.length === 0 && <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No steps yet. Click "Add Step" to begin.</p>}
              </div>
            </div>
          </div>

          {/* Auto-escalation */}
          <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Auto-Escalation Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Enable Auto-Escalation</p>
                  <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Automatically escalate if no action taken within configured time.</p>
                </div>
                <button onClick={() => setWf((p) => ({ ...p, autoEscalate: !p.autoEscalate }))} style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', backgroundColor: wf.autoEscalate ? '#0d7470' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: '3px', left: wf.autoEscalate ? '20px' : '3px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
              {wf.autoEscalate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Default escalation period:</label>
                  <input type="number" value={wf.escalateHours} onChange={(e) => setWf((p) => ({ ...p, escalateHours: Number(e.target.value) }))} min={1} style={{ width: '70px', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', outline: 'none', fontFamily: 'Inter, sans-serif', color: '#374151', textAlign: 'center' }} />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>hours</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
              {saved && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                  <Check size={13} /> Saved
                </span>
              )}
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', backgroundColor: saving ? '#7ab8b6' : '#0d7470', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {saving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                Save Workflow
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
