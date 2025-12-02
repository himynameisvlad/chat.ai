import { useState, useCallback } from 'react';
import { type Message } from '../types';
import { chatService, ChatServiceError } from '../services/chat.service';

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  useSystemPrompt: boolean;
  setUseSystemPrompt: (value: boolean) => void;
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useSystemPrompt, setUseSystemPrompt] = useState(false);

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

      let conversationHistory: Message[] = [];

      setMessages((prevMessages) => {
        // Store history for API call
        conversationHistory = prevMessages;

        const userMessage: Message = {
          role: 'user',
          content: message.trim(),
        };

        const assistantMessage: Message = {
          role: 'assistant',
          content: '',
        };

        // Return updated messages with both user and assistant messages
        return [...prevMessages, userMessage, assistantMessage];
      });

      try {
        await chatService.sendMessage(
          conversationHistory, // Use captured history
          message.trim(),
          (chunk) => {
            setMessages((prev) => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              if (lastMessage.role === 'assistant') {
                lastMessage.content += chunk;
              }
              return updated;
            });
          },
          useSystemPrompt
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
    [isLoading, useSystemPrompt]
  );

  /**
   * Clears the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    useSystemPrompt,
    setUseSystemPrompt,
    sendMessage,
    clearError,
  };
}
