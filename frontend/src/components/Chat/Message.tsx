import ReactMarkdown from 'react-markdown';
import { type Message as MessageType } from '../../types';
import { LoadingIndicator } from './LoadingIndicator';
import { TokenUsage } from './TokenUsage';

/**
 * Props for the Message component
 */
interface MessageProps {
  message: MessageType;
  isExecutingTools?: boolean;
}

/**
 * Message Component
 * Displays a single chat message (user or assistant)
 * Follows Single Responsibility Principle - only renders a message
 */

export function Message({ message, isExecutingTools }: MessageProps) {
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
        ) : (
          <>
            {!message.content && !isExecutingTools ? (
              <LoadingIndicator />
            ) : (
              <>
                {message.content && (
                  <div className="prose prose-sm max-w-none break-words">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}

                {/* Tool execution loader */}
                {isExecutingTools && (
                  <div className="flex items-center space-x-2 mt-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-sm text-gray-600">Executing tools...</span>
                  </div>
                )}

                {/* Token usage display for assistant messages */}
                {message.tokens && <TokenUsage usage={message.tokens} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
