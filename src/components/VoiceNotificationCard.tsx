import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { ConditionNotification } from '../types';

type Props = {
  notification: ConditionNotification | null;
  isPlaying: boolean;
  onPlay: (notification: ConditionNotification) => void;
  onStop: () => void;
  onMarkRead: (notification: ConditionNotification) => void;
};

export const VoiceNotificationCard = ({
  notification,
  isPlaying,
  onPlay,
  onStop,
  onMarkRead,
}: Props) => {
  if (!notification) return null;

  const iconName = notification.category === 'weather' ? 'rainy' :
    notification.category === 'crowd' ? 'people' :
    notification.category === 'roads' ? 'car' :
    notification.category === 'multi_signal' ? 'warning' : 'notifications';
  const action = notification.recommendation?.action;
  const severity = String(notification.severity || 'update').toUpperCase();
  const severityColor = notification.severity === 'high' ? colors.error : colors.warning;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name={iconName} size={20} color={colors.primary} />
          <Text style={styles.title} numberOfLines={1}>
            {notification.title || 'Trip Update'}
          </Text>
        </View>
        <View style={[styles.severityBadge, { backgroundColor: `${severityColor}18` }]}>
          <Text style={[styles.severityText, { color: severityColor }]}>{severity}</Text>
        </View>
      </View>
      <Text style={styles.message}>
        {notification.message}
      </Text>
      {action ? (
        <View style={styles.recommendation}>
          <View style={styles.recommendationIcon}>
            <Ionicons name="navigate" size={18} color={colors.mint} />
          </View>
          <View style={styles.recommendationCopy}>
            <Text style={styles.recommendationLabel}>
              {notification.recommendation?.headline || 'Recommended action'}
            </Text>
            <Text style={styles.recommendationText}>{action}</Text>
          </View>
        </View>
      ) : null}
      <Text style={styles.time}>
        {notification.created_at ? new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
      </Text>
      <View style={styles.actions}>
        {isPlaying ? (
          <Pressable style={styles.actionButton} onPress={onStop}>
            <Ionicons name="stop-circle" size={20} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.actionButton} onPress={() => onPlay(notification)}>
            <Ionicons name="play-circle" size={20} color={colors.primary} />
            <Text style={styles.actionText}>Listen</Text>
          </Pressable>
        )}
        <Pressable style={styles.actionButton} onPress={() => onMarkRead(notification)}>
          <Ionicons name="checkmark-circle" size={20} color={colors.textMuted} />
          <Text style={[styles.actionText, { color: colors.textMuted }]}>Mark as read</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
    marginBottom: 14,
  },
  severityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.forestElevated,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  recommendationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.mint}18`,
    marginRight: 10,
  },
  recommendationCopy: {
    flex: 1,
  },
  recommendationLabel: {
    color: colors.mint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  recommendationText: {
    color: colors.warmWhite,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  time: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    marginLeft: 4,
  },
});
