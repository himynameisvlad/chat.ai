import { useState, useCallback } from 'react';
import { type TokenUsage, type SessionTokens } from '../types';

interface UseSessionTokensReturn {
  sessionTokens: SessionTokens;
  updateTokens: (usage: TokenUsage) => void;
  resetTokens: () => void;
}

const initialTokens: SessionTokens = {
  total_prompt_tokens: 0,
  total_completion_tokens: 0,
  total_tokens: 0,
  message_count: 0,
};

export function useSessionTokens(): UseSessionTokensReturn {
  const [sessionTokens, setSessionTokens] = useState<SessionTokens>(initialTokens);

  const updateTokens = useCallback((usage: TokenUsage) => {
    setSessionTokens((prev) => ({
      total_prompt_tokens: prev.total_prompt_tokens + usage.prompt_tokens,
      total_completion_tokens: prev.total_completion_tokens + usage.completion_tokens,
      total_tokens: prev.total_tokens + usage.total_tokens,
      message_count: prev.message_count + 1,
    }));
  }, []);

  const resetTokens = useCallback(() => {
    setSessionTokens(initialTokens);
  }, []);

  return {
    sessionTokens,
    updateTokens,
    resetTokens,
  };
}
