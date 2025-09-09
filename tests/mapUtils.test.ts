import { collectFitCoordinates } from '../src/utils/mapUtils';

test('collectFitCoordinates extracts coordinates from Polygon and neighbor features', () => {
  const main = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] };
  const neighbors = [
    { geometry: { type: 'Polygon', coordinates: [[[2,2],[3,2],[3,3],[2,3],[2,2]]] } },
    { geometry: JSON.stringify({ type: 'Polygon', coordinates: [[[4,4],[5,4],[5,5],[4,5],[4,4]]] }) }
  ];

  const coords = collectFitCoordinates(main, neighbors as any);
  expect(coords.length).toBeGreaterThanOrEqual(5 + 5 + 5);
  // Check first and some neighbor point
  expect(coords[0]).toEqual({ latitude: 0, longitude: 0 });
  expect(coords[5]).toEqual({ latitude: 2, longitude: 2 });
});
