/**
 * EmptyState Component
 * Displays when there are no messages in the chat
 * Follows Single Responsibility Principle - only displays empty state
 */
export function EmptyState() {
  return (
    <div className="text-center text-gray-500 mt-20">
      <h2 className="text-xl font-medium mb-2">Start a conversation</h2>
      <p className="text-sm">Ask me anything and I'll do my best to help!</p>
    </div>
  );
}
