# Backend separation audit

The legacy `backend/` directory was separated on 2026-09-14 into the local sibling repository `D:\Projects\vook\vti-backend`.

## Pre-move snapshot

- Source/config/test inventory (excluding `node_modules` and `dist`): 169 files.
- Composite SHA-256 over the sorted per-file checksums: `BC276A46DB6C3027A2190DE3DED6070F7363CAA4DD16C9EFF8C6B47B0978F5DE`.
- Working state: 47 modified tracked files and 31 untracked files.
- Local `.env`, `node_modules`, and `dist` were present.

## Verification

- The committed subtree history was extracted at `be97091225` and attached to the sibling repository with a mixed reset.
- The 169-file checksum matched after the move.
- Modified and untracked backend status matched the pre-move snapshot exactly after removing the old `backend/` path prefix.
- The ignored local `.env`, `node_modules`, and `dist` were retained in the sibling repository.
- The two legacy backend documents were then moved into the sibling repository, adding only `API_V1_BREAKING_CHANGE.md` and `COMPLIANCE_BASELINE.md` to its untracked status.
- The sibling repository has no configured remote, new commit, or push.
- The temporary extraction branch was removed from the frontend repository after verification.

This file contains no environment values or credentials.
