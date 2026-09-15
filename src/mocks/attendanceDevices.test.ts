import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getMockState, resetMockState, updateMockState } from './db';
import {
  activateAttendanceDevice,
  listAttendanceDevices,
  saveAttendanceDevice,
  testAttendanceDevice,
} from './attendanceDevices';

describe('platform-managed attendance device mock store', () => {
  beforeEach(async () => {
    await resetMockState();
  });

  it('stores device connections globally and requires a successful test before activation', async () => {
    const created = await saveAttendanceDevice({
      providerKey: 'FACE_TERMINAL',
      displayName: 'Main face scanner',
      publicConfig: { callbackKey: 'global-callback' },
      deviceSerials: ['FACE-GLOBAL-1'],
      hasSecret: true,
      reason: 'Configure supplied face scanner',
    });

    expect(created).toMatchObject({
      scope: 'GLOBAL',
      status: 'DRAFT',
      secretConfigured: true,
    });
    expect(created).not.toHaveProperty('secrets');
    await expect(activateAttendanceDevice(created.id)).rejects.toThrow(
      'Test the latest device configuration before activation.',
    );

    const tested = await testAttendanceDevice(created.id);
    const active = await activateAttendanceDevice(tested.id);
    expect(active.status).toBe('ACTIVE');
    expect((await listAttendanceDevices()).connections.some((item) => item.id === created.id)).toBe(true);

    const state = await getMockState();
    expect(state.attendanceIntegrations.find((item) => item.id === created.id)).toMatchObject({
      scope: 'GLOBAL',
      status: 'ACTIVE',
      secretConfigured: true,
    });
    expect(state.attendanceIntegrations.find((item) => item.id === created.id)).not.toHaveProperty('companyId');
  });

  it('migrates previously company-scoped demo connections to global scope', async () => {
    await updateMockState((state) => {
      state.attendanceIntegrations.push({
        id: 'legacy_attendance_device',
        companyId: 'company_orbit',
        providerKey: 'GENERIC_BIOMETRIC_API',
        displayName: 'Legacy attendance API',
        connectionMode: 'CLOUD_API',
        status: 'DRAFT',
        publicConfig: { baseUrl: 'https://attendance.example/api' },
        deviceSerials: [],
        secretConfigured: false,
      });
    });

    const listed = await listAttendanceDevices();
    expect(listed.connections.find((item) => item.id === 'legacy_attendance_device')).toMatchObject({ scope: 'GLOBAL' });
    const state = await getMockState();
    const migrated = state.attendanceIntegrations.find((item) => item.id === 'legacy_attendance_device');
    expect(migrated).toMatchObject({ scope: 'GLOBAL' });
    expect(migrated).not.toHaveProperty('companyId');
  });
});
