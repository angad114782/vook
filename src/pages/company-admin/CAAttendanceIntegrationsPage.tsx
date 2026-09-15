import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, LocateFixed, ScanFace, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { organizationApi } from '../../api/organization';

interface Policy {
  verificationMethods?: Record<string, boolean>;
  requireAnyVerification?: boolean;
  minimumGpsAccuracyMeters?: number;
  allowRemoteAttendance?: boolean;
}

const methodInfo = [
  { key: 'gps', label: 'Capture GPS', detail: 'Record employee coordinates and device accuracy.', icon: LocateFixed },
  { key: 'geofence', label: 'Enforce branch geofence', detail: 'Accept mobile punches inside an active branch radius.', icon: ShieldCheck },
  { key: 'device', label: 'Registered device', detail: 'Accept attendance from configured terminals.', icon: Fingerprint },
  { key: 'face', label: 'Face verification', detail: 'Require a verified face event for attendance.', icon: ScanFace },
  { key: 'biometric', label: 'Fingerprint verification', detail: 'Require a biometric event for attendance.', icon: Fingerprint },
];

const defaultPolicy: Policy = {
  verificationMethods: {},
  requireAnyVerification: true,
  minimumGpsAccuracyMeters: 100,
  allowRemoteAttendance: false,
};

export default function CAAttendanceIntegrationsPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['ca', 'attendance-policy'],
    queryFn: () => organizationApi.getAttendanceIntegrations<{ policy: Policy }>().then((response) => response.data.policy),
  });
  const [policy, setPolicy] = useState<Policy>(defaultPolicy);

  useEffect(() => {
    if (query.data) setPolicy((current) => ({ ...current, ...query.data, verificationMethods: { ...current.verificationMethods, ...query.data.verificationMethods } }));
  }, [query.data]);

  const savePolicy = useMutation({
    mutationFn: () => organizationApi.saveAttendancePolicy({ ...policy, reason: 'Company attendance verification policy' }),
    onSuccess: () => {
      toast.success('Attendance verification policy saved.');
      void client.invalidateQueries({ queryKey: ['ca', 'attendance-policy'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? 'Unable to save attendance policy.'),
  });

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><h1>Attendance policy</h1><p>Choose which checks employees must meet when recording attendance. Device connections are managed by Vook.</p></div>
        <span className="health-chip"><Fingerprint size={15} /> Device setup managed by Vook</span>
      </header>

      <section className="admin-card attendance-policy-card">
        <header><div><h2>Verification methods</h2><p>Branch coordinates and geofence radius are managed under Organization.</p></div></header>
        <div className="verification-method-grid">
          {methodInfo.map(({ key, label, detail, icon: Icon }) => {
            const enabled = Boolean(policy.verificationMethods?.[key]);
            return <button type="button" aria-pressed={enabled} className={enabled ? 'is-enabled' : ''} key={key} onClick={() => setPolicy((current) => ({ ...current, verificationMethods: { ...current.verificationMethods, [key]: !enabled } }))}>
              <Icon size={18} /><span><strong>{label}</strong><small>{detail}</small></span>{enabled && <ShieldCheck size={15} />}
            </button>;
          })}
        </div>
        <div className="policy-controls">
          <label className="admin-label">Minimum GPS accuracy (metres)<input className="admin-input" type="number" min={5} max={500} value={policy.minimumGpsAccuracyMeters ?? 100} onChange={(event) => setPolicy((current) => ({ ...current, minimumGpsAccuracyMeters: Number(event.target.value) }))} /></label>
          <label className="policy-check"><input type="checkbox" checked={policy.requireAnyVerification !== false} onChange={(event) => setPolicy((current) => ({ ...current, requireAnyVerification: event.target.checked }))} /> Require configured verification for self attendance</label>
          <label className="policy-check"><input type="checkbox" checked={Boolean(policy.allowRemoteAttendance)} onChange={(event) => setPolicy((current) => ({ ...current, allowRemoteAttendance: event.target.checked }))} /> Allow attendance outside a branch geofence</label>
          <button className="admin-button" disabled={savePolicy.isPending || query.isLoading} onClick={() => savePolicy.mutate()}>{savePolicy.isPending ? 'Saving…' : 'Save policy'}</button>
        </div>
      </section>
    </div>
  );
}
