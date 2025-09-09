import { getDisplayNameForParcel } from '../src/utils/displayHelpers';

describe('getDisplayNameForParcel', () => {
  it('prefers mandataire from properties object', () => {
    const row = { properties: JSON.stringify({ Prenom_M: 'FILY', Nom_M: 'BAMBARA' }), Num_parcel: '1312010205587' };
    const name = getDisplayNameForParcel(row);
    expect(name).toContain('FILY');
    expect(name).toContain('BAMBARA');
  });

  it('falls back to parcel number if no names', () => {
    const row = { Num_parcel: '0001', properties: '{}' };
    expect(getDisplayNameForParcel(row)).toBe('0001');
  });
});
