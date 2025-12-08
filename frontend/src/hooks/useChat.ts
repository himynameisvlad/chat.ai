import { useState, useCallback } from 'react';
import { type Message } from '../types';
import { chatService, ChatServiceError } from '../services/chat.service';

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  customPrompt: string;
  setCustomPrompt: (value: string) => void;
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  /**
   * Sends a message to the chat API
   */
  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) {
        return;
      }

      // Set loading state IMMEDIATELY to prevent duplicate calls
      setIsLoading(true);
      setError(null);

      // Add user message to UI immediately
      const userMessage: Message = {
        role: 'user',
        content: message.trim(),
      };

      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
      };

      const conversationHistory = messages;

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      const cleanHistory = conversationHistory
        .filter((msg) => msg.content.trim().length > 0)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      try {
        await chatService.sendMessage(
          cleanHistory,
          message.trim(),
          (chunk) => {
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              const lastMessage = updated[lastIndex];

              if (lastMessage.role === 'assistant') {
                updated[lastIndex] = {
                  ...lastMessage,
                  content: lastMessage.content + chunk,
                };
              }
              return updated;
            });
          },
          customPrompt || undefined
        );
      } catch (err) {
        const errorMessage =
          err instanceof ChatServiceError
            ? err.message
            : 'An unexpected error occurred. Please try again.';

        setError(errorMessage);

        // Update the last message with error
        setMessages((prev) => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage.role === 'assistant') {
            lastMessage.content =
              'Sorry, an error occurred. Please try again.';
          }
          return updated;
        });

        console.error('Error sending message:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, customPrompt, messages]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    customPrompt,
    setCustomPrompt,
    sendMessage,
    clearError,
  };
}
