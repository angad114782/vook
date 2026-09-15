import { appendAudit } from './domain';
import { getMockState, updateMockState } from './db';
import type { MockState } from './seed';

type Row = Record<string, any>;
export interface AttendanceDeviceManifest { key: string; name: string; mode: string; description: string; fields: string[] }
export interface AttendanceDeviceConnection {
  id: string; scope: "GLOBAL"; providerKey: string; displayName: string; connectionMode: string;
  status: 'DRAFT' | 'TESTED' | 'ACTIVE' | 'ERROR' | 'DISABLED'; publicConfig: Record<string, unknown>;
  deviceSerials: string[]; secretConfigured: boolean; lastTestedAt?: string;
}

export const attendanceDeviceManifests: AttendanceDeviceManifest[] = [
  { key: 'MOBILE_GEOLOCATION', name: 'Mobile GPS & geofence', mode: 'MOBILE', description: 'Browser or mobile GPS verification against configured branch geofences.', fields: ['minimumAccuracyMeters'] },
  { key: 'ZKTECO_BIOTIME', name: 'ZKTeco / BioTime', mode: 'CLOUD_API', description: 'Cloud API connector for ZKTeco and BioTime deployments.', fields: ['baseUrl', 'tenantCode'] },
  { key: 'ESSL_EATTENDANCE', name: 'eSSL eTimeTrackLite', mode: 'LOCAL_BRIDGE', description: 'Secure local bridge connector for eSSL attendance devices.', fields: ['bridgeId'] },
  { key: 'MATRIX_COSEC', name: 'Matrix COSEC', mode: 'CLOUD_API', description: 'COSEC API connector for attendance events and identities.', fields: ['baseUrl', 'organizationCode'] },
  { key: 'SUPREMA_BIOSTAR', name: 'Suprema BioStar', mode: 'LOCAL_BRIDGE', description: 'BioStar bridge connector for fingerprint and face terminals.', fields: ['bridgeId'] },
  { key: 'MANTRA_BIOMETRIC', name: 'Mantra biometric', mode: 'LOCAL_BRIDGE', description: 'Local bridge connector for supported Mantra devices.', fields: ['bridgeId'] },
  { key: 'FACE_TERMINAL', name: 'Face attendance terminal', mode: 'DEVICE_PUSH', description: 'Signed event receiver for face-recognition terminals.', fields: ['callbackKey'] },
  { key: 'GENERIC_BIOMETRIC_API', name: 'Generic biometric REST API', mode: 'CLOUD_API', description: 'Vendor-neutral REST connector for supported attendance providers.', fields: ['baseUrl'] },
];

const createId = () => `attendance_device_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export async function listAttendanceDevices(): Promise<{ manifests: AttendanceDeviceManifest[]; connections: AttendanceDeviceConnection[] }> {
  const state = await getMockState();
  const hasLegacyScope = (state.attendanceIntegrations as Row[]).some((connection) => connection.companyId);
  const rows = hasLegacyScope
    ? await updateMockState((draft) => {
        for (const connection of draft.attendanceIntegrations as Row[]) {
          connection.scope = "GLOBAL";
          delete connection.companyId;
        }
        return draft.attendanceIntegrations as Row[];
      })
    : state.attendanceIntegrations as Row[];
  return {
    manifests: attendanceDeviceManifests,
    connections: rows.map(({ secrets: _secrets, companyId: _companyId, ...connection }) => ({
      ...connection,
      scope: "GLOBAL" as const,
    })) as AttendanceDeviceConnection[],
  };
}

export async function saveAttendanceDevice(input: {
  providerKey: string; displayName: string; publicConfig: Record<string, unknown>;
  deviceSerials: string[]; hasSecret: boolean; reason: string;
}) {
  return updateMockState((draft) => {
    const state = draft as MockState;
    const manifest = attendanceDeviceManifests.find((item) => item.key === input.providerKey);
    if (!manifest) throw new Error('Choose a supported attendance provider.');
    let connection = (state.attendanceIntegrations as Row[]).find((item) => item.providerKey === manifest.key && item.displayName === input.displayName);
    if (!connection) {
      connection = { id: createId(), scope: "GLOBAL", providerKey: manifest.key, displayName: input.displayName || manifest.name, connectionMode: manifest.mode, status: 'DRAFT', publicConfig: {}, deviceSerials: [], secretConfigured: false };
      (state.attendanceIntegrations as Row[]).push(connection);
    }
    Object.assign(connection, {
      scope: "GLOBAL",
      displayName: input.displayName || manifest.name,
      connectionMode: manifest.mode,
      status: 'DRAFT',
      publicConfig: input.publicConfig,
      deviceSerials: input.deviceSerials,
      secretConfigured: Boolean(connection.secretConfigured || input.hasSecret),
      updatedAt: new Date().toISOString(),
    });
    delete connection.companyId;
    appendAudit(state, { action: 'ATTENDANCE_DEVICE_CONNECTION_SAVED', entityType: 'ATTENDANCE_CONNECTION', entityId: connection.id, newValue: { providerKey: manifest.key, displayName: connection.displayName, scope: "GLOBAL" }, description: input.reason });
    const { secrets: _secrets, ...safeConnection } = connection;
    return safeConnection;
  });
}

export async function testAttendanceDevice(connectionId: string) {
  return updateMockState((draft) => {
    const state = draft as MockState;
    const connection = (state.attendanceIntegrations as Row[]).find((item) => item.id === connectionId);
    if (!connection) throw new Error('Global attendance device connection not found.');
    const config = connection.publicConfig as Row ?? {};
    const mode = String(connection.connectionMode ?? '');
    const valid = mode === 'MOBILE' || (mode === 'CLOUD_API' && /^https:\/\//i.test(String(config.baseUrl ?? ''))) || (mode === 'LOCAL_BRIDGE' && Boolean(config.bridgeId)) || (mode === 'DEVICE_PUSH' && Boolean(config.callbackKey));
    if (!valid) throw new Error('Complete the provider endpoint or bridge configuration before testing.');
    connection.scope = "GLOBAL";
    delete connection.companyId;
    connection.status = 'TESTED';
    connection.lastTestedAt = new Date().toISOString();
    appendAudit(state, { action: 'ATTENDANCE_DEVICE_CONNECTION_TESTED', entityType: 'ATTENDANCE_CONNECTION', entityId: connection.id, newValue: connection });
    const { secrets: _secrets, ...safeConnection } = connection;
    return safeConnection;
  });
}

export async function activateAttendanceDevice(connectionId: string) {
  return updateMockState((draft) => {
    const state = draft as MockState;
    const connection = (state.attendanceIntegrations as Row[]).find((item) => item.id === connectionId);
    if (!connection) throw new Error('Global attendance device connection not found.');
    if (connection.status !== 'TESTED') throw new Error('Test the latest device configuration before activation.');
    connection.status = 'ACTIVE';
    connection.scope = "GLOBAL";
    delete connection.companyId;
    appendAudit(state, { action: 'ATTENDANCE_DEVICE_CONNECTION_ACTIVATED', entityType: 'ATTENDANCE_CONNECTION', entityId: connection.id, newValue: connection });
    const { secrets: _secrets, ...safeConnection } = connection;
    return safeConnection;
  });
}
