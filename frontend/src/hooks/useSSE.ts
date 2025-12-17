import { useEffect, useRef, useCallback } from 'react';
import { config } from '../config/app.config';

export interface SSEEvent {
  type: string;
  [key: string]: any;
}

export interface ToastEvent {
  type: 'toast';
  message: string;
  timestamp: string;
}

interface UseSSEOptions {
  onToast?: (toast: ToastEvent) => void;
  onConnected?: (connectionId: string) => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

export const useSSE = (options: UseSSEOptions = {}) => {
  const {
    onToast,
    onConnected,
    onError,
    enabled = true,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) {
      return;
    }

    const sseUrl = `${config.api.baseUrl}/sse/connect`;
    console.log('📡 Connecting to SSE:', sseUrl);

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('✅ SSE connection opened');
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);

          // Handle different event types
          if (data.type === 'connected' && onConnected) {
            onConnected(data.connectionId);
          } else if (data.type === 'toast' && onToast) {
            onToast(data as ToastEvent);
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);

        if (onError) {
          onError(error);
        }

        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt to reconnect with exponential backoff
        const maxRetries = 5;
        if (reconnectAttemptsRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxRetries})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('Failed to create EventSource:', error);
    }
  }, [enabled, onToast, onConnected, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      console.log('📡 Closing SSE connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    reconnectAttemptsRef.current = 0;
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected: eventSourceRef.current !== null,
    disconnect,
    reconnect: () => {
      disconnect();
      connect();
    },
  };
};
