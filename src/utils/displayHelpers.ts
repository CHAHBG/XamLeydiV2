import normalizeProperties from './normalizeProperties';

export function getDisplayNameForParcel(row: any) {
  // row may already include merged keys; prefer explicit mandataire fields
  try {
    const parsed = normalizeProperties(row.properties || row);
    const mand = parsed.mandataire || {};

    // Prefer mandataire full name
    if (mand.prenom || mand.nom) {
      return [mand.prenom || '', mand.nom || ''].map(s => String(s).trim()).filter(Boolean).join(' ') || 'Parcelle collective';
    }

    // Fallback to top-level fields
    const tlPrenom = row.Prenom_M || row.prenom_m || row.prenom || null;
    const tlNom = row.Nom_M || row.nom_m || row.nom || null;
    if (tlPrenom || tlNom) return [tlPrenom, tlNom].filter(Boolean).join(' ');

    // If we have a denomination or company name
    if (row.denominat || row.Denominat) return row.denominat || row.Denominat;

    // Fallback: show parcel number if available
    return row.Num_parcel || row.num_parcel || row.id || 'Parcelle collective';
  } catch (e) {
    return row.Num_parcel || row.num_parcel || row.id || 'Parcelle collective';
  }
}

export default getDisplayNameForParcel;
