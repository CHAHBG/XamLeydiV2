Quick test helper: test_supabase_insert.ps1

Purpose
- A small PowerShell script to test inserting a complaint row into your Supabase `complaints` table using the project's `.env` values (if present) or prompting you for the Supabase URL and anon key.

Usage
- From the repo root, run:
  pwsh .\tools\test_supabase_insert.ps1

Behavior
- If `.env` exists at the repo root and contains `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`, the script uses them.
- Otherwise the script prompts for the values.
- The script performs a POST to `https://<PROJECT>/rest/v1/complaints` using the anon key in both `apikey` and `Authorization: Bearer` headers.
- The script prints the JSON response on success or the HTTP response body on error for debugging.

Security
- Do NOT paste or share your anon key publicly. The script avoids echoing the key, but any logs you copy here should have the key redacted.

Next steps
- If the script returns success, your Supabase schema and RLS permit the insert with the anon key. If the app still fails, capture the device logs and the payload printed by the app's `tryRemoteSubmit` logs to compare.
- If the script returns an error, copy the HTTP response body (redact key) and paste it here; I'll interpret the cause and recommend fixes.