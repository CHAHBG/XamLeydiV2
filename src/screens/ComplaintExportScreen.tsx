import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform, TouchableOpacity, SafeAreaView, useWindowDimensions } from 'react-native';
import { TextInput, Text, Modal as RNModal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeMaterialCommunityIcons } from '../components/SafeIcons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import DatabaseManager from '../data/database';
import COMMUNES from '../constants/communes';
import theme from '../theme';

// FileSystem API compatibility
const FS = FileSystem as any;

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
        // If selectedFolder looks like a content URI (SAF on Android), use SAF to create file
        if (String(selectedFolder).startsWith('content://') && (FileSystem as any).StorageAccessFramework) {
          try {
            const SAF = (FileSystem as any).StorageAccessFramework;
            const mime = format === 'csv' ? 'text/csv' : 'application/json';
            const created = await SAF.createFileAsync(selectedFolder, exportFilename, mime);
            await FileSystem.writeAsStringAsync(created, data, { encoding: FS.EncodingType.UTF8 });
            fileUri = created;
            Alert.alert('Export réussi', `Fichier enregistré dans le dossier sélectionné\nFormat: ${format.toUpperCase()}`);
            return;
          } catch (safErr) {
            console.warn('SAF write failed:', safErr);
            Alert.alert('Erreur', 'Impossible d\'écrire dans le dossier sélectionné');
            return;
          }
        } else {
          // Regular file path
          const base = selectedFolder.endsWith('/') ? selectedFolder : selectedFolder + '/';
          fileUri = base + exportFilename;
          await FileSystem.writeAsStringAsync(fileUri, data, { encoding: FS.EncodingType.UTF8 });
        }
      } else {
        // No folder selected: save to cache and offer to share
        const base = FS.cacheDirectory || FS.documentDirectory;
        fileUri = (base ?? FS.cacheDirectory) + exportFilename;
        await FileSystem.writeAsStringAsync(fileUri, data, { encoding: FS.EncodingType.UTF8 });
        
        // Check if sharing is available and offer to share
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          Alert.alert(
            'Export réussi',
            'Voulez-vous partager le fichier ou le conserver en local?',
            [
              {
                text: 'Partager',
                onPress: async () => {
                  try {
                    await Sharing.shareAsync(fileUri, {
                      mimeType: format === 'csv' ? 'text/csv' : 'application/json',
                      dialogTitle: `Partager ${exportFilename}`,
                      UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'public.json'
                    });
                  } catch (shareErr) {
                    console.error('Share error:', shareErr);
                  }
                }
              },
              {
                text: 'Conserver',
                onPress: () => {
                  Alert.alert('Fichier enregistré', `Fichier: ${fileUri}\nFormat: ${format.toUpperCase()}`);
                }
              }
            ]
          );
          return;
        }
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
    try {
      // For Android: Use Storage Access Framework
      if (Platform.OS === 'android') {
        const SAF = (FileSystem as any).StorageAccessFramework;
        if (SAF) {
          try {
            const permissions = await SAF.requestDirectoryPermissionsAsync();
            
            if (permissions.granted && permissions.directoryUri) {
              setSelectedFolder(permissions.directoryUri);
              Alert.alert('Succès', 'Dossier sélectionné avec succès');
              return;
            } else {
              Alert.alert('Info', 'Aucun dossier sélectionné');
              return;
            }
          } catch (safErr) {
            console.error('SAF directory picker error:', safErr);
            Alert.alert('Erreur', 'Impossible d\'ouvrir le sélecteur de dossier.\n\nVous pouvez exporter sans sélectionner de dossier et partager le fichier ensuite.');
            return;
          }
        }
      }
      
      // For iOS: Show in-app folder browser (iOS doesn't allow direct folder access)
      Alert.alert(
        'Sélection de dossier',
        'Sur iOS, les fichiers seront enregistrés dans le dossier Documents de l\'app. Vous pourrez ensuite les partager ou les déplacer via l\'option Partager.',
        [
          {
            text: 'Annuler',
            style: 'cancel'
          },
          {
            text: 'Continuer',
            onPress: async () => {
              const base = FS.documentDirectory || FS.cacheDirectory || '';
              const root = base.endsWith('/') ? base : base + '/';
              setCurrentBrowsePath(root);
              setFolderPickerVisible(true);
              await readFolder(root);
            }
          }
        ]
      );
    } catch (err) {
      console.error('Pick folder error:', err);
      Alert.alert('Erreur', 'Impossible d\'ouvrir le sélecteur de dossier.\n\nVous pouvez exporter sans sélectionner de dossier et partager le fichier ensuite.');
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
    const docRoot = (FS.documentDirectory || '').replace(/\\/g, '/');
    const cacheRoot = (FS.cacheDirectory || '').replace(/\\/g, '/');
    if (p === docRoot || p === cacheRoot) return;
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
      <LinearGradient
        colors={['#A02020', '#D32F2F', '#E53935']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeMaterialCommunityIcons name="file-export" size={48} color="#FFFFFF" style={{ opacity: 0.9 }} />
        <Text style={styles.headerTitle}>Exporter les plaintes</Text>
        <Text style={styles.headerSubtitle}>Filtrez et exportez les données</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {dbError ? (
          <View style={styles.errorCard}>
            <SafeMaterialCommunityIcons name="alert-circle" size={24} color="#E65100" />
            <Text style={styles.errorText}>{dbError}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <SafeMaterialCommunityIcons name="filter" size={20} color={theme.appColors.primary} />
            <Text style={styles.sectionTitle}>Filtres de période</Text>
          </View>

          <View style={styles.dateRow}>
            <TouchableOpacity style={[styles.dateButton, { flex: 1, marginRight: 8 }]} onPress={() => openCustomFor('start')}>
              <SafeMaterialCommunityIcons name="calendar-start" size={20} color={theme.appColors.primary} />
              <Text style={styles.dateButtonText}>{startDate || 'Date début'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dateButton, { flex: 1 }]} onPress={() => openCustomFor('end')}>
              <SafeMaterialCommunityIcons name="calendar-end" size={20} color={theme.appColors.primary} />
              <Text style={styles.dateButtonText}>{endDate || 'Date fin'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.communeButton} onPress={() => setMenuVisible(true)}>
            <SafeMaterialCommunityIcons name="map-marker" size={20} color={theme.appColors.primary} />
            <Text style={styles.communeButtonText}>{commune || 'Filtrer par commune'}</Text>
            <SafeMaterialCommunityIcons name="chevron-down" size={20} color={theme.appColors.subtext} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearButton} onPress={handleClearFilters}>
            <SafeMaterialCommunityIcons name="filter-remove" size={18} color={theme.appColors.primary} />
            <Text style={styles.clearButtonText}>Effacer les filtres</Text>
          </TouchableOpacity>

          <RNModal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
            <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
              <View style={styles.dropdownMenu}>
                <TouchableOpacity onPress={() => { setCommune(''); setMenuVisible(false); }} style={styles.dropdownItem}>
                  <Text style={styles.dropdownItemText}>Toutes les communes</Text>
                </TouchableOpacity>
                {communes.map((c, idx) => (
                  <TouchableOpacity key={`commune-${idx}-${c}`} onPress={() => { setCommune(c); setMenuVisible(false); }} style={styles.dropdownItem}>
                    <SafeMaterialCommunityIcons name="map-marker-outline" size={16} color={theme.appColors.subtext} />
                    <Text style={styles.dropdownItemText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </RNModal>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <SafeMaterialCommunityIcons name="file-document-edit" size={20} color={theme.appColors.primary} />
            <Text style={styles.sectionTitle}>Paramètres d'export</Text>
          </View>

          <Text style={styles.label}>Nom du fichier</Text>
          <TextInput
            value={filename}
            onChangeText={v => setFilename(v)}
            style={styles.input}
            placeholder="Nom du fichier"
            placeholderTextColor={theme.appColors.subtext}
          />

          <Text style={styles.label}>Dossier de destination</Text>
          <TouchableOpacity style={styles.folderButton} onPress={handlePickFolder}>
            <SafeMaterialCommunityIcons name="folder-open" size={20} color={theme.appColors.primary} />
            <Text style={styles.folderButtonText}>{selectedFolder ? 'Dossier sélectionné ✓' : 'Choisir un dossier'}</Text>
          </TouchableOpacity>

          {selectedFolder && (
            <View style={styles.folderInfoCard}>
              <SafeMaterialCommunityIcons name="folder-check" size={18} color="#4CAF50" />
              <Text style={styles.folderInfoText} numberOfLines={2}>{selectedFolder}</Text>
            </View>
          )}

          {!selectedFolder && (
            <Text style={styles.destinationText}>
              Par défaut: {destination === 'cache' ? 'Cache' : 'Documents'}
            </Text>
          )}
        </View>

        <View style={styles.exportButtonsCard}>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={() => handleExport('csv')}
            disabled={exporting || !dbReady}
          >
            <LinearGradient
              colors={[theme.appColors.primary, '#D32F2F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.exportButtonGradient}
            >
              <SafeMaterialCommunityIcons name="file-delimited" size={24} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>{exporting ? 'Export en cours...' : 'Exporter CSV'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportButton, { marginTop: 12 }]}
            onPress={() => handleExport('json')}
            disabled={exporting || !dbReady}
          >
            <LinearGradient
              colors={['#1565C0', '#1976D2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.exportButtonGradient}
            >
              <SafeMaterialCommunityIcons name="code-json" size={24} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>{exporting ? 'Export en cours...' : 'Exporter JSON'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <RNModal visible={!!customPickingFor} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {customPickingFor === 'start' ? 'Date de début' : 'Date de fin'}
              </Text>
              <View style={styles.calendarHeader}>
                <TouchableOpacity style={styles.calendarNavBtn} onPress={() => {
                  setCustomMonth(m => {
                    if (m === 1) {
                      setCustomYear(y => y - 1);
                      return 12;
                    }
                    return m - 1;
                  });
                }}>
                  <SafeMaterialCommunityIcons name="chevron-left" size={24} color={theme.appColors.primary} />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>{months[customMonth - 1]} {customYear}</Text>
                <TouchableOpacity style={styles.calendarNavBtn} onPress={() => {
                  setCustomMonth(m => {
                    if (m === 12) {
                      setCustomYear(y => y + 1);
                      return 1;
                    }
                    return m + 1;
                  });
                }}>
                  <SafeMaterialCommunityIcons name="chevron-right" size={24} color={theme.appColors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.weekRow}>
                {['L','M','M','J','V','S','D'].map(w => <Text key={w} style={styles.weekDayText}>{w}</Text>)}
              </View>
              <View>
                {(() => {
                  const first = new Date(customYear, customMonth - 1, 1).getDay();
                  const offset = (first + 6) % 7;
                  const dim = new Date(customYear, customMonth, 0).getDate();
                  const cells: Array<number | null> = [];
                  for (let i = 0; i < offset; i++) cells.push(null);
                  for (let d = 1; d <= dim; d++) cells.push(d);
                  while (cells.length % 7 !== 0) cells.push(null);
                  const rows: Array<Array<number | null>> = [];
                  for (let r = 0; r < cells.length / 7; r++) rows.push(cells.slice(r * 7, r * 7 + 7));
                  return rows.map((row, ri) => (
                    <View key={ri} style={styles.calendarRow}>
                      {row.map((day, ci) => {
                        const isSelected = day === customDay;
                        return (
                          <TouchableOpacity
                            key={ci}
                            style={[styles.dayCell, isSelected && styles.selectedDay]}
                            onPress={() => day && setCustomDay(day)}
                          >
                            <Text style={[styles.dayCellText, isSelected && styles.selectedDayText]}>
                              {day ? String(day) : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ));
                })()}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={cancelCustom}>
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmButton} onPress={confirmCustom}>
                  <Text style={styles.modalConfirmText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>

        <RNModal visible={folderPickerVisible} transparent animationType="slide" onRequestClose={() => setFolderPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { width: Math.min(400, windowDimensions.width - 40), maxHeight: windowDimensions.height * 0.8 }]}>
              <View style={styles.folderPickerHeader}>
                <SafeMaterialCommunityIcons name="folder-open" size={24} color={theme.appColors.primary} />
                <Text style={styles.modalTitle}>Sélectionner un dossier</Text>
              </View>
              
              <View style={styles.folderPickerNav}>
                <TouchableOpacity onPress={navigateUp} style={styles.folderNavButton}>
                  <SafeMaterialCommunityIcons name="arrow-up" size={20} color="#FFFFFF" />
                  <Text style={styles.folderNavText}>Retour</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={selectCurrentFolder} style={styles.folderSelectButton}>
                  <SafeMaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                  <Text style={styles.folderNavText}>Sélectionner</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.currentPathText} numberOfLines={2}>{currentBrowsePath}</Text>

              <View style={styles.folderListContainer}>
                <ScrollView>
                  {folderEntries.length === 0 ? (
                    <View style={styles.emptyFolderState}>
                      <SafeMaterialCommunityIcons name="folder-outline" size={48} color={theme.appColors.subtext} />
                      <Text style={styles.emptyFolderText}>Aucun sous-dossier</Text>
                    </View>
                  ) : (
                    folderEntries.map(fe => (
                      <TouchableOpacity
                        key={fe.path}
                        onPress={() => navigateInto(fe)}
                        style={styles.folderItem}
                      >
                        <SafeMaterialCommunityIcons name="folder" size={24} color={theme.appColors.primary} />
                        <Text style={styles.folderItemText}>{fe.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>

              <View style={styles.newFolderRow}>
                <TextInput
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  placeholder="Nouveau dossier"
                  placeholderTextColor={theme.appColors.subtext}
                  style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]}
                />
                <TouchableOpacity style={styles.createFolderButton} onPress={createNewFolder}>
                  <SafeMaterialCommunityIcons name="folder-plus" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalCancelButton, { flex: 1 }]} onPress={() => setFolderPickerVisible(false)}>
                  <Text style={styles.modalCancelText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.appColors.background,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E65100',
  },
  errorText: {
    flex: 1,
    color: '#E65100',
    fontWeight: '600',
  },
  card: {
    backgroundColor: theme.appColors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.appColors.background,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.appColors.text,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.appColors.background,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateButtonText: {
    fontSize: 14,
    color: theme.appColors.text,
    fontWeight: '500',
  },
  communeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.appColors.background,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  communeButtonText: {
    flex: 1,
    fontSize: 14,
    color: theme.appColors.text,
    fontWeight: '500',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.appColors.primary,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    color: theme.appColors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    color: theme.appColors.text,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: theme.appColors.background,
    fontSize: 15,
    color: theme.appColors.text,
  },
  folderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.appColors.background,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
  },
  folderButtonText: {
    fontSize: 14,
    color: theme.appColors.text,
    fontWeight: '500',
  },
  folderInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  folderInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  destinationText: {
    fontSize: 12,
    color: theme.appColors.subtext,
    fontStyle: 'italic',
  },
  exportButtonsCard: {
    marginBottom: 16,
  },
  exportButton: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  exportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    backgroundColor: theme.appColors.surface,
    borderRadius: 12,
    padding: 8,
    minWidth: 220,
    maxHeight: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: 15,
    color: theme.appColors.text,
  },
  modalCard: {
    backgroundColor: theme.appColors.surface,
    padding: 20,
    borderRadius: 16,
    width: 340,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.appColors.text,
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarNavBtn: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.appColors.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: theme.appColors.subtext,
    fontWeight: '600',
  },
  calendarRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellText: {
    fontSize: 14,
    color: theme.appColors.text,
  },
  selectedDay: {
    backgroundColor: theme.appColors.primary,
    borderRadius: 20,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.appColors.primary,
  },
  modalCancelText: {
    color: theme.appColors.primary,
    fontWeight: '600',
  },
  modalConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: theme.appColors.primary,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  folderPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  folderPickerNav: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  folderNavButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.appColors.primary,
    padding: 10,
    borderRadius: 8,
  },
  folderSelectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2E7D32',
    padding: 10,
    borderRadius: 8,
  },
  folderNavText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  currentPathText: {
    fontSize: 12,
    color: theme.appColors.subtext,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  folderListContainer: {
    maxHeight: 260,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  emptyFolderState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyFolderText: {
    fontSize: 14,
    color: theme.appColors.subtext,
    marginTop: 12,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  folderItemText: {
    fontSize: 15,
    color: theme.appColors.text,
  },
  newFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  createFolderButton: {
    backgroundColor: theme.appColors.primary,
    padding: 12,
    borderRadius: 10,
  },
});
