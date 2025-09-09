import { computeMandataireFromProps } from '../src/utils/mandataireHelpers';

describe('computeMandataireFromProps', () => {
  it('extracts mandataire fields from props object and computes age', () => {
    const input = {
      propsObj: {
        Prenom_M: 'WALY',
        Nom_M: 'CAMARA',
        Date_nai: '1980-05-01',
        Sexe_Mndt: 'Homme',
        Lieu_nais: 'Dakar',
        Num_piec: '1369201300074',
        Telephon2: '+221700000000'
      },
      props: {},
      normalizedProps: null,
      affectatairesMerged: null
    };

    const out = computeMandataireFromProps(input as any);
    expect(out.prenom).toBe('WALY');
    expect(out.nom).toBe('CAMARA');
    expect(out.telephone).toBe('+221700000000');
    // age anchored to 2025
    expect(out.age).toBe('45');
  });
});
