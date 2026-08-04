import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const PrimaryButton = ({ title, onPress, loading, disabled, variant = 'primary' }: Props) => {
  return (
    <TouchableOpacity
      style={[styles.button, styles[variant], (disabled || loading) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.background : colors.primary} />
      ) : (
        <Text style={[styles.text, variant !== 'primary' && styles.altText]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primary: { 
    backgroundColor: '#27B987',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  secondary: { backgroundColor: '#05120D', borderWidth: 1, borderColor: '#27B987' },
  ghost: { backgroundColor: 'transparent' },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: '#05120D',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  altText: { color: '#27B987' },
});
