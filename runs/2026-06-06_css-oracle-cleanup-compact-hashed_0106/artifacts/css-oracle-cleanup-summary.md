# CSS Oracle Cleanup Summary

- Replaced the full computed-style dump with `artifacts/computed-style-fingerprint.json`.
- The fingerprint stores scenario-level SHA-256 roots over per-selector computed-style subset hashes.
- Regenerated determinism evidence: 10/10 identical fingerprints.
- Re-ran resistance probes: color and spacing mutations both changed the fingerprint.
- Removed tracked oversized derived JSON and added `.sha256` / `.size` stubs for removed run-folder blobs.
- Verified no checked-out CSS files changed.
