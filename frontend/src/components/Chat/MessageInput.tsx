import { useState, useRef, type KeyboardEvent, type FormEvent } from 'react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  customPrompt: string;
  onCustomPromptChange: (value: string) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
}

export function MessageInput({ onSendMessage, isLoading, customPrompt, onCustomPromptChange, temperature, onTemperatureChange }: MessageInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) {
      return;
    }

    onSendMessage(input);
    setInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div className="flex gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
        {/* <div className="mt-3">
          <label
            htmlFor="customPrompt"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Custom System Prompt (optional)
          </label>
          <textarea
            id="customPrompt"
            value={customPrompt}
            onChange={(e) => onCustomPromptChange(e.target.value)}
            placeholder="Enter custom system prompt or leave empty to use default..."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            disabled={isLoading}
          />
        </div> */}
        {/* <div className="mt-3">
          <label
            htmlFor="temperature"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Temperature (0-2)
          </label>
          <input
            id="temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => onTemperatureChange(Number(e.target.value))}
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Lower values (0-0.5) are more precise, higher values (1-2) are more creative
          </p>
        </div> */}
      </form>
    </div>
  );
}
