import ReactMarkdown from 'react-markdown';
import { type Message as MessageType } from '../../types';
import { LoadingIndicator } from './LoadingIndicator';
import { TokenUsage } from './TokenUsage';

/**
 * Props for the Message component
 */
interface MessageProps {
  message: MessageType;
}

/**
 * Message Component
 * Displays a single chat message (user or assistant)
 * Follows Single Responsibility Principle - only renders a message
 */

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white border border-gray-200 text-gray-800'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : !message.content ? (
          <LoadingIndicator />
        ) : (
          <>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>

            {/* Token usage display for assistant messages */}
            {message.tokens && <TokenUsage usage={message.tokens} />}
          </>
        )}
      </div>
    </div>
  );
}
