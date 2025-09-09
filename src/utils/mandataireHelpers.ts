// Small helper to compute mandataire display values from parcel properties
export function computeMandataireFromProps({ propsObj = {}, props = {}, normalizedProps = null, affectatairesMerged = null }: any) {
  const firstFromMerged = (val: any) => {
    if (!val) return null;
    const s = String(val || '').split('\n')[0] || null;
    return s && s !== '-' ? s : null;
  };

  const getBest = (sources: any[], placeholder = 'Non disponible') => {
    for (const s of sources) {
      if (s !== undefined && s !== null && s !== '' && s !== 'N/A') return String(s);
    }
    return placeholder;
  };

  const prenom = getBest([normalizedProps?.mandataire?.prenom, props?.Prenom_M, propsObj?.Prenom_M, firstFromMerged(affectatairesMerged?.Prenom)], '');
  const nom = getBest([normalizedProps?.mandataire?.nom, props?.Nom_M, propsObj?.Nom_M, firstFromMerged(affectatairesMerged?.Nom)], '');
  const date = props?.Date_nai || props?.Date_naiss || propsObj?.Date_nai || propsObj?.Date_naiss || firstFromMerged(affectatairesMerged?.Date_naissance) || null;
  const age = date ? (2025 - parseInt(String(date).slice(0, 4), 10)) : null;
  const sexe = getBest([props?.Sexe_Mndt, propsObj?.Sexe_Mndt, firstFromMerged(affectatairesMerged?.Sexe)], '');
  const numPiece = getBest([props?.Num_piec, propsObj?.Num_piec, firstFromMerged(affectatairesMerged?.Numero_piece)], '');
  const telephone = getBest([props?.Telephon2, propsObj?.Telephon2, firstFromMerged(affectatairesMerged?.Telephone)], '');
  const lieu = getBest([props?.Lieu_nais, propsObj?.Lieu_nais, props?.Lieu_resi2, propsObj?.Lieu_resi2, firstFromMerged(affectatairesMerged?.Residence)], '');

  return {
    prenom: prenom || '',
    nom: nom || '',
    age: age !== null && !Number.isNaN(age) ? `${age}` : null,
    sexe: sexe || '',
    numPiece: numPiece || '',
    telephone: telephone || '',
    lieu,
  };
}

export default computeMandataireFromProps;
