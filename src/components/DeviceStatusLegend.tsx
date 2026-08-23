import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../theme/colors';
import { ALERT_TIER_COLORS, ALERT_TIER_LABELS, type AlertTier } from '../types/iot';

interface Props {
  alertTier: AlertTier;
  deviceOnline: boolean;
  driverVisible: boolean;
  gpsFixed: boolean;
}

// Mirrors the physical hub's own LED patterns exactly (see updateAlertPattern()
// in the firmware) — this is a legend, not a control signal, so it shows what
// the device is doing, not a substitute for looking at it.
const RED_LED_DESCRIPTIONS: Record<AlertTier, string> = {
  0: 'Off',
  1: 'Single pulse / sec',
  2: '150–250ms blink cycle',
  3: '200–300ms blink + buzzer',
};

export const DeviceStatusLegend = ({
  alertTier,
  deviceOnline,
  driverVisible,
  gpsFixed,
}: Props) => {
  // Reconstructed from the SAME fields the firmware's own updateHealthLed()
  // reads (driverVisible/gpsFixed come straight from the telemetry payload,
  // not an approximation). Caveat: deviceOnline only flips false after ~15s
  // of RTDB staleness, so this can lag the physical LED by up to that long
  // on the off-transition — fine for a legend, not a real-time control signal.
  const health: 'healthy' | 'degraded' | 'off' = !deviceOnline
    ? 'off'
    : driverVisible && gpsFixed
      ? 'healthy'
      : 'degraded';

  const healthColor =
    health === 'healthy' ? '#27B987' : health === 'degraded' ? '#F5A623' : '#7C9B8C';
  const healthLabel =
    health === 'healthy'
      ? 'Solid — all sensors OK'
      : health === 'degraded'
        ? 'Slow blink — camera or GPS stale'
        : 'Off — link unreachable';

  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: ALERT_TIER_COLORS[alertTier] }]} />
        <View style={styles.textCol}>
          <Text style={styles.label}>Alert LED · {ALERT_TIER_LABELS[alertTier]}</Text>
          <Text style={styles.desc}>{RED_LED_DESCRIPTIONS[alertTier]}</Text>
        </View>
      </View>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: healthColor }]} />
        <View style={styles.textCol}>
          <Text style={styles.label}>Health LED</Text>
          <Text style={styles.desc}>{healthLabel}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  textCol: { flex: 1 },
  label: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 11, fontWeight: '600' },
  desc: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
});
