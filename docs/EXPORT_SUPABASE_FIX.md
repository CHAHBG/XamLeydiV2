# Fixing Export and Supabase Issues

## Issues Fixed

### 1. **iOS Export Not Working**
**Problem:** Files exported to cache directory on iOS weren't accessible.

**Solution:** 
- iOS exports now save to `documentDirectory` (accessible via Files app)
- Added better error logging
- Added null-safety checks for file paths

### 2. **Supabase Upload Not Working**
**Problem:** Environment variables weren't loaded at runtime.

**Solutions:**
- Created `.env` file (you need to add your real credentials)
- Updated `app.config.js` to pass Supabase config through `extra`
- Changed `App.tsx` to read from `Constants.expoConfig.extra`
- Added logging to verify Supabase is configured

---

## Setup Instructions

### Step 1: Add Your Supabase Credentials

Edit the `.env` file in the project root:

```bash
# Replace with your actual Supabase project values
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...your-actual-anon-key
```

### Step 2: Rebuild the App

Since we changed `app.config.js`, you need to rebuild:

```bash
# Clean and rebuild native projects
npx expo prebuild --clean

# For iOS (in Xcode)
npm run ios:open
# Then build & run in Xcode

# OR use EAS local build
npm run build:ios:local
```

### Step 3: Verify Supabase Connection

When the app starts, check the logs for:

```
[Supabase] Config check: { hasUrl: true, hasKey: true, urlPrefix: 'https://...' }
Supabase client initialized
```

If you see `hasUrl: false` or `hasKey: false`, the environment variables aren't loading.

### Step 4: Test Export

1. Go to "Plaintes" (Complaints) screen
2. Tap export button
3. Choose CSV or JSON
4. On iOS: file will be saved to Documents and you'll see a share dialog
5. Check the console for `[Export] Writing to:` and `[Export] File written successfully`

### Step 5: Test Supabase Upload

1. Create a complaint via the wizard
2. Check logs for:
   - `tryRemoteSubmit: inserting to Supabase...`
   - Complaint should show "validated" status after successful upload

---

## Troubleshooting

### "Supabase not configured"
- Verify `.env` file exists and has correct values
- Run `npx expo prebuild --clean` after changing `.env`
- Check logs for `[Supabase] Config check:`

### "Export failed" on iOS
- Check logs for specific error
- Verify app has file write permissions
- Try deleting app and reinstalling

### Environment Variables Not Loading
If `.env` still doesn't work after rebuild:

**Option 1: Use EAS Secrets (for production)**
```bash
eas secret:create --name REACT_APP_SUPABASE_URL --value "https://..."
eas secret:create --name REACT_APP_SUPABASE_ANON_KEY --value "..."
```

**Option 2: Hardcode temporarily (dev only)**
Edit `app.config.js`:
```javascript
config.extra.REACT_APP_SUPABASE_URL = "https://your-project.supabase.co";
config.extra.REACT_APP_SUPABASE_ANON_KEY = "your-anon-key";
```

---

## Files Changed

1. **`.env`** - Created with template values (you must fill in real credentials)
2. **`app.config.js`** - Now passes Supabase config through `extra`
3. **`App.tsx`** - Reads from Constants instead of broken @env import
4. **`ComplaintExportScreen.tsx`** - Uses documentDirectory on iOS, better error handling

---

## Next Steps

1. Add your real Supabase credentials to `.env`
2. Rebuild with `npx expo prebuild --clean`
3. Test export and upload
4. Check console logs to verify configuration loaded correctly
