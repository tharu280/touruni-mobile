import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/colors';
import { ChatTurn } from '../types';

interface Props {
  turn: ChatTurn;
}

export const ChatBubble = ({ turn }: Props) => {
  const isUser = turn.role === 'user';
  
  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={14} color="#27B987" />
        </View>
      )}
      
      <View style={[styles.bubbleWrapper, isUser ? styles.userWrapper : styles.assistantWrapper]}>
        <Text style={[styles.label, isUser ? styles.userLabel : styles.assistantLabel]}>
          {isUser ? 'YOU' : 'TRIPMIND'}
        </Text>
        
        {isUser ? (
          <LinearGradient
            colors={['#27B987', '#169368']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, styles.userBubble]}
          >
            <Text style={[styles.text, styles.userText]}>{turn.content}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.assistantBubble]}>
            <Text style={[styles.text, styles.assistantText]}>{turn.content}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(39, 185, 135, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginBottom: 4,
  },
  bubbleWrapper: {
    maxWidth: '82%',
  },
  userWrapper: {
    alignItems: 'flex-end',
  },
  assistantWrapper: {
    alignItems: 'flex-start',
  },
  label: {
    marginBottom: 6,
    fontFamily: fonts.bodySemibold,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginLeft: 4,
    marginRight: 4,
  },
  userLabel: {
    color: '#84A395',
  },
  assistantLabel: {
    color: '#27B987',
  },
  bubble: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
  },
  userBubble: {
    borderBottomRightRadius: 6,
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  assistantBubble: {
    backgroundColor: '#0A1C14',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.22)',
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 16.5,
    lineHeight: 24,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#E0E7E4',
  },
});
