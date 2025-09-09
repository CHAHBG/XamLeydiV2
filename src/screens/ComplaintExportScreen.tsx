import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform, TouchableOpacity, SafeAreaView, useWindowDimensions } from 'react-native';
import { TextInput, Text, Modal as RNModal } from 'react-native';
import * as FileSystem from 'expo-file-system';
import DatabaseManager from '../data/database';
import COMMUNES from '../constants/communes';

export default function ComplaintExportScreen() {
  const windowDimensions = useWindowDimensions();
  const [exporting, setExporting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [commune, setCommune] = useState('');
  const [communes, setCommunes] = useState<string[]>([]);
  const [filename, setFilename] = useState('Plainte');
  const [destination, setDestination] = useState<'cache' | 'documents'>('cache');
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const [currentBrowsePath, setCurrentBrowsePath] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<Array<{ name: string; path: string; isDirectory: boolean }>>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Date picker state
  const [customPickingFor, setCustomPickingFor] = useState<null | 'start' | 'end'>(null);
  const now = new Date();
  const currentYear = now.getFullYear();
  const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  const [customYear, setCustomYear] = useState(currentYear);
  const [customMonth, setCustomMonth] = useState(now.getMonth() + 1);
  const [customDay, setCustomDay] = useState(now.getDate());

  useEffect(() => {
    const checkDb = async () => {
      try {
        const test = await (DatabaseManager as any).getAllParcels?.();
        setDbReady(Array.isArray(test));
        setDbError(null);
      } catch (e) {
        setDbReady(false);
        setDbError("La base de données n'est pas prête. Veuillez réessayer plus tard.");
      }
    };
    checkDb();
    setCommunes(COMMUNES as string[]);
  }, []);

  const parseYMD = (iso?: string) => {
    if (!iso) return { y: currentYear, m: now.getMonth() + 1, d: now.getDate() };
    const parts = iso.split('-').map(Number);
    return { y: parts[0] || currentYear, m: parts[1] || (now.getMonth() + 1), d: parts[2] || now.getDate() };
  };

  const openCustomFor = (which: 'start' | 'end') => {
    const parsed = parseYMD(which === 'start' ? startDate : endDate);
    setCustomYear(parsed.y); setCustomMonth(parsed.m); setCustomDay(parsed.d);
    setCustomPickingFor(which);
  };
  const cancelCustom = () => setCustomPickingFor(null);
  const confirmCustom = () => {
    const iso = `${String(customYear).padStart(4,'0')}-${String(customMonth).padStart(2,'0')}-${String(customDay).padStart(2,'0')}`;
    if (customPickingFor === 'start') setStartDate(iso);
    if (customPickingFor === 'end') setEndDate(iso);
    setCustomPickingFor(null);
  };

  const handleClearFilters = () => { setStartDate(''); setEndDate(''); setCommune(''); };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!dbReady) { Alert.alert('Erreur', "La base de données n'est pas prête."); return; }
    if (startDate && endDate && startDate > endDate) { Alert.alert('Erreur', 'La date de début doit être antérieure à la date de fin.'); return; }
    setExporting(true);
    try {
      const options: any = {};
      if (startDate) options.startDate = startDate;
      if (endDate) options.endDate = endDate;
      if (commune) options.commune = commune;

      const data = await DatabaseManager.exportComplaints(format, options);
      if (!data || (format === 'csv' && data.split('\n').length <= 1)) { Alert.alert('Info', 'Aucune donnée à exporter avec les filtres.'); setExporting(false); return; }

      const basename = (filename && filename.trim()) ? filename.trim() : `plaintes_${new Date().toISOString().slice(0,10)}`;
      const exportFilename = `${basename}.${format}`;
      let fileUri = '';

      if (selectedFolder) {
        // If selectedFolder looks like a content URI (SAF on Android), try to use StorageAccessFramework
        if (String(selectedFolder).startsWith('content://') && (FileSystem as any).StorageAccessFramework) {
          try {
            const SAF = (FileSystem as any).StorageAccessFramework;
            const mime = format === 'csv' ? 'text/csv' : 'application/json';
            const created = await SAF.createFileAsync(selectedFolder, exportFilename, mime);
            // created is a URI we can try to write to
            await FileSystem.writeAsStringAsync(created, data, { encoding: FileSystem.EncodingType.UTF8 });
            fileUri = created;
          } catch (safErr) {
            console.warn('SAF write failed, falling back to path write:', safErr);
            const base = selectedFolder.endsWith('/') ? selectedFolder : selectedFolder + '/';
            fileUri = base + exportFilename;
            await FileSystem.writeAsStringAsync(fileUri, data, { encoding: FileSystem.EncodingType.UTF8 });
          }
        } else {
          const base = selectedFolder.endsWith('/') ? selectedFolder : selectedFolder + '/';
          fileUri = base + exportFilename;
          await FileSystem.writeAsStringAsync(fileUri, data, { encoding: FileSystem.EncodingType.UTF8 });
        }
      } else {
        const base = destination === 'cache' ? FileSystem.cacheDirectory : FileSystem.documentDirectory;
        fileUri = (base ?? FileSystem.cacheDirectory) + exportFilename;
        await FileSystem.writeAsStringAsync(fileUri, data, { encoding: FileSystem.EncodingType.UTF8 });
      }

      try {
        const info = await FileSystem.getInfoAsync(fileUri);
        if (!info.exists) { Alert.alert('Erreur', `Fichier introuvable: ${fileUri}`); setExporting(false); return; }
      } catch (e) { }

      Alert.alert('Export réussi', `Fichier enregistré: ${fileUri}\nFormat: ${format.toUpperCase()}`);
    } catch (e: any) {
      console.error('Export error:', e);
      Alert.alert('Erreur', `L'export a échoué: ${String(e?.message || e)}`);
    }
    setExporting(false);
  };

  const handlePickFolder = async () => {
    // Try Storage Access Framework on Android (expo-file-system exposes StorageAccessFramework)
    try {
      if (Platform.OS === 'android' && (FileSystem as any).StorageAccessFramework) {
        try {
          const SAF = (FileSystem as any).StorageAccessFramework;
          const uri = await SAF.requestDirectoryPermissionsAsync();
          if (uri && uri.granted && uri.directoryUri) {
            // directoryUri is a content:// URI to the picked folder
            setSelectedFolder(uri.directoryUri);
            Alert.alert('Dossier sélectionné', `Dossier: ${uri.directoryUri}`);
            return;
          }
        } catch (safErr) {
          console.warn('SAF directory picker failed:', safErr);
          // fall through to in-app picker
        }
      }

      // Fallback: open in-app folder picker rooted at documentDirectory (fallback to cache)
      const base = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const root = base.endsWith('/') ? base : base + '/';
      setCurrentBrowsePath(root);
      setFolderPickerVisible(true);
      await readFolder(root);
    } catch (err) {
      console.error('Pick/create folder error:', err);
      Alert.alert('Erreur', 'Impossible d\'ouvrir le sélecteur de dossier');
    }
  };

  const readFolder = async (path: string) => {
    try {
      const list = await FileSystem.readDirectoryAsync(path);
      const entries = await Promise.all(list.map(async (name) => {
        const p = path + (path.endsWith('/') ? '' : '/') + name;
        try {
          const info = await FileSystem.getInfoAsync(p);
          return { name, path: p + (info.isDirectory ? '/' : ''), isDirectory: Boolean(info.isDirectory) };
        } catch (e) {
          return { name, path: p, isDirectory: false };
        }
      }));
      // only directories
      const dirs = entries.filter(e => e.isDirectory).sort((a,b) => a.name.localeCompare(b.name));
      setFolderEntries(dirs);
    } catch (e) {
      console.warn('readFolder failed', e);
      setFolderEntries([]);
    }
  };

  const navigateInto = async (entry: { name: string; path: string; isDirectory: boolean }) => {
    if (!entry.isDirectory) return;
    const next = entry.path;
    setCurrentBrowsePath(next);
    await readFolder(next);
  };

  const navigateUp = async () => {
    if (!currentBrowsePath) return;
    const p = String(currentBrowsePath).replace(/\\/g, '/');
    const docRoot = (FileSystem.documentDirectory || '').replace(/\\/g, '/');
    const cacheRoot = (FileSystem.cacheDirectory || '').replace(/\\/g, '/');
    if (p === docRoot || p === cacheRoot) return; // already at root
    const trimmed = p.endsWith('/') ? p.slice(0, -1) : p;
    const parent = trimmed.split('/').slice(0, -1).join('/') + '/';
    setCurrentBrowsePath(parent);
    await readFolder(parent);
  };

  const createNewFolder = async () => {
    if (!currentBrowsePath || !newFolderName) return;
    try {
      const newPath = currentBrowsePath + (currentBrowsePath.endsWith('/') ? '' : '/') + newFolderName + '/';
      await FileSystem.makeDirectoryAsync(newPath, { intermediates: true });
      setNewFolderName('');
      await readFolder(currentBrowsePath);
    } catch (e) {
      console.warn('createNewFolder failed', e);
      Alert.alert('Erreur', 'Impossible de créer le dossier');
    }
  };

  const selectCurrentFolder = () => {
    if (!currentBrowsePath) return;
    setSelectedFolder(currentBrowsePath);
    setFolderPickerVisible(false);
    Alert.alert('Dossier sélectionné', `Dossier: ${currentBrowsePath}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>Exporter les plaintes</Text>
          <Text style={styles.subtitle}>Choisissez la période, la commune et le format puis appuyez sur Exporter</Text>
        </View>

        <View style={styles.card}>
          {dbError ? <Text style={{ color: '#E65100', fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>{dbError}</Text> : null}

          <View style={styles.filtersRow}>
            <TouchableOpacity style={[styles.inputLike, { flex: 1, marginRight: 8 }]} onPress={() => openCustomFor('start')}>
              <Text style={styles.inputLikeText}>{startDate || 'Date début'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.inputLike, { flex: 1 }]} onPress={() => openCustomFor('end')}>
              <Text style={styles.inputLikeText}>{endDate || 'Date fin'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginVertical: 8 }}>
            <TouchableOpacity style={styles.inputLike} onPress={() => setMenuVisible(true)}>
              <Text style={styles.inputLikeText}>{commune || 'Filtrer par commune'}</Text>
            </TouchableOpacity>
            <RNModal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
              <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
                <View style={styles.dropdownMenu}>
                  <TouchableOpacity onPress={() => { setCommune(''); setMenuVisible(false); }} style={styles.dropdownItem}><Text>Toutes</Text></TouchableOpacity>
                  {communes.map((c) => (<TouchableOpacity key={c} onPress={() => { setCommune(c); setMenuVisible(false); }} style={styles.dropdownItem}><Text>{c}</Text></TouchableOpacity>))}
                </View>
              </TouchableOpacity>
            </RNModal>
          </View>

          <View style={styles.filenameRow}>
            <TextInput value={filename} onChangeText={v => setFilename(v)} style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="Nom du fichier" placeholderTextColor="#888" />
            <TouchableOpacity style={styles.outlinedButton} onPress={handlePickFolder}><Text style={styles.outlinedButtonText}>{selectedFolder ? 'Dossier ✓' : 'Choisir dossier'}</Text></TouchableOpacity>
          </View>

          <Text style={styles.small}>{selectedFolder ? `Sélection: ${selectedFolder}` : `Destination: ${destination === 'cache' ? 'cache' : 'documents'}`}</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.exportBtn, styles.filledButtonLarge]} onPress={() => handleExport('csv')} disabled={exporting || !dbReady}><Text style={styles.filledButtonText}>{exporting ? 'Export...' : 'Exporter CSV'}</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.exportBtn, styles.filledButtonLarge, { marginLeft: 8 }]} onPress={() => handleExport('json')} disabled={exporting || !dbReady}><Text style={styles.filledButtonText}>{exporting ? 'Export...' : 'Exporter JSON'}</Text></TouchableOpacity>
          </View>

          <View style={{ marginTop: 12 }}>
            <TouchableOpacity style={[styles.outlinedButton, { alignSelf: 'flex-start' }]} onPress={handleClearFilters}><Text style={[styles.outlinedButtonText]}>Effacer filtres</Text></TouchableOpacity>
          </View>
        </View>

        <RNModal visible={!!customPickingFor} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{customPickingFor === 'start' ? 'Sélectionner date de début' : 'Sélectionner date de fin'}</Text>
              <View style={styles.calendarHeader}>
                <TouchableOpacity style={styles.calendarNavBtn} onPress={() => { setCustomMonth(m => { if (m === 1) { setCustomYear(y => y - 1); return 12; } return m - 1; }); }}><Text style={styles.calendarNavText}>{'<'}</Text></TouchableOpacity>
                <Text style={styles.monthTitle}>{months[customMonth - 1]} {customYear}</Text>
                <TouchableOpacity style={styles.calendarNavBtn} onPress={() => { setCustomMonth(m => { if (m === 12) { setCustomYear(y => y + 1); return 1; } return m + 1; }); }}><Text style={styles.calendarNavText}>{'>'}</Text></TouchableOpacity>
              </View>
              <View style={styles.weekRow}>{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(w => <React.Fragment key={w}><Text style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#666' }}>{w}</Text></React.Fragment>)}</View>
              <View>{(() => {
                const first = new Date(customYear, customMonth - 1, 1).getDay();
                const offset = (first + 6) % 7;
                const dim = new Date(customYear, customMonth, 0).getDate();
                const cells: Array<number | null> = [];
                for (let i = 0; i < offset; i++) cells.push(null);
                for (let d = 1; d <= dim; d++) cells.push(d);
                while (cells.length % 7 !== 0) cells.push(null);
                const rows: Array<Array<number | null>> = [];
                for (let r = 0; r < cells.length / 7; r++) rows.push(cells.slice(r * 7, r * 7 + 7));
                return rows.map((row, ri) => (<React.Fragment key={ri}><View style={{ flexDirection: 'row' }}>{row.map((day, ci) => { const isSelected = day === customDay; return (<TouchableOpacity key={ci} style={[styles.dayCell, isSelected ? styles.selectedDay : null]} onPress={() => day && setCustomDay(day)}><Text style={[styles.dayCellText, isSelected ? { color: 'white' } : {}]}>{day ? String(day) : ''}</Text></TouchableOpacity>); })}</View></React.Fragment>));
              })()}</View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                <TouchableOpacity style={styles.outlinedButton} onPress={cancelCustom}><Text style={styles.outlinedButtonText}>Annuler</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.outlinedButton, { backgroundColor: '#c62828', marginLeft: 8 }]} onPress={confirmCustom}><Text style={[styles.outlinedButtonText, { color: 'white' }]}>OK</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>

        <RNModal visible={folderPickerVisible} transparent animationType="slide" onRequestClose={() => setFolderPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { width: Math.min(400, windowDimensions.width - 40) }]}>
              <Text style={styles.modalTitle}>Sélecteur de dossier</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity onPress={navigateUp} style={styles.outlinedButton}><Text style={styles.outlinedButtonText}>{'⬆'}</Text></TouchableOpacity>
                <Text style={{ fontWeight: '700' }}>{currentBrowsePath}</Text>
                <TouchableOpacity onPress={selectCurrentFolder} style={[styles.outlinedButton, { backgroundColor: '#A02020' }]}><Text style={[styles.outlinedButtonText, { color: '#fff' }]}>Sélectionner</Text></TouchableOpacity>
              </View>
              <View style={{ maxHeight: 260, marginTop: 8 }}>
                <ScrollView>
                  {folderEntries.length === 0 ? <Text style={{ color: '#666', padding: 8 }}>Aucun dossier</Text> : folderEntries.map(fe => (
                    <TouchableOpacity key={fe.path} onPress={() => navigateInto(fe)} style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                      <Text style={{ color: '#333' }}>📁 {fe.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
                <TextInput value={newFolderName} onChangeText={setNewFolderName} placeholder="Nouveau dossier" style={[styles.input, { flex: 1, marginRight: 8 }]} />
                <TouchableOpacity style={styles.outlinedButton} onPress={createNewFolder}><Text style={styles.outlinedButtonText}>Créer</Text></TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                <TouchableOpacity style={styles.outlinedButton} onPress={() => setFolderPickerVisible(false)}><Text style={styles.outlinedButtonText}>Fermer</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  headerCard: { margin: 16, marginBottom: 8 },
  card: { width: '100%', backgroundColor: 'white', padding: 18, borderRadius: 12, elevation: 3, marginBottom: 18 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6, color: '#222' },
  subtitle: { color: '#666', marginTop: 2 },
  filtersRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  inputLike: { backgroundColor: '#f3f4f6', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10 },
  inputLikeText: { color: '#333' },
  filenameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  input: { marginBottom: 8, borderWidth: 1, borderColor: '#eee', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#222', backgroundColor: '#fafafa' },
  outlinedButton: { borderWidth: 1.2, borderColor: '#A02020', borderRadius: 22, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  outlinedButtonText: { color: '#A02020', fontWeight: '700' },
  filledButtonLarge: { backgroundColor: '#A02020', borderRadius: 22, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flex: 1 },
  filledButtonText: { color: '#fff', fontWeight: '700' },
  small: { fontSize: 12, color: '#666', marginTop: 8 },
  actionRow: { flexDirection: 'row', marginTop: 12 },
  exportBtn: { flex: 1 },
  dropdownMenu: { backgroundColor: '#fff', borderRadius: 8, padding: 8, minWidth: 220, elevation: 4 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: 320, backgroundColor: 'white', padding: 16, borderRadius: 8 },
  modalTitle: { fontWeight: '700', marginBottom: 8 },
  calendarNavBtn: { padding: 6 },
  calendarNavText: { fontSize: 18, color: '#c62828', fontWeight: 'bold' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthTitle: { fontWeight: '600' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  dayCell: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  dayCellText: { color: '#222' },
  selectedDay: { backgroundColor: '#c62828', borderRadius: 20 },
});
