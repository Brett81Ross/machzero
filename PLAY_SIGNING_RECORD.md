# MachZero™ Google Play Signing Record

## Upload-key identity

- Package: `com.cactusbyte.machzero`
- Upload-key alias: `machzero-upload`
- Created: 2026-10-13
- Certificate validity: 2026-10-13 through 2054-02-28
- Certificate SHA-256 fingerprint: `15:9F:D9:72:49:A9:B5:05:4A:46:51:24:2F:4E:12:FD:77:B0:70:AE:47:5F:B5:75:FF:68:06:CD:49:E0:56:88`

## First signed Play candidate

- Version: `1.4.2`
- Version code: `1`
- Signed AAB SHA-256: `85e5c05f697087f2919d488fbdf4301cf6175f94deadbcf384d87f40ee5fe930`
- Signature verification: `jar verified`

## Private-key handling

The upload keystore, keystore password, key password, and base64-encoded keystore are intentionally **not stored in this repository**.

The GitHub Actions workflow expects these repository secrets for future signed AABs:

- `MACHZERO_UPLOAD_KEYSTORE_B64`
- `MACHZERO_UPLOAD_KEY_ALIAS`
- `MACHZERO_UPLOAD_KEYSTORE_PASSWORD`
- `MACHZERO_UPLOAD_KEY_PASSWORD`

Do not rotate or replace the MachZero upload key casually. Preserve the private backup outside GitHub.
