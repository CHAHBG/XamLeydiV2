Supabase integration

This project supports optional remote submission of complaints to a Supabase table named `complaints`.

1) Configure credentials
- Create a local `.env` file (DO NOT commit it) or add environment variables in your build/CI pipeline.
- See `.env.example` for variable names:
  - `REACT_APP_SUPABASE_URL`
  - `REACT_APP_SUPABASE_ANON_KEY`

2) Local dev
- Add a `.env` file at the repo root with the two variables. Example:

  REACT_APP_SUPABASE_URL=https://uuobhwrfyyjcezpfeixl.supabase.co
  REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJ...

- Start the app with your environment variables available to Metro. Many dev setups automatically inject process.env.* when starting with `react-native start` or `expo start`.

3) Production / EAS
- Use EAS secrets to provide the values at build time rather than committing them.
- Example:
  eas secret:create --name REACT_APP_SUPABASE_URL --value "https://..."
  eas secret:create --name REACT_APP_SUPABASE_ANON_KEY --value "..."

4) Behavior
- When configured, the app will attempt to submit complaints to Supabase after saving locally.
- Unsent complaints are retried in background every 60 seconds.
- You can also manually send a complaint from the form ("Envoyer" button) or from the edit screen.

5) Table schema
- The app expects a `public.complaints` table with at least the columns used in the INSERT payload. A sample SQL is available in your earlier conversation logs. Ensure the table allows inserts from your anon key or use Row Level Security policies accordingly.
