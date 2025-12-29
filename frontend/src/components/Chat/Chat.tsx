import { useChat } from '../../hooks/useChat';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { SessionTokenCounter } from './SessionTokenCounter';

export function Chat() {
  const { messages, isLoading, isExecutingTools, customPrompt, setCustomPrompt, temperature, setTemperature, sendMessage, sessionTokens } = useChat();
  const scrollRef = useAutoScroll([messages, isExecutingTools]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-800">AI Chat</h1>
          <SessionTokenCounter sessionTokens={sessionTokens} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <MessageList messages={messages} scrollRef={scrollRef} isExecutingTools={isExecutingTools} />
      </div>

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
