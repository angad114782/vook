import { describe, expect, it, vi } from 'vitest';
import { createMockSocket } from './mockSocket';

describe('mock realtime adapter', () => {
  it('acknowledges support read receipts', () => {
    const acknowledgement = vi.fn();
    createMockSocket().emit('support:read', { ticketId: 'ticket_1' }, acknowledgement);
    expect(acknowledgement).toHaveBeenCalledWith(null, { ok: true });
  });
});
