import { useState, useCallback } from 'react';
import { type Message, type FormattedResponse } from '../types';
import { chatService, ChatServiceError } from '../services/chat.service';

function tryParseFormattedResponse(content: string): FormattedResponse | null {
  try {
    const parsed = JSON.parse(content);

    if (!parsed.status || !parsed.text) {
      return null;
    }

    if (parsed.status !== 'clarifying' && parsed.status !== 'ready') {
      return null;
    }

    if (parsed.status === 'clarifying' && Array.isArray(parsed.questions)) {
      return parsed as FormattedResponse;
    }

    if (parsed.status === 'ready' && parsed.source) {
      return parsed as FormattedResponse;
    }

    return null;
  } catch {
    return null;
  }
}

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

      // Add user message to UI immediately
      const userMessage: Message = {
        role: 'user',
        content: message.trim(),
      };

      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        expectsFormatted: useSystemPrompt,
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
                const newContent = lastMessage.content + chunk;

                const formattedContent = tryParseFormattedResponse(newContent);

                if (formattedContent) {
                  console.log('✅ JSON parsed successfully:', formattedContent);
                }

                updated[lastIndex] = {
                  ...lastMessage,
                  content: newContent,
                  formattedContent: formattedContent || lastMessage.formattedContent,
                };
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
    [isLoading, useSystemPrompt, messages]
  );

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
