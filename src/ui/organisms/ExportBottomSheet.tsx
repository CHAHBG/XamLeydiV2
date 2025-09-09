import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import theme from '../theme';
import Input from '../atoms/Input';
import CustomButton from '../atoms/CustomButton';

export default function ExportBottomSheet({ startDate, endDate, commune, setStartDate, setEndDate, setCommune, onApply, onClear }: any) {
  return (
    <View style={styles.sheet}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Filtres d'export</Text>
        <TouchableOpacity onPress={onClear}><Text style={{ color: theme.colors.primary }}>Effacer</Text></TouchableOpacity>
      </View>
      <Input label="Date de début" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
      <Input label="Date de fin" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
      <Input label="Commune" value={commune} onChangeText={setCommune} placeholder="Entrez une commune" />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
        <CustomButton title="Appliquer" onPress={() => onApply({ startDate, endDate, commune })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: 16, backgroundColor: theme.colors.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  title: { fontSize: theme.typography.h2, fontWeight: '700' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }
});
