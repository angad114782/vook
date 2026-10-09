import { notify } from '../lib/notify.ts';
import { coll } from '../db/mongo.ts';
import { find, insertMany, type Row } from '../db/repo.ts';

export type Biometric = 'FACE' | 'FINGERPRINT';
export interface ProviderField { key: string; label: string; required: boolean; secret?: boolean; placeholder?: string }

/**
 * Providers that ship with Vook. The platform admin can add any other vendor (any connection type, face / fingerprint / both)
 * from the screen, so nothing here limits which devices can be used.
 * Every provider except the phone-GPS one needs an API key and an API token; those are added automatically on top of these fields.
 */
export const BUILTIN_PROVIDERS: Array<{ key: string; name: string; mode: 'CLOUD_API' | 'LOCAL_BRIDGE' | 'DEVICE_PUSH' | 'MOBILE'; biometrics: Biometric[]; description: string; fields: ProviderField[] }> = [
  { key: 'MOBILE_GEOLOCATION', name: 'Mobile GPS & geofence', mode: 'MOBILE', biometrics: [], description: 'Employees punch from their phone; location is checked against the branch geofence. No device needed.', fields: [{ key: 'minimumAccuracyMeters', label: 'Minimum GPS accuracy (metres)', required: false, placeholder: '100' }] },
  { key: 'ZKTECO_BIOTIME', name: 'ZKTeco / BioTime', mode: 'CLOUD_API', biometrics: ['FACE', 'FINGERPRINT'], description: 'Cloud connection for ZKTeco and BioTime devices.', fields: [{ key: 'baseUrl', label: 'Server address (https://…)', required: true, placeholder: 'https://biotime.example.com' }, { key: 'tenantCode', label: 'Company code at the vendor', required: false }] },
  { key: 'ESSL_EATTENDANCE', name: 'eSSL eTimeTrackLite', mode: 'LOCAL_BRIDGE', biometrics: ['FINGERPRINT'], description: 'Secure local bridge for eSSL fingerprint devices.', fields: [{ key: 'bridgeId', label: 'Bridge ID', required: true }] },
  { key: 'MATRIX_COSEC', name: 'Matrix COSEC', mode: 'CLOUD_API', biometrics: ['FACE', 'FINGERPRINT'], description: 'Matrix COSEC connection for attendance events and identities.', fields: [{ key: 'baseUrl', label: 'Server address (https://…)', required: true }, { key: 'organizationCode', label: 'Organisation code', required: false }] },
  { key: 'SUPREMA_BIOSTAR', name: 'Suprema BioStar', mode: 'LOCAL_BRIDGE', biometrics: ['FACE', 'FINGERPRINT'], description: 'BioStar bridge for fingerprint and face terminals.', fields: [{ key: 'bridgeId', label: 'Bridge ID', required: true }] },
  { key: 'MANTRA_BIOMETRIC', name: 'Mantra biometric', mode: 'LOCAL_BRIDGE', biometrics: ['FINGERPRINT'], description: 'Local bridge for supported Mantra fingerprint devices.', fields: [{ key: 'bridgeId', label: 'Bridge ID', required: true }] },
  { key: 'FACE_TERMINAL', name: 'Face attendance terminal', mode: 'DEVICE_PUSH', biometrics: ['FACE'], description: 'Face-recognition terminals that send each punch to Vook. Give the terminal the API key and token you set here.', fields: [] },
  { key: 'FINGERPRINT_TERMINAL', name: 'Fingerprint attendance terminal', mode: 'DEVICE_PUSH', biometrics: ['FINGERPRINT'], description: 'Fingerprint terminals that send each punch to Vook. Give the terminal the API key and token you set here.', fields: [] },
  { key: 'FACE_FINGERPRINT_TERMINAL', name: 'Face + fingerprint terminal', mode: 'DEVICE_PUSH', biometrics: ['FACE', 'FINGERPRINT'], description: 'Terminals that read both face and fingerprint and send each punch to Vook.', fields: [] },
  { key: 'GENERIC_BIOMETRIC_API', name: 'Other vendor (REST API)', mode: 'CLOUD_API', biometrics: ['FACE', 'FINGERPRINT'], description: 'Any vendor that offers a web API.', fields: [{ key: 'baseUrl', label: 'Server address (https://…)', required: true }, { key: 'healthPath', label: 'Status page path (optional)', required: false, placeholder: '/health' }] },
];

export const providerRows = () => BUILTIN_PROVIDERS.map((p) => ({ id: `provider_${p.key.toLowerCase()}`, ...p, builtIn: true, isActive: true, createdAt: new Date().toISOString() }));

/** Makes sure the shipped providers exist (first run, or a database created before this feature) and returns the whole catalogue. */
/**
 * The provider list is plain data in the database. The built-in brands are added once, the first time anyone opens the list;
 * after that an admin can remove or change any of them and they stay that way.
 */
const SEED_MARKER = 'provider_builtins_added';
export async function loadProviders(): Promise<Row[]> {
  const all = await find('attendanceProviders', {}, { sort: { builtIn: -1, name: 1 } });
  if (!all.some((r) => r.id === SEED_MARKER)) {
    const have = new Set(all.map((r) => r.key));
    try {
      const missing = providerRows().filter((p) => !have.has(p.key));
      if (missing.length) await insertMany('attendanceProviders', missing, 'provider');
      await coll('attendanceProviders').insertOne({ _id: SEED_MARKER as never, key: '__BUILTINS_ADDED__', marker: true });
    } catch { /* a parallel request did it first */ }
    return (await find('attendanceProviders', {}, { sort: { builtIn: -1, name: 1 } })).filter((r) => !r.marker);
  }
  return all.filter((r) => !r.marker);
}

export const needsCredentials = (mode: string) => mode !== 'MOBILE';
export const countConnections = (providerKey: string) => coll('attendanceIntegrations').countDocuments({ providerKey });

export type Availability = { mode: 'ALL' | 'SELECTED'; companyIds: string[] };
/** A connection is for every company unless the platform admin limited it to chosen companies. */
export const availableTo = (connection: Row, companyId: string) => {
  const a = (connection.availability ?? { mode: 'ALL', companyIds: [] }) as Availability;
  return a.mode !== 'SELECTED' || a.companyIds.includes(companyId);
};

/** Tell the admins and HR of each company something about their devices, in plain words. */
export async function tellCompanies(companyIds: string[], title: string, message: string, data: Row = {}) {
  const ids = [...new Set(companyIds)].filter(Boolean);
  if (!ids.length) return;
  const people = await find('users', { companyId: { $in: ids }, role: { $in: ['COMPANY_ADMIN', 'HR'] }, isActive: { $ne: false } }, { projection: { companyId: 1 } });
  for (const u of people) await notify({ userId: u.id, companyId: u.companyId, type: 'ATTENDANCE_DEVICE', title, message, data }).catch(() => undefined);
}
