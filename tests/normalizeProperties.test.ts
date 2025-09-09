import normalizeProperties from '../src/utils/normalizeProperties';

describe('normalizeProperties', () => {
  it('parses aggregated Prenom/Nom newline lists into affectataires', () => {
    const raw = {
      Prenom: 'Alice\nBob\nCharlie',
      Nom: 'A\nB\nC',
      Telephone: '111\n222\n333',
      Quel_est_le_nombre_d_affectata: '3'
    };

    const res = normalizeProperties(raw);
  expect(res.affectataires.length).toBe(3);
  expect((res.affectataires[1] as any).prenom).toBe('Bob');
  expect((res.affectataires[2] as any).telephone).toBe('333');
    expect(res.affectatairesCount).toBe(3);
  });

  it('maps indexed fields like Prenom_001 / Nom_002 into ordered affectataires', () => {
    const raw = {
      'Prenom_001': 'X',
      'Nom_001': 'Y',
      'Prenom_2': 'A',
      'Nom_2': 'B'
    };
    const res = normalizeProperties(raw);
  expect(res.affectataires.length).toBe(2);
  expect((res.affectataires[0] as any).prenom).toBe('X');
  expect((res.affectataires[1] as any).nom).toBe('B');
  });
});
