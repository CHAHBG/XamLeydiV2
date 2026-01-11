/**
 * XamLeydi v2.0 - Complaints Screen (Plaintes)
 * List of complaints with status tracking and quick actions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Paths, File, Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeIonicons } from '../../components/SafeIcons';
import { useDesignTheme } from '../../ui/ThemeContext';
import {
  Card,
  Badge,
  SearchBar,
  SectionHeader,
  Skeleton,
  EmptyState,
} from '../../ui/components/ModernComponents';
import { spacing, radii, shadows, animation } from '../../ui/designSystem';
import DatabaseManager from '../../data/database';

type ComplaintStatus = 'pending' | 'validated' | 'rejected' | 'all';

interface Complaint {
  id: string;
  reference: string;
  type: string;
  status: ComplaintStatus;
  parcel_number: string;
  date?: string;
  activity?: string;
  village?: string;
  commune?: string;
  complainant_name?: string;
  complainant_sex?: string;
  complainant_id?: string;
  complainant_contact?: string;
  complaint_reason?: string;
  complaint_reception_mode?: string;
  complaint_category?: string;
  complaint_description?: string;
  expected_resolution?: string;
  complaint_function?: string;
  description?: string;
  attachments?: Array<{name: string; uri: string; type: string}>;
  created_at: Date;
  updated_at?: Date;
}

const isExportedComplaint = (c: any) => {
  if (!c) return false;
  return Boolean(
    c.exported === true ||
    c.exported_at ||
    c.exportedAt ||
    c.sent_exported === true ||
    c.sentExported === true
  );
};

const isSentRemoteComplaint = (c: any) => {
  if (!c) return false;
  return Boolean(c.sent_remote === true || c.sentRemote === true);
};

const hasBackendIdComplaint = (c: any) => {
  if (!c) return false;
  return Boolean(c.backend_id || c.backendId);
};

const isHandledComplaint = (c: any) => {
  // "Handled" means either sent to backend or exported.
  // backend_id alone is treated as handled only when we don't have an explicit "sent_remote: false".
  const exported = isExportedComplaint(c);
  const sentRemote = isSentRemoteComplaint(c);
  const hasBackendId = hasBackendIdComplaint(c);
  const explicitlyNotSent = c.sent_remote === false || c.sentRemote === false;
  return exported || sentRemote || (hasBackendId && !explicitlyNotSent);
};

const STATUS_FILTERS: { key: ComplaintStatus; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'validated', label: 'Envoyées / exportées' },
];

export default function ComplaintsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useDesignTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ComplaintStatus>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportFilename, setExportFilename] = useState('');
  const [exportDestination, setExportDestination] = useState<string>('Documents');
  const [selectedDirectory, setSelectedDirectory] = useState<Directory | null>(null);
  const [exporting, setExporting] = useState(false);

  const [actionsVisible, setActionsVisible] = useState(false);
  const [activeComplaintForActions, setActiveComplaintForActions] = useState<Complaint | null>(null);

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const loadComplaints = useCallback(async () => {
    try {
      const result = await DatabaseManager.getAllComplaints?.();
      if (result && Array.isArray(result)) {
        const mapped = result.map((c: any, idx: number) => ({
          // Preserve ALL fields from the database
          ...c,
          id: c.id || String(idx),
          reference: c.reference || `DOSS-${new Date().getFullYear()}-${String(idx + 1).padStart(6, '0')}`,
          type: c.complaint_type || c.complaint_category || c.motif || 'Non spécifié',
          status: (c.status || 'pending') as ComplaintStatus,
          parcel_number: c.parcel_number || c.parcelNumber || c.num_parcel || c.numero_parcelle || '',
          description: c.description || c.complaint_description || '',
          created_at: c.created_at ? new Date(c.created_at) : new Date(),
          updated_at: c.updated_at ? new Date(c.updated_at) : undefined,
        }));
        setComplaints(mapped);
      }
    } catch (error) {
      console.error('Error loading complaints:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadComplaints();
    }, [loadComplaints])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadComplaints();
  }, [loadComplaints]);

  const handleNewComplaint = () => {
    navigation.navigate('ComplaintWizard');
  };

  const handleExport = () => {
    if (selectionMode && selectedIds.size === 0) {
      Alert.alert('Sélection vide', 'Veuillez sélectionner au moins une plainte à exporter.');
      return;
    }
    setExportFilename(`plaintes_${new Date().toISOString().split('T')[0]}`);
    setShowExportModal(true);
  };

  const handleSync = async () => {
    const toSync = selectionMode && selectedIds.size > 0 
      ? complaints.filter(c => selectedIds.has(c.id))
      : complaints;
    
    if (toSync.length === 0) {
      Alert.alert('Aucune plainte', "Il n'y a aucune plainte à synchroniser.");
      return;
    }

    // Sync only complaints still needing remote sync:
    // - not exported
    // - not sent_remote === true (edited complaints set sent_remote=false even when backend_id exists)
    const unsyncedComplaints = toSync.filter(c => !isExportedComplaint(c) && !isSentRemoteComplaint(c));
    
    if (unsyncedComplaints.length === 0) {
      Alert.alert('Info', 'Toutes les plaintes sélectionnées sont déjà synchronisées.');
      return;
    }

    Alert.alert(
      'Synchronisation',
      `Voulez-vous synchroniser ${unsyncedComplaints.length} plainte(s) non synchronisée(s) avec le serveur ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Synchroniser',
          onPress: async () => {
            let successCount = 0;
            let failCount = 0;
            
            try {
              for (const complaint of unsyncedComplaints) {
                try {
                  // Call actual remote sync
                  await DatabaseManager.sendComplaint?.(complaint.id);
                  successCount++;
                } catch (err) {
                  console.warn('Failed to sync complaint:', complaint.id, err);
                  failCount++;
                }
              }
              
              if (failCount === 0) {
                Alert.alert('Succès', `${successCount} plainte(s) synchronisée(s) avec succès.`);
              } else {
                Alert.alert(
                  'Synchronisation partielle',
                  `${successCount} réussie(s), ${failCount} échec(s). Vérifiez votre connexion.`
                );
              }
              
              // Reload to reflect updated sync status
              loadComplaints();
              
              if (selectionMode) {
                setSelectionMode(false);
                setSelectedIds(new Set());
              }
            } catch (error) {
              Alert.alert('Erreur', 'Échec de la synchronisation. Vérifiez votre connexion.');
            }
          },
        },
      ]
    );
  };

  const handleComplaintDetail = (complaint: Complaint) => {
    if (selectionMode) {
      toggleSelection(complaint.id);
    } else {
      // Navigate to edit screen
      navigation.navigate('ComplaintEdit', { complaintId: complaint.id, id: complaint.id });
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedIds(new Set());
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredComplaints.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const pickDestinationFolder = async () => {
    try {
      const pickedDirectory = await Directory.pickDirectoryAsync();
      if (pickedDirectory) {
        setSelectedDirectory(pickedDirectory);
        // Extract folder name from URI for display
        const folderName = pickedDirectory.name || 'Dossier sélectionné';
        setExportDestination(folderName);
      }
    } catch (error) {
      console.error('Folder picker error:', error);
      Alert.alert(
        'Erreur',
        'Impossible de sélectionner un dossier. Le fichier sera partagé pour que vous puissiez choisir la destination.',
        [{ text: 'OK' }]
      );
    }
  };

  const performExport = async () => {
    if (!exportFilename.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom de fichier.');
      return;
    }

    setExporting(true);
    try {
      const toExport = selectionMode && selectedIds.size > 0
        ? complaints.filter(c => selectedIds.has(c.id))
        : complaints;

      let content: string;
      let filename: string;

      if (exportFormat === 'csv') {
        filename = `${exportFilename}.csv`;
        // CSV export with all fields
        const headers = [
          'ID', 'Référence', 'Type', 'Statut', 'Parcelle', 'Village', 'Commune',
          'Plaignant', 'Sexe', 'ID Plaignant', 'Contact', 'Catégorie',
          'Mode réception', 'Motif', 'Description', 'Résolution attendue', 'Fonction', 'Date'
        ];
        const rows = toExport.map(c => [
          c.id,
          c.reference,
          c.type,
          c.status,
          c.parcel_number || '',
          c.village || '',
          c.commune || '',
          c.complainant_name || '',
          c.complainant_sex || '',
          c.complainant_id || '',
          c.complainant_contact || '',
          c.complaint_category || '',
          c.complaint_reception_mode || '',
          c.complaint_reason || '',
          (c.complaint_description || c.description || '').replace(/"/g, '""'),
          c.expected_resolution || '',
          c.complaint_function || '',
          c.created_at?.toISOString() || '',
        ]);
        content = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
      } else {
        filename = `${exportFilename}.json`;
        // JSON export
        content = JSON.stringify(toExport, null, 2);
      }

      let file: File;
      
      // If a directory was selected, create file there
      if (selectedDirectory) {
        try {
          file = selectedDirectory.createFile(filename, exportFormat === 'csv' ? 'text/csv' : 'application/json');
          file.write(content);
          Alert.alert(
            'Succès',
            `${toExport.length} plainte(s) exportée(s) dans ${exportDestination}/${filename}`
          );
        } catch (dirError) {
          console.warn('Failed to write to selected directory, falling back to share:', dirError);
          // Fallback to cache and share
          file = new File(Paths.cache, filename);
          file.write(content);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(file.uri);
          }
          Alert.alert('Succès', `${toExport.length} plainte(s) exportée(s).`);
        }
      } else {
        // Default: create in cache and share
        file = new File(Paths.cache, filename);
        file.write(content);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri);
          Alert.alert('Succès', `${toExport.length} plainte(s) exportée(s) avec succès.`);
        } else {
          Alert.alert('Succès', `Fichier enregistré: ${filename}`);
        }
      }

      // Mark exported complaints as handled (exported) in local DB
      try {
        for (const c of toExport) {
          const existing = await DatabaseManager.getComplaintById?.(c.id);
          if (!existing) continue;
          const nowIso = new Date().toISOString();
          await DatabaseManager.updateComplaint?.({
            ...existing,
            status: 'validated',
            exported: true,
            exported_at: nowIso,
            updated_at: nowIso,
          });
        }
      } catch (e) {
        console.warn('Failed to auto-validate after export', e);
      }

      setShowExportModal(false);
      setSelectedDirectory(null);
      setExportDestination('Documents');
      if (selectionMode) {
        setSelectionMode(false);
        setSelectedIds(new Set());
      }

      loadComplaints();
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Erreur', "Impossible d'exporter les plaintes.");
    } finally {
      setExporting(false);
    }
  };

  // Filter and search
  const filteredComplaints = useMemo(() => {
    let result = complaints;

    // Apply status filter
    if (activeFilter !== 'all') {
      if (activeFilter === 'pending') {
        // Any complaint not sent/exported is considered pending
        result = result.filter((c) => !isHandledComplaint(c));
      } else {
        // "validated" filter represents "Envoyées / exportées"
        result = result.filter((c) => isHandledComplaint(c));
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.reference.toLowerCase().includes(query) ||
          c.parcel_number.toLowerCase().includes(query) ||
          c.type.toLowerCase().includes(query)
      );
    }

    return result;
  }, [complaints, activeFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: complaints.length,
      pending: complaints.filter((c) => !isHandledComplaint(c)).length,
      validated: complaints.filter((c) => isHandledComplaint(c)).length,
    };
  }, [complaints]);

  const getStatusBadgeVariant = (item: any) => (isHandledComplaint(item) ? 'success' : 'warning');
  const getStatusLabel = (item: any) => (isHandledComplaint(item) ? 'Envoyé / exporté' : 'En attente');
  const getStatusIcon = (item: any) => (isHandledComplaint(item) ? 'checkmark-circle' : 'time');

  const formatComplaintType = (type: string) => {
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const renderComplaintItem = ({ item }: { item: Complaint }) => {
    const isSelected = selectedIds.has(item.id);
    const parcelNum = String(
      item.parcel_number || (item as any).parcelNumber || (item as any).num_parcel || ''
    );
    const handled = isHandledComplaint(item);
    return (
      <TouchableOpacity
        onPress={() => handleComplaintDetail(item)}
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
          }
          toggleSelection(item.id);
        }}
        activeOpacity={0.7}
      >
        <Card 
          style={StyleSheet.flatten([
            styles.complaintCard,
            isSelected && styles.complaintCardSelected,
          ])}
          theme={theme}
        >
          {selectionMode && (
            <View style={styles.selectionCheckbox}>
              <View style={[
                styles.checkbox,
                isSelected && styles.checkboxSelected,
              ]}>
                {isSelected && (
                  <SafeIonicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </View>
            </View>
          )}
          <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <SafeIonicons
              name={getStatusIcon(item)}
              size={20}
              color={
                handled
                  ? theme.colors.success
                  : theme.colors.warning
              }
            />
            <Text style={styles.cardReference}>{item.reference}</Text>
          </View>
          <Badge
            label={getStatusLabel(item)}
            variant={getStatusBadgeVariant(item)}
            size="small"
            theme={theme}
          />

          {!selectionMode && (
            <TouchableOpacity
              onPress={() => {
                setActiveComplaintForActions(item);
                setActionsVisible(true);
              }}
              style={styles.moreButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <SafeIonicons name="ellipsis-vertical" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.cardType}>{formatComplaintType(item.type)}</Text>

        <View style={styles.cardMeta}>
          <View style={styles.cardMetaItem}>
            <SafeIonicons
              name="document-text-outline"
              size={14}
              color={theme.colors.textTertiary}
            />
            <Text style={styles.cardMetaText}>
              Parcelle {parcelNum || 'N/A'}
            </Text>
          </View>
          <View style={styles.cardMetaItem}>
            <SafeIonicons
              name="calendar-outline"
              size={14}
              color={theme.colors.textTertiary}
            />
            <Text style={styles.cardMetaText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardAction}
            onPress={() => handleComplaintDetail(item)}
          >
            <Text style={styles.cardActionText}>Voir détails</Text>
            <SafeIonicons
              name="chevron-forward"
              size={16}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
    );
  };

  const closeActions = () => {
    setActionsVisible(false);
    setActiveComplaintForActions(null);
  };

  const applyStatus = async (status: 'pending' | 'validated') => {
    const c = activeComplaintForActions;
    if (!c) return;
    try {
      await DatabaseManager.updateComplaintStatus?.(c.id, status);
      closeActions();
      loadComplaints();
    } catch (e) {
      console.warn('applyStatus failed', e);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut.');
    }
  };

  const confirmDelete = () => {
    const c = activeComplaintForActions;
    if (!c) return;
    Alert.alert(
      'Supprimer',
      'Voulez-vous supprimer cette plainte ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseManager.deleteComplaint?.(c.id);
              closeActions();
              loadComplaints();
            } catch (e) {
              console.warn('deleteComplaint failed', e);
              Alert.alert('Erreur', 'Impossible de supprimer la plainte.');
            }
          },
        },
      ]
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <Skeleton height={120} theme={theme} style={{ marginBottom: spacing.md }} />
          <Skeleton height={120} theme={theme} style={{ marginBottom: spacing.md }} />
          <Skeleton height={120} theme={theme} />
        </View>
      );
    }

    return (
      <EmptyState
        icon="document-text-outline"
        title={
          searchQuery || activeFilter !== 'all'
            ? 'Aucun résultat'
            : 'Aucune plainte'
        }
        description={
          searchQuery || activeFilter !== 'all'
            ? 'Aucune plainte ne correspond à vos critères de recherche'
            : "Vous n'avez pas encore déposé de plainte"
        }
        action={
          !searchQuery && activeFilter === 'all'
            ? {
                label: 'Créer une plainte',
                onPress: handleNewComplaint,
              }
            : undefined
        }
        theme={theme}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        {selectionMode ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={toggleSelectionMode} style={styles.backButton}>
                <SafeIonicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {selectedIds.size} sélectionné(s)
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {selectedIds.size < filteredComplaints.length ? (
                <TouchableOpacity onPress={selectAll} style={styles.headerActionBtn}>
                  <SafeIonicons name="checkbox-outline" size={22} color={theme.colors.primary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={deselectAll} style={styles.headerActionBtn}>
                  <SafeIonicons name="square-outline" size={22} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
              {selectedIds.size > 0 && (
                <>
                  <TouchableOpacity onPress={handleExport} style={styles.headerActionBtn}>
                    <SafeIonicons name="download-outline" size={22} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSync} style={styles.headerActionBtn}>
                    <SafeIonicons name="cloud-upload-outline" size={22} color={theme.colors.primary} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.headerTitle}>Plaintes</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity onPress={toggleSelectionMode} style={styles.headerActionBtn}>
                <SafeIonicons name="checkmark-circle-outline" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleExport} style={styles.headerActionBtn}>
                <SafeIonicons name="download-outline" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSync} style={styles.headerActionBtn}>
                <SafeIonicons name="cloud-upload-outline" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleNewComplaint} style={styles.headerActionBtn}>
                <SafeIonicons name="add" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.warning }]}>
            {stats.pending}
          </Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>
            {stats.validated}
          </Text>
          <Text style={styles.statLabel}>Envoyées / exportées</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Rechercher une plainte..."
          onClear={() => setSearchQuery('')}
          theme={theme}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setActiveFilter(item.key)}
              style={[
                styles.filterTab,
                activeFilter === item.key && styles.filterTabActive,
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === item.key && styles.filterTabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Complaints List */}
      <FlatList
        data={filteredComplaints}
        keyExtractor={(item) => item.id}
        renderItem={renderComplaintItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      />

      {/* FAB */}
      {!selectionMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleNewComplaint}
          activeOpacity={0.8}
        >
          <SafeIonicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Quick Actions Modal */}
      <Modal
        visible={actionsVisible}
        transparent
        animationType="fade"
        onRequestClose={closeActions}
      >
        <TouchableOpacity style={styles.modalOverlay} onPress={closeActions} activeOpacity={1}>
          <View style={styles.actionsSheet}>
            <Text style={styles.actionsTitle}>Actions</Text>
            <TouchableOpacity style={styles.actionsItem} onPress={() => applyStatus('pending')}>
              <Text style={styles.actionsItemText}>Marquer: En attente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionsItem} onPress={() => applyStatus('validated')}>
              <Text style={styles.actionsItemText}>Marquer: Envoyée / exportée</Text>
            </TouchableOpacity>
            <View style={styles.actionsDivider} />
            <TouchableOpacity style={styles.actionsItem} onPress={confirmDelete}>
              <Text style={[styles.actionsItemText, { color: theme.colors.error }]}>Supprimer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionsItem, { justifyContent: 'center' }]} onPress={closeActions}>
              <Text style={styles.actionsCancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Exporter les plaintes</Text>
            
            <Text style={styles.modalLabel}>Format</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => setExportFormat('csv')}
              >
                <View style={styles.radioCircle}>
                  {exportFormat === 'csv' && <View style={styles.radioSelected} />}
                </View>
                <Text style={styles.radioLabel}>CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => setExportFormat('json')}
              >
                <View style={styles.radioCircle}>
                  {exportFormat === 'json' && <View style={styles.radioSelected} />}
                </View>
                <Text style={styles.radioLabel}>JSON</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Nom du fichier</Text>
            <TextInput
              style={styles.modalInput}
              value={exportFilename}
              onChangeText={setExportFilename}
              placeholder="plaintes_export"
              placeholderTextColor={theme.colors.textTertiary}
            />

            <Text style={styles.modalLabel}>Destination</Text>
            <TouchableOpacity
              style={styles.folderPickerButton}
              onPress={pickDestinationFolder}
            >
              <SafeIonicons name="folder-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.folderPickerText}>{exportDestination}</Text>
              <SafeIonicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowExportModal(false)}
                disabled={exporting}
              >
                <Text style={styles.modalButtonTextSecondary}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={performExport}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>Exporter</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: theme.typography.fontSize.h2,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    headerActionBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAction: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsBar: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: theme.typography.fontSize.h3,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: theme.typography.fontSize.tiny,
      color: theme.colors.textSecondary,
      marginTop: spacing.xs,
    },
    statDivider: {
      width: 1,
      backgroundColor: theme.colors.border,
      marginVertical: spacing.xs,
    },
    searchContainer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: theme.colors.background,
    },
    filterContainer: {
      backgroundColor: theme.colors.background,
    },
    filterList: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    filterTab: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.full,
      backgroundColor: theme.colors.backgroundAlt,
      marginRight: spacing.sm,
    },
    filterTabActive: {
      backgroundColor: theme.colors.primary,
    },
    filterTabText: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textSecondary,
    },
    filterTabTextActive: {
      color: '#FFFFFF',
    },
    listContent: {
      padding: spacing.lg,
      paddingBottom: insets.bottom + spacing['3xl'] + 60, // FAB space
    },
    loadingContainer: {
      paddingTop: spacing.xl,
    },
    complaintCard: {
      marginBottom: spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    moreButton: {
      marginLeft: spacing.sm,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardReference: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.semiBold,
      color: theme.colors.text,
      marginLeft: spacing.sm,
    },
    cardType: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.textSecondary,
      marginBottom: spacing.sm,
    },
    cardMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cardMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: spacing.lg,
      marginTop: spacing.xs,
    },
    cardMetaText: {
      fontSize: theme.typography.fontSize.small,
      color: theme.colors.textTertiary,
      marginLeft: spacing.xs,
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    cardAction: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardActionText: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.primary,
      marginRight: spacing.xs,
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: insets.bottom + spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.large,
    },
    backButton: {
      marginRight: spacing.sm,
    },
    complaintCardSelected: {
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    selectionCheckbox: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      zIndex: 10,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionsSheet: {
      width: '85%',
      backgroundColor: theme.colors.surface,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      ...shadows.large,
    },
    actionsTitle: {
      fontSize: theme.typography.fontSize.h4,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      marginBottom: spacing.sm,
    },
    actionsItem: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
    },
    actionsItemText: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    actionsDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: spacing.sm,
    },
    actionsCancelText: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textSecondary,
    },
    modalContent: {
      width: '85%',
      backgroundColor: theme.colors.surface,
      borderRadius: radii.lg,
      padding: spacing.xl,
      ...shadows.large,
    },
    modalTitle: {
      fontSize: theme.typography.fontSize.h3,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      marginBottom: spacing.lg,
    },
    modalLabel: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    radioGroup: {
      flexDirection: 'row',
      gap: spacing.lg,
      marginBottom: spacing.md,
    },
    radioOption: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    radioCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    radioSelected: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
    },
    radioLabel: {
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
    },
    folderPickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      backgroundColor: theme.colors.background,
      gap: spacing.sm,
    },
    folderPickerText: {
      flex: 1,
      fontSize: theme.typography.fontSize.body,
      color: theme.colors.text,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    modalButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      minWidth: 100,
      alignItems: 'center',
    },
    modalButtonSecondary: {
      backgroundColor: theme.colors.backgroundAlt,
    },
    modalButtonPrimary: {
      backgroundColor: theme.colors.primary,
    },
    modalButtonTextSecondary: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    modalButtonTextPrimary: {
      fontSize: theme.typography.fontSize.body,
      fontWeight: theme.typography.fontWeight.medium,
      color: '#FFFFFF',
    },
  });
