// Utility to normalize legacy/variant property keys from Parcels_collectives
export function normalizeProperties(raw: Record<string, any> | string | undefined) {
  const props = typeof raw === 'string' ? (() => {
    try { return JSON.parse(raw) as Record<string, any>; } catch (e) { return {}; }
  })() : (raw || {});

  const foldKey = (s: string) => {
    // Lowercase + remove accents/diacritics + remove whitespace/punct for tolerant matching.
    // Use explicit unicode range for RN compatibility.
    return String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9_]/g, '');
  };

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

  // Canonicalize common administrative place fields (region / department / commune)
  const pickProp = (variants: string[]) => {
    for (const v of variants) {
      if ((propsToUse as any)[v] !== undefined && (propsToUse as any)[v] !== null) return String((propsToUse as any)[v]).trim();
      if ((props as any)[v] !== undefined && (props as any)[v] !== null) return String((props as any)[v]).trim();
      // also check case-insensitive cleaned keys
      const folded = foldKey(v);
      for (const k of Object.keys(propsToUse)) {
        if (foldKey(k) === folded && (propsToUse as any)[k] !== undefined && (propsToUse as any)[k] !== null) return String((propsToUse as any)[k]).trim();
      }
      for (const k of Object.keys(props)) {
        if (foldKey(k) === folded && (props as any)[k] !== undefined && (props as any)[k] !== null) return String((props as any)[k]).trim();
      }
    }
    return null;
  };

  const pickByHeuristic = (match: (foldedKey: string) => boolean) => {
    for (const k of Object.keys(propsToUse)) {
      const fk = foldKey(k);
      if (!match(fk)) continue;
      const v = (propsToUse as any)[k];
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
    }
    for (const k of Object.keys(props)) {
      const fk = foldKey(k);
      if (!match(fk)) continue;
      const v = (props as any)[k];
      if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
    }
    return null;
  };

  const canonicalRegion =
    pickProp(['regionSenegal', 'region_senegal', 'Region', 'region', 'région', 'regionSene', 'regionsene', 'regionSen', 'regionSen'])
    || pickByHeuristic((k) => k.includes('region'));

  const canonicalDepartment =
    pickProp(['departmentSenegal', 'department_senegal', 'departementSenegal', 'departement_senegal', 'Department', 'department', 'Departement', 'departement', 'departementSen', 'departmentSen'])
    || pickByHeuristic((k) => k.includes('depart'));

  const canonicalArrondissement =
    pickProp(['arrondissementSenegal', 'arrondissement_senegal', 'Arrondissement', 'arrondissement', 'arrond', 'arrondisse'])
    || pickByHeuristic((k) => k.includes('arrond'));

  const canonicalCommune =
    pickProp(['communeSenegal', 'commune_senegal', 'Commune', 'commune', 'communeSen', 'communesen', 'commune_sen'])
    || pickByHeuristic((k) => k.includes('commune'));

  const canonicalGrappe =
    pickProp(['grappeSenegal', 'grappe_senegal', 'Grappe', 'grappe', 'grappeSen', 'grappesen'])
    || pickByHeuristic((k) => k.includes('grappe'));

  return {
    original: props,
    mandataire,
    affectataires,
    affectatairesCount: affectairesCount,
    // canonical administrative fields
    region: canonicalRegion || null,
    Region: canonicalRegion || null,
    department: canonicalDepartment || null,
    Department: canonicalDepartment || null,
    commune: canonicalCommune || null,
    Commune: canonicalCommune || null,

    // Also expose the app's canonical DB keys (used by other screens/components)
    regionSenegal: canonicalRegion || null,
    departmentSenegal: canonicalDepartment || null,
    arrondissementSenegal: canonicalArrondissement || null,
    communeSenegal: canonicalCommune || null,
    grappeSenegal: canonicalGrappe || null,
  };
}

export default normalizeProperties;
