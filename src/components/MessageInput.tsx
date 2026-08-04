import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../theme/colors';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const MessageInput = ({ onSend, disabled }: Props) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.glassPill}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={18} color="#27B987" />
        </View>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Ask TripMind anything..."
          placeholderTextColor="#7A9C8D"
          editable={!disabled}
          multiline
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity 
          style={styles.sendButtonFrame} 
          onPress={handleSend}
          disabled={!hasText || disabled}
          activeOpacity={0.8}
        >
          {hasText && !disabled ? (
            <LinearGradient
              colors={['#27B987', '#169368']}
              style={styles.sendButtonActive}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" style={styles.arrowIcon} />
            </LinearGradient>
          ) : (
            <View style={styles.sendButtonInactive}>
              <Ionicons name="arrow-up" size={18} color="#456656" style={styles.arrowIcon} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    backgroundColor: '#05120D',
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#081A14',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.4)',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    minHeight: 56,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 8,
  },
  iconWrap: {
    height: 40,
    justifyContent: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.body,
    color: '#FFFFFF',
    maxHeight: 120,
    minHeight: 40,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
  },
  sendButtonFrame: {
    justifyContent: 'flex-end',
  },
  sendButtonActive: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonInactive: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(39, 185, 135, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    marginTop: -1,
  }
});
