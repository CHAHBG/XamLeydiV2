import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, SafeAreaView, useWindowDimensions, Alert } from 'react-native';
import { TouchableOpacity, TextInput } from 'react-native';
import DatabaseManager from '../data/database';
import theme from '../theme';

export default function DebugScreen() {
  const windowDimensions = useWindowDimensions();
  const [stats, setStats] = useState<any>(null);
  const [collectifs, setCollectifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [parcelNum, setParcelNum] = useState('');
  const [foundParcel, setFoundParcel] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    const checkDb = async () => {
      try {
        const test = await DatabaseManager.getAllParcels?.();
        setDbReady(Array.isArray(test));
        setDbError(null);
      } catch (e) {
        setDbReady(false);
        setDbError("La base de données n'est pas prête. Veuillez réessayer plus tard.");
      }
    };
    checkDb();
  }, []);

  useEffect(() => {
    if (!dbReady) {
      setLoading(false);
      return;
    }
    let mounted = true;
    async function load() {
      try {
        const s = await DatabaseManager.getStats();
        const coll = await DatabaseManager.getParcelsByType('collectif');
        if (!mounted) return;
        setStats(s);
        setCollectifs(coll.slice(0, 50));
      } catch (e) {
        console.warn('Debug load error', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [dbReady]);

  const handleFindParcel = async () => {
    setFoundParcel(null);
    if (!dbReady) {
      setDbError("La base de données n'est pas prête. Veuillez réessayer plus tard.");
      return;
    }
    if (!parcelNum || parcelNum.trim().length === 0) return;
    try {
      const p = await DatabaseManager.getParcelByNum(parcelNum.trim());
      setFoundParcel(p);
    } catch (e) {
      console.warn('Find parcel error', e);
    }
  };

  const handleImport = async () => {
    if (!dbReady) {
      setDbError("La base de données n'est pas prête. Veuillez réessayer plus tard.");
      return;
    }
    setImporting(true);
    setImportedCount(null);
    try {
      let last = 0;
      const count = await DatabaseManager.importMissingCollectives((c) => { last = c; setImportedCount(c); });
      setImportedCount(last ?? count ?? 0);
      // reload stats and sample
      const s = await DatabaseManager.getStats();
      const coll = await DatabaseManager.getParcelsByType('collectif');
      setStats(s);
      setCollectifs(coll.slice(0, 50));
    } catch (e) {
      console.warn('Import error', e);
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={[styles.container, { backgroundColor: theme.appColors.background }]} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Debug DB</Text>
          <Text style={styles.cardSubtitle}>Parcel statistics and sample collectives</Text>
        </View>
        {dbError ? (
          <Text style={{ color: '#E65100', fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>{dbError}</Text>
        ) : loading ? (
          <Text style={{ color: theme.appColors.subtext }}>Chargement...</Text>
        ) : (
          <View>
            <Text style={styles.stat}>Total parcels: {stats?.totalParcels ?? ''}</Text>
            <Text style={styles.stat}>Individuels: {stats?.individualParcels ?? ''}</Text>
            <Text style={styles.stat}>Collectifs: {stats?.collectiveParcels ?? ''}</Text>

            <View style={styles.divider} />

            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Lookup parcel by number</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <TextInput
                placeholder="Numéro de parcelle"
                value={parcelNum}
                onChangeText={setParcelNum}
                style={[styles.textInput, { flex: 1, backgroundColor: theme.appColors.surface }]}
                placeholderTextColor={theme.appColors.subtext}
                editable={dbReady}
              />
              <TouchableOpacity style={styles.button} onPress={handleFindParcel} disabled={!dbReady}>
                <Text style={styles.buttonText}>Find</Text>
              </TouchableOpacity>
            </View>
            {foundParcel ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontWeight: '700' }}>Found:</Text>
                <Text>id: {String(foundParcel.id)}</Text>
                <Text>num_parcel: {String(foundParcel.num_parcel)}</Text>
                <Text>type: {String(foundParcel.parcel_type)}</Text>
              </View>
            ) : parcelNum.length > 0 ? (
              <Text style={{ color: theme.appColors.subtext, marginTop: 8 }}>No parcel found with that number.</Text>
            ) : null}

            <View style={styles.divider} />

            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Import missing collectives</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <TouchableOpacity style={[styles.button, importing && styles.buttonDisabled]} onPress={handleImport} disabled={importing || !dbReady}>
                <Text style={styles.buttonText}>{importing ? 'Importing...' : 'Import missing collectives'}</Text>
              </TouchableOpacity>
              {importing && <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: theme.appColors.primary, borderTopColor: 'transparent', marginLeft: 8 }} />}
              {importedCount !== null && <Text style={{ marginLeft: 8 }}>{importedCount} inserted</Text>}
            </View>
            
            <View style={styles.divider} />
            
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Database Actions</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <TouchableOpacity 
                style={[styles.button, { flex: 1, marginRight: 8, marginBottom: 8 }]} 
                onPress={async () => {
                  try {
                    await DatabaseManager.seedTestData();
                    alert('Test data seeded successfully');
                    // Reload stats
                    const s = await DatabaseManager.getStats();
                    const coll = await DatabaseManager.getParcelsByType('collectif');
                    setStats(s);
                    setCollectifs(coll.slice(0, 50));
                  } catch (e) {
                    console.error('Error seeding test data:', e);
                    alert(`Error seeding test data: ${e instanceof Error ? e.message : String(e)}`);
                  }
                }}
              >
                <Text style={styles.buttonText}>Seed Test Data</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, { flex: 1, backgroundColor: '#FF9800', marginBottom: 8 }]} 
                onPress={() => {
                  // Confirm before forcing a reseed from JSON since this will clear existing records
                  Alert.alert(
                    'Force reload JSON data',
                    'This will clear existing parcel records on the device and reload from the bundled JSON files. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Force reload', style: 'destructive', onPress: async () => {
                        try {
                          await DatabaseManager.seedData(true);
                          Alert.alert('Success', 'JSON data force-reloaded successfully');
                          // Reload stats
                          const s = await DatabaseManager.getStats();
                          const coll = await DatabaseManager.getParcelsByType('collectif');
                          setStats(s);
                          setCollectifs(coll.slice(0, 50));
                        } catch (e) {
                          console.error('Error seeding JSON data:', e);
                          Alert.alert('Error', `Error seeding JSON data: ${e instanceof Error ? e.message : String(e)}`);
                        }
                      } }
                    ],
                    { cancelable: true }
                  );
                }}
              >
                <Text style={styles.buttonText}>Seed JSON Data (force)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, { flex: 1, backgroundColor: '#4CAF50', marginBottom: 8, marginTop: 8 }]} 
                onPress={async () => {
                  try {
                    const importer = require('../data/importSpecificParcel').default;
                    const result = await importer.importTestParcels();
                    alert(`Imported ${result} test parcel(s) successfully!`);
                    // Reload stats
                    const s = await DatabaseManager.getStats();
                    const coll = await DatabaseManager.getParcelsByType('collectif');
                    setStats(s);
                    setCollectifs(coll.slice(0, 50));
                  } catch (e) {
                    console.error('Error importing test parcels:', e);
                    alert(`Error importing test parcels: ${e instanceof Error ? e.message : String(e)}`);
                  }
                }}
              >
                <Text style={styles.buttonText}>Import Parcel 1312010205587</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, { flex: 1, backgroundColor: '#E91E63', marginBottom: 8, marginTop: 8 }]} 
                onPress={async () => {
                  try {
                    const directInsert = require('../data/directInsert').default;
                    const result = await directInsert.insertSpecificParcel('1312010205587');
                    
                    if (result) {
                      alert('Successfully inserted parcel 1312010205587 directly');
                    } else {
                      alert('Failed to insert parcel directly');
                    }
                    
                    // Reload stats
                    const s = await DatabaseManager.getStats();
                    const coll = await DatabaseManager.getParcelsByType('collectif');
                    setStats(s);
                    setCollectifs(coll.slice(0, 50));
                  } catch (e) {
                    console.error('Error with direct insert:', e);
                    alert(`Error with direct insert: ${e instanceof Error ? e.message : String(e)}`);
                  }
                }}
              >
                <Text style={styles.buttonText}>Direct Insert Parcel 1312010205587</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, { flex: 1, backgroundColor: '#9C27B0', marginBottom: 8, marginTop: 8 }]} 
                onPress={async () => {
                  try {
                    const parcelIDSearch = require('../data/parcelIDSearch').default;
                    const targetID = '1312010205587';
                    
                    alert(`Searching for parcel ${targetID} using specialized search...`);
                    
                    const result = await parcelIDSearch.findParcelByExactID(targetID);
                    
                    if (result) {
                      alert(`FOUND: Parcel ${targetID}!\n\nID: ${result.id}\nType: ${result.parcel_type || 'Unknown'}`);
                    } else {
                      alert(`No parcel found with ID ${targetID} after exhaustive search`);
                    }
                    
                    // Reload stats
                    const s = await DatabaseManager.getStats();
                    const coll = await DatabaseManager.getParcelsByType('collectif');
                    setStats(s);
                    setCollectifs(coll.slice(0, 50));
                  } catch (e) {
                    console.error('Error with specialized search:', e);
                    alert(`Error with specialized search: ${e instanceof Error ? e.message : String(e)}`);
                  }
                }}
              >
                <Text style={styles.buttonText}>Find Parcel 1312010205587 (Special Search)</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Sample collectives (first 50)</Text>
            {collectifs.length === 0 ? (
              <Text style={{ color: theme.appColors.subtext }}>Aucun collectif trouvé.</Text>
            ) : (
              <FlatList
                data={collectifs}
                // Ensure key is never empty; prefer id, then num_parcel, else use the array index
                keyExtractor={(it, idx) => String(it?.id ?? it?.num_parcel ?? `idx-${idx}`)}
                renderItem={React.useCallback(({ item }: { item: any }) => (
                  <View style={styles.row}>
                    <Text style={styles.rowTitle}>{item.num_parcel || item.Num_parcel || ''}</Text>
                    <Text style={styles.rowText}>{(item.prenom_m || item.Prenom_M) || ''} {(item.nom_m || item.Nom_M) || ''}</Text>
                    <Text style={styles.rowSmall}>{item.denominat || item.Denominat || ''}</Text>
                  </View>
                ), [])}
              />
            )}
          </View>
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.appColors.background,
  },
  container: { flex: 1 },
  card: {
    backgroundColor: theme.appColors.surface,
    borderRadius: 16,
    padding: 22,
    shadowColor: theme.appColors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 18,
  },
  cardHeader: {
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.appColors.text,
  },
  cardSubtitle: {
    fontSize: 15,
    color: theme.appColors.subtext,
    marginTop: 2,
  },
  stat: { fontSize: 16, marginBottom: 6 },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    color: theme.appColors.text,
    marginRight: 8,
  },
  button: {
    backgroundColor: theme.appColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc', // fallback disabled color
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowTitle: { fontWeight: '700' },
  rowText: { color: theme.appColors.text },
  rowSmall: { color: theme.appColors.subtext, fontSize: 12 },
});
