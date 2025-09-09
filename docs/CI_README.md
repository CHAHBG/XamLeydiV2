# CI: Build prebuilt DB and optional EAS build

This CI workflow (`.github/workflows/build-and-bundle-db.yml`) does two things:

1. Generates SQL from the JSON parcel files and imports it into `prebuilt/parcelapp.db`.
2. Optionally triggers an EAS build (requires `EAS_TOKEN` secret).

How it runs
- Trigger: manual (`workflow_dispatch`) or a push to the `release` branch.

Required repository secrets (for EAS build step):
- `EAS_TOKEN` - an EAS token with permission to create builds for this Expo project.

Notes
- The workflow uploads `prebuilt/parcelapp.db` as an artifact. If you want the workflow to commit the generated DB into the repo, replace the upload step with a commit action (not recommended for large binaries).
- The EAS build step only runs if `EAS_TOKEN` is present.

Release upload
- The workflow will create a draft GitHub Release and attach the produced APK as an asset. The workflow uses `jq` and the `eas build --wait --json` flow to locate and download the APK. Ensure the runner has `jq` available (ubuntu-latest includes it by default).

Local equivalent commands
1. Generate seed SQL from JSON

```powershell
npm run generate-seed-sql
```

2. Import seed SQL into `prebuilt/parcelapp.db` (requires sqlite3 npm package)

```powershell
npm install sqlite3
node scripts/import_seed_sql.js
```

3. Trigger EAS build (optional — requires `eas-cli` and login)

```powershell
npm install -g eas-cli
# login: eas login
eas build --platform android --profile production
```

Troubleshooting
- If the workflow fails at the `npm ci` step, ensure `package-lock.json` is present and dependencies are resolvable on Ubuntu.
- If the EAS build step fails, check that `EAS_TOKEN` is set in repository secrets and has necessary permissions.

Contact
- If you want me to extend the workflow to upload the artifact to an internal server or push the DB to a release branch automatically, tell me and I will implement it.
