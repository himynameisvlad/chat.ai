import { useChat } from '../../hooks/useChat';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { SessionTokenCounter } from './SessionTokenCounter';

/**
 * Chat Component
 * Main chat interface - orchestrates child components
 * Follows Container/Presenter pattern - thin orchestration layer
 *
 * This component is now much simpler (~40 lines vs 148 lines)
 * All logic is extracted to hooks and child components
 */
export function Chat() {
  // Custom hooks handle all business logic
  const { messages, isLoading, customPrompt, setCustomPrompt, temperature, setTemperature, sendMessage, sessionTokens } = useChat();
  const scrollRef = useAutoScroll(messages);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header with session tokens */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-800">AI Chat</h1>
          <SessionTokenCounter sessionTokens={sessionTokens} />
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <MessageList messages={messages} scrollRef={scrollRef} />
      </div>

      {/* Input Area */}
      <MessageInput
        onSendMessage={sendMessage}
        isLoading={isLoading}
        customPrompt={customPrompt}
        onCustomPromptChange={setCustomPrompt}
        temperature={temperature}
        onTemperatureChange={setTemperature}
      />
    </div>
  );
}
