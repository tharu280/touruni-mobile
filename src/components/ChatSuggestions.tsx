import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';

interface Props {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export const ChatSuggestions = ({ suggestions, onSelect, disabled }: Props) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {suggestions.map((item, index) => (
          <TouchableOpacity
            key={`${item}-${index}`}
            style={[styles.pill, disabled && styles.pillDisabled]}
            onPress={() => !disabled && onSelect(item)}
            activeOpacity={0.7}
          >
            <Text style={[styles.text, disabled && styles.textDisabled]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    backgroundColor: '#05120D',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    backgroundColor: 'rgba(39, 185, 135, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.25)',
  },
  pillDisabled: {
    opacity: 0.5,
  },
  text: {
    color: '#27B987',
    fontSize: 14,
    fontWeight: '600',
  },
  textDisabled: {
    color: '#156147',
  },
});
