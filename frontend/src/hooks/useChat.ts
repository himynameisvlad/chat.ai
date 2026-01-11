import { useState, useCallback, useRef, useEffect } from 'react';
import { type Message, type SessionTokens, DEFAULT_TEMPERATURE } from '../types';
import { chatService, ChatServiceError } from '../services/chat.service';
import { useSessionTokens } from './useSessionTokens';

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isExecutingTools: boolean;
  error: string | null;
  customPrompt: string;
  setCustomPrompt: (value: string) => void;
  temperature: number;
  setTemperature: (value: number) => void;
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
  sessionTokens: SessionTokens;
  resetSession: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecutingTools, setIsExecutingTools] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const { sessionTokens, updateTokens, resetTokens } = useSessionTokens();

  const messagesRef = useRef<Message[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) {
        return;
      }

      setIsLoading(true);
      setError(null);

      const userMessage: Message = {
        role: 'user',
        content: message.trim(),
      };

      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      const cleanHistory = messagesRef.current
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
          (usage) => {
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              const lastMessage = updated[lastIndex];

              if (lastMessage.role === 'assistant') {
                updated[lastIndex] = {
                  ...lastMessage,
                  tokens: usage,
                };
              }
              return updated;
            });

            updateTokens(usage);
          },
          () => {
            setIsExecutingTools(true);
          },
          () => {
            setIsExecutingTools(false);
          },
          customPrompt || undefined,
          temperature
        );
      } catch (err) {
        const errorMessage =
          err instanceof ChatServiceError
            ? err.message
            : 'An unexpected error occurred. Please try again.';

        setError(errorMessage);

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
    [isLoading, customPrompt, temperature]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetSession = useCallback(() => {
    setMessages([]);
    resetTokens();
  }, [resetTokens]);

  return {
    messages,
    isLoading,
    isExecutingTools,
    error,
    customPrompt,
    setCustomPrompt,
    temperature,
    setTemperature,
    sendMessage,
    clearError,
    sessionTokens,
    resetSession,
  };
}
