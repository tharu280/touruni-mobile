import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, fonts } from '../../theme/colors';

export const titleCase = (value?: string | null, fallback = 'Unknown') => {
  if (!value?.trim()) return fallback;
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
};

export const formatLkr = (value?: number | null) => (
  value === null || value === undefined
    ? 'Not tracked'
    : `LKR ${Math.round(value).toLocaleString()}`
);

export const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

export const riskColor = (value?: string | null) => {
  const risk = value?.toLowerCase() || '';
  if (risk.includes('high') || risk.includes('severe') || risk.includes('critical')) return colors.error;
  if (risk.includes('medium') || risk.includes('moderate') || risk.includes('caution')) return colors.warning;
  if (risk.includes('unknown') || risk.includes('unavailable')) return colors.textMuted;
  return colors.success;
};

export const SurfaceCard = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const SectionHeading = ({ eyebrow, title, detail }: {
  eyebrow?: string;
  title: string;
  detail?: string;
}) => (
  <View style={styles.heading}>
    {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
    <Text style={styles.title}>{title}</Text>
    {!!detail && <Text style={styles.detail}>{detail}</Text>}
  </View>
);

export const RiskBadge = ({ value, compact = false }: { value?: string | null; compact?: boolean }) => {
  const resolved = titleCase(value, 'Unknown');
  const color = riskColor(value);
  return (
    <View style={[styles.badge, compact && styles.badgeCompact, { borderColor: `${color}88`, backgroundColor: `${color}18` }]}>
      <Text style={[styles.badgeText, compact && styles.badgeTextCompact, { color }]}>{resolved}</Text>
    </View>
  );
};

export const Metric = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, accent ? { color: accent } : null]} numberOfLines={2}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.forestElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  heading: { gap: 5 },
  eyebrow: { color: colors.mint, fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { color: colors.warmWhite, fontFamily: fonts.displaySemibold, fontSize: 24, letterSpacing: -0.6 },
  detail: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  badge: { minHeight: 34, borderRadius: 18, borderWidth: 1, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  badgeCompact: { minHeight: 28, paddingHorizontal: 10 },
  badgeText: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  badgeTextCompact: { fontSize: 11 },
  metric: { flex: 1, minWidth: 92, gap: 5 },
  metricLabel: { color: colors.textMuted, fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  metricValue: { color: colors.warmWhite, fontFamily: fonts.displaySemibold, fontSize: 16, lineHeight: 21 },
});
