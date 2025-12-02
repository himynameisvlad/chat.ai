import ReactMarkdown from 'react-markdown';
import { type Message as MessageType, type FormattedResponse } from '../../types';

/**
 * Props for the Message component
 */
interface MessageProps {
  message: MessageType;
}

/**
 * Renders formatted JSON response
 */
function FormattedResponseView({ data }: { data: FormattedResponse }) {
  return (
    <div className="space-y-3">
      <div>
        <strong className="text-gray-900 text-base leading-relaxed block">
          {data.text}
        </strong>
      </div>
      <div>
        <i className="text-gray-600 text-sm block">
          {data.source}
        </i>
      </div>
      {data.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
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
        ) : message.formattedContent ? (
          <FormattedResponseView data={message.formattedContent} />
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
