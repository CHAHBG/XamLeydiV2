// Utility to normalize legacy/variant property keys from Parcels_collectives
export function normalizeProperties(raw: Record<string, any> | string | undefined) {
  const props = typeof raw === 'string' ? (() => {
    try { return JSON.parse(raw) as Record<string, any>; } catch (e) { return {}; }
  })() : (raw || {});

  // Build a cleaned view of properties where trailing _col / _COL suffixes are removed.
  // Keep the original `props` object intact and return it as `original` at the end so
  // callers that need raw data still have access. Use `propsToUse` for normalization logic.
  const cleanedProps: Record<string, any> = {};
  for (const k of Object.keys(props)) {
    const v = props[k];
    // remove trailing _col (case-insensitive) and trim whitespace
    const cleanedKey = String(k).replace(/_col$/i, '').trim();
    // prefer existing cleaned key only if undefined to avoid overwriting more specific variants
    if (!(cleanedKey in cleanedProps)) cleanedProps[cleanedKey] = v;
  }
  const propsToUse = cleanedProps;

  const mandataire: Record<string, any> = {};
  const affectMap: Record<number, Record<string, any>> = {};

  for (const key of Object.keys(propsToUse)) {
    const value = propsToUse[key];
    if (value === null || value === undefined) continue;
    const k = key.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');

    // Mandataire explicit fields
    if (k.includes('prenomm') || k === 'prenom_m' || k === 'prenommandat' || (k.includes('mandataire') && k.includes('prenom'))) {
      mandataire.prenom = String(value);
      continue;
    }
    if (k.includes('nomm') || k === 'nom_m' || k === 'nommandat' || (k.includes('mandataire') && k.includes('nom'))) {
      mandataire.nom = String(value);
      continue;
    }
    if ((k.includes('date') && k.includes('nais')) && (k.includes('m') || k.includes('mandat') || k.includes('mand'))) {
      mandataire.date_naiss = String(value);
      continue;
    }

    // Map birthplace / lieu de naissance (various key variants) to mandataire.lieu for easier access
    if ((k.includes('lieu') || k.includes('lieux')) && (k.includes('nai') || k.includes('naiss') || k.includes('nais') || k.includes('naissance'))) {
      mandataire.lieu = mandataire.lieu || String(value);
      continue;
    }

    // Map mandataire telephone variants to mandataire.telephone when clearly about the mandataire
    // This avoids confusing a single mandataire phone with aggregated affectataire lists.
    if (k.includes('telephon') || k.includes('telephone')) {
      // Prefer explicit mandataire-marked keys or Telephon2 pattern
      if (k.includes('_m') || k.endsWith('m') || k.includes('mandat') || k.includes('mndt') || k === 'telephon2' || k === 'telephone_m' || k === 'telephon_m') {
        mandataire.telephone = mandataire.telephone || String(value);
        continue;
      }
      // If a single telephone value and not a newline-separated aggregated list, and mandataire empty, set it
      if (!String(value).includes('\n') && !mandataire.telephone) {
        mandataire.telephone = String(value);
        continue;
      }
    }

    // Detect indexed affectataire fields by trailing number (e.g., prenom_001, nom2, Date_nai3)
    const match = key.match(/(\d{1,3})$/);
    const idx = match ? Number(match[1].replace(/^0+/, '') || match[1]) : null;
    if (idx !== null && !Number.isNaN(idx)) {
      const low = key.toLowerCase();
      const slot = affectMap[idx] = affectMap[idx] || {};
      if (low.includes('prenom')) slot.prenom = String(value);
      else if (low.includes('nom')) slot.nom = String(value);
      else if ((low.includes('date') || low.includes('dat')) && (low.includes('nai') || low.includes('nais') || low.includes('naiss'))) slot.date_naiss = String(value);
      else if (low.includes('sex') || low.includes('sexe')) slot.sexe = String(value);
      else if (low.includes('num') && (low.includes('piec') || low.includes('piece') || low.includes('num'))) slot.numero_piece = String(value);
      else if (low.includes('telephon') || low.includes('telephone')) slot.telephone = String(value);
      else if (low.includes('resid') || low.includes('residence')) slot.residence = String(value);
      continue;
    }

    // Non-indexed aggregated lists (e.g., Prenom: "A\nB\nC")
  if (k.startsWith('prenom') && String(value).includes('\n')) {
      const parts = String(value).split('\n').map(s => s.trim()).filter(Boolean);
      parts.forEach((p, i) => {
        const n = i + 1;
        const slot = affectMap[n] = affectMap[n] || {};
        if (!slot.prenom) slot.prenom = p;
      });
      continue;
    }
  if (k.startsWith('nom') && String(value).includes('\n')) {
      const parts = String(value).split('\n').map(s => s.trim()).filter(Boolean);
      parts.forEach((p, i) => {
        const n = i + 1;
        const slot = affectMap[n] = affectMap[n] || {};
        if (!slot.nom) slot.nom = p;
      });
      continue;
    }

    // Aggregated lists for telephone, num_piece, date_naiss, residence, sexe
  if ((k.startsWith('telephone') || k.includes('telephon')) && String(value).includes('\n')) {
      const parts = String(value).split('\n').map(s => s.trim()).filter(Boolean);
      parts.forEach((p, i) => {
        const n = i + 1;
        const slot = affectMap[n] = affectMap[n] || {};
        if (!slot.telephone) slot.telephone = p;
      });
      continue;
    }
  if ((k.includes('num') && (k.includes('piec') || k.includes('piece'))) && String(value).includes('\n')) {
      const parts = String(value).split('\n').map(s => s.trim()).filter(Boolean);
      parts.forEach((p, i) => {
        const n = i + 1;
        const slot = affectMap[n] = affectMap[n] || {};
        if (!slot.numero_piece) slot.numero_piece = p;
      });
      continue;
    }
  if ((k.includes('date') || k.includes('dat')) && (k.includes('nai') || k.includes('naiss') || k.includes('nais')) && String(value).includes('\n')) {
      const parts = String(value).split('\n').map(s => s.trim()).filter(Boolean);
      parts.forEach((p, i) => {
        const n = i + 1;
        const slot = affectMap[n] = affectMap[n] || {};
        if (!slot.date_naiss) slot.date_naiss = p;
      });
      continue;
    }
    if ((k.includes('resid') || k.includes('residence')) && String(value).includes('\n')) {
      const parts = String(value).split('\n').map(s => s.trim()).filter(Boolean);
      parts.forEach((p, i) => {
        const n = i + 1;
        const slot = affectMap[n] = affectMap[n] || {};
        if (!slot.residence) slot.residence = p;
      });
      continue;
    }
    if ((k.includes('sex') || k.includes('sexe')) && String(value).includes('\n')) {
      const parts = String(value).split('\n').map(s => s.trim()).filter(Boolean);
      parts.forEach((p, i) => {
        const n = i + 1;
        const slot = affectMap[n] = affectMap[n] || {};
        if (!slot.sexe) slot.sexe = p;
      });
      continue;
    }

    // Common single-name keys
    if (k === 'prenom') mandataire.prenom = mandataire.prenom || String(value);
    if (k === 'nom') mandataire.nom = mandataire.nom || String(value);

    // Denomination / entreprise
    if (k.includes('denominat') || k.includes('denomination') || k.includes('denomin')) {
      mandataire.denominat = mandataire.denominat || String(value);
    }

    // Cas de personne (collectif indicator)
    if (k.includes('cas_de_personne') || k.includes('casdepersonne') || k.includes('casde')) {
      mandataire.cas_de_personne = (mandataire.cas_de_personne || String(value));
    }
  }

  // Convert affectMap to ordered array
  const affectataires = Object.keys(affectMap)
    .map(n => ({ idx: Number(n), ...affectMap[Number(n)] }))
    .sort((a, b) => a.idx - b.idx)
    .map(({ idx, ...rest }) => rest);

  // Try cleaned props first, then fall back to original raw props for legacy variants
  const countFromProps = (propsToUse as any).Quel_est_le_nombre_d_affectata || (propsToUse as any).Quel_est_le_nombre_d_affectata_001 || (propsToUse as any).nombre_affectataires || (props as any).Quel_est_le_nombre_d_affectata || (props as any).Quel_est_le_nombre_d_affectata_001 || (props as any).nombre_affectataires || null;
  const affectairesCount = Number(countFromProps) || affectataires.length || 0;

  return {
    original: props,
    mandataire,
    affectataires,
    affectatairesCount: affectairesCount,
  };
}

export default normalizeProperties;
