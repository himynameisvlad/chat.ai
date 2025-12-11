import { type TokenUsage as TokenUsageType } from '../../types';

interface TokenUsageProps {
  usage: TokenUsageType;
  variant?: 'compact' | 'detailed';
}

export function TokenUsage({ usage, variant = 'compact' }: TokenUsageProps) {
  if (variant === 'detailed') {
    return (
      <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Input tokens:</span>
          <span className="font-medium">{usage.prompt_tokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Output tokens:</span>
          <span className="font-medium">{usage.completion_tokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1">
          <span>Total:</span>
          <span className="font-semibold">{usage.total_tokens.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  // Compact variant (default)
  return (
    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 flex gap-3">
      <span title="Input tokens">📥 {usage.prompt_tokens.toLocaleString()}</span>
      <span title="Output tokens">📤 {usage.completion_tokens.toLocaleString()}</span>
      <span title="Total tokens" className="font-medium">
        ∑ {usage.total_tokens.toLocaleString()}
      </span>
    </div>
  );
}
