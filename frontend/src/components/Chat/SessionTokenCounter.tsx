import { type SessionTokens } from '../../types';

interface SessionTokenCounterProps {
  sessionTokens: SessionTokens;
}

export function SessionTokenCounter({ sessionTokens }: SessionTokenCounterProps) {
  // Don't render if there are no messages yet
  if (sessionTokens.message_count === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 text-sm text-gray-600">
      <div className="flex gap-3">
        <span title="Total input tokens">
          📥 {sessionTokens.total_prompt_tokens.toLocaleString()}
        </span>
        <span title="Total output tokens">
          📤 {sessionTokens.total_completion_tokens.toLocaleString()}
        </span>
        <span title="Total tokens" className="font-semibold">
          ∑ {sessionTokens.total_tokens.toLocaleString()}
        </span>
      </div>
      <span className="text-gray-400">|</span>
      <span>
        {sessionTokens.message_count} {sessionTokens.message_count === 1 ? 'message' : 'messages'}
      </span>
    </div>
  );
}
