# ParcelApp DB Preparation (Web GUI)

This is a small browser-based GUI to:
1) Upload two `.geojsonl` files (individuels + collectives)
2) Normalize / parse them as GeoJSON Features
3) Generate a downloadable SQLite database `parcelapp.db`

It is designed to be hosted as a static site (Netlify recommended).

## Local dev

```bash
cd db-prep-web
npm install
npm run dev
```

## Build

```bash
cd db-prep-web
npm install
npm run build
npm run preview
```

## Netlify deploy

In Netlify:
- **Base directory**: `db-prep-web`
- **Build command**: `npm run build`
- **Publish directory**: `db-prep-web/dist`

## Output

The generated file downloads as `parcelapp.db`.

To use in the Android app:
- place it at `android/app/src/main/assets/parcelapp.db`
- then build your APK.
