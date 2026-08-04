import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { askAssistant } from '../api/client';
import { useAppSession } from '../context/AppSessionContext';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const SUGGESTIONS = [
  'Why is Day 1 crowded?',
  'How much of my budget remains?',
  'What should I visit first tomorrow?',
  'What happens if it rains?',
];

export const TripAssistantChatbot = ({ sessionId }: { sessionId: string }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const { accessToken } = useAppSession();

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await askAssistant(
        sessionId,
        {
          message: text.trim(),
          history: messages.slice(-20),
        },
        accessToken
      );
      setMessages([...newMessages, { role: 'assistant', content: response.answer }]);
    } catch (err) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Sorry, I encountered an error connecting to the Trip Assistant. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isLoading]);

  return (
    <>
      <View style={styles.triggerContainer} pointerEvents="box-none">
        <Pressable style={styles.triggerButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="chatbubbles" size={24} color="#FFF" />
        </Pressable>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trip Assistant</Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.chatScroll}
              contentContainerStyle={styles.chatContent}
            >
              {messages.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="compass-outline" size={48} color={colors.primary} />
                  <Text style={styles.emptyText}>Ask me anything about your current trip plan, budget, or weather conditions!</Text>
                  
                  <View style={styles.suggestionsContainer}>
                    {SUGGESTIONS.map((suggestion, i) => (
                      <Pressable
                        key={i}
                        style={styles.suggestionChip}
                        onPress={() => handleSend(suggestion)}
                      >
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {messages.map((msg, i) => (
                <View key={i} style={[styles.messageRow, msg.role === 'user' ? styles.userRow : styles.assistantRow]}>
                  {msg.role === 'assistant' && (
                    <View style={styles.assistantAvatar}>
                      <Text style={styles.assistantAvatarText}>✨</Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      msg.role === 'user' ? styles.userText : styles.assistantText,
                    ]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}

              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>TripMind is thinking...</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.inputArea}>
              <TextInput
                style={styles.textInput}
                placeholder="Ask about your trip..."
                placeholderTextColor="rgba(137, 163, 150, 0.6)"
                value={inputValue}
                onChangeText={setInputValue}
                onSubmitEditing={() => handleSend(inputValue)}
                returnKeyType="send"
                multiline={false}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  !inputValue.trim() && styles.sendButtonDisabled,
                  pressed && { opacity: 0.8 }
                ]}
                onPress={() => handleSend(inputValue)}
                disabled={!inputValue.trim() || isLoading}
              >
                <Ionicons 
                  name="arrow-up" 
                  size={20} 
                  color={!inputValue.trim() ? 'rgba(111, 224, 188, 0.3)' : colors.forest} 
                />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerContainer: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    zIndex: 999,
  },
  triggerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  triggerText: {
    display: 'none',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.forest,
  },
  keyboardAvoid: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: colors.forest,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(111, 224, 188, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.warmWhite,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatScroll: {
    flex: 1,
    backgroundColor: colors.forest,
  },
  chatContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#89A396',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 20,
    marginBottom: 40,
  },
  suggestionsContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  suggestionChip: {
    backgroundColor: 'rgba(39, 185, 135, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  suggestionText: {
    color: '#38DFA8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(111, 224, 188, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginBottom: 4,
  },
  assistantAvatarText: {
    fontSize: 14,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
  },
  userBubble: {
    backgroundColor: colors.mint,
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: colors.forestElevated,
    borderWidth: 1,
    borderColor: 'rgba(111, 224, 188, 0.15)',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: colors.forest,
    fontWeight: '600',
  },
  assistantText: {
    color: colors.textSecondary,
    lineHeight: 24,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: colors.textMuted,
    fontSize: 14,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#05120D',
    borderTopWidth: 1,
    borderTopColor: 'rgba(111, 224, 188, 0.2)',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0F2219',
    borderWidth: 1,
    borderColor: 'rgba(111, 224, 188, 0.4)',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: colors.mint,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: colors.mint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  sendButtonDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(111, 224, 188, 0.3)',
    shadowOpacity: 0,
  },
});
