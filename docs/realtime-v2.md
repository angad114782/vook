# Realtime v2 contract

API mode connects through Socket.IO at `/socket.io` with browser credentials. One connection is shared per tab; authorization and tenant membership come from the secure session.

## Client events

| Event | Payload | Acknowledgement |
| --- | --- | --- |
| `support:join` | `{ ticketId }` | Optional `{ ok }` |
| `support:leave` | `{ ticketId }` | None |
| `support:comment` | `{ ticketId, body, clientMessageId }` | `{ ok, comment?, code?, message? }` |
| `support:typing` | `{ ticketId, isTyping }` | None |
| `support:read` | `{ ticketId }` | `{ ok, code?, message? }` |
| `support:delivered` | `{ ticketId, messageId }` | Optional `{ ok }` |

`clientMessageId` is unique per sender and makes comment submission idempotent.

## Server events

| Event | Payload |
| --- | --- |
| `notification:created` | Notification DTO |
| `support:comment` | Support comment DTO |
| `support:read:cursor` | `{ ticketId, userId, messageId, at }` |
| `support:delivered:cursor` | `{ ticketId, userId, messageId, at }` |
| `support:presence` | `{ ticketId, userId, online }` |
| `support:typing` | `{ ticketId, userId, name, isTyping }` |
| `support:ticket-updated` | `{ ticketId, status, priority, updatedAt }` |

The client rejoins visible ticket rooms and refetches notifications after reconnect. The server must reject unauthorized rooms and ignore tenant/author identity supplied by clients.
