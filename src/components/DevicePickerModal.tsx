import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/colors';
import type { DeviceSummary } from '../types/iot';

interface DevicePickerModalProps {
  visible: boolean;
  devices: DeviceSummary[];
  busy: boolean;
  onSelect: (device: DeviceSummary) => void;
  onClose: () => void;
}

export const DevicePickerModal = ({ visible, devices, busy, onSelect, onClose }: DevicePickerModalProps) => {
  const renderDevice = ({ item }: { item: DeviceSummary }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onSelect(item)}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${item.label}, ${item.online ? 'online' : 'offline'}`}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.onlineDot, { backgroundColor: item.online ? '#27B987' : '#4A6258' }]} />
        <View style={styles.cardText}>
          <Text style={styles.deviceLabel} numberOfLines={1}>{item.label}</Text>
          <Text style={styles.deviceSub} numberOfLines={1}>
            {item.online
              ? 'Online'
              : item.last_seen
              ? `Last seen ${new Date(item.last_seen).toLocaleTimeString()}`
              : 'Never connected'}
          </Text>
        </View>
      </View>
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color="#3A554A" />
      )}
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={busy ? undefined : onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title}>Choose a Device</Text>
          <Pressable
            onPress={onClose}
            disabled={busy}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color="#7C9B8C" />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Select which vehicle to monitor for this trip</Text>

        <FlatList
          data={devices}
          keyExtractor={(d) => d.device_id}
          renderItem={renderDevice}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(2,7,5,0.7)' },
  sheet: {
    backgroundColor: '#0A1512',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.2)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 18 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(12,36,26,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 13, marginTop: 4, marginBottom: 16 },
  list: { paddingBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#04100C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.18)',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  cardText: { flex: 1, minWidth: 0 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  deviceLabel: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 16, fontWeight: '700' },
  deviceSub: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
