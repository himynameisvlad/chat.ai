import { type Message as MessageType } from '../../types';
import { Message } from './Message';
import { EmptyState } from './EmptyState';

/**
 * Props for the MessageList component
 */
interface MessageListProps {
  messages: MessageType[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  isExecutingTools?: boolean;
}

/**
 * MessageList Component
 * Displays a list of chat messages
 * Follows Single Responsibility Principle - only handles message display
 */
export function MessageList({ messages, scrollRef, isExecutingTools }: MessageListProps) {
  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1;
        const showToolLoader = isLastMessage && isExecutingTools && message.role === 'assistant';

        return (
          <Message
            key={index}
            message={message}
            isExecutingTools={showToolLoader}
          />
        );
      })}
      <div ref={scrollRef} />
    </div>
  );
}
