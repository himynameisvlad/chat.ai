import { type Message as MessageType } from '../../types';
import { Message } from './Message';
import { EmptyState } from './EmptyState';

/**
 * Props for the MessageList component
 */
interface MessageListProps {
  messages: MessageType[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * MessageList Component
 * Displays a list of chat messages
 * Follows Single Responsibility Principle - only handles message display
 */
export function MessageList({ messages, scrollRef }: MessageListProps) {
  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {messages.map((message, index) => (
        <Message key={index} message={message} />
      ))}
      <div ref={scrollRef} />
    </div>
  );
}
