/**
 * Detects if user is requesting list of available tools
 * Checks for @tools command
 */
export function isToolsListRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return lowerMessage.includes('@tools');
}

export function requiresMCPTools(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return lowerMessage.includes('@maps');
}

/**
 * Detects if any message in the conversation requires MCP tools
 */
export function conversationRequiresTools(messages: Array<{ role: string; content: string }>): boolean {
  // Check the last user message
  const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');

  if (!lastUserMessage) {
    return false;
  }

  return requiresMCPTools(lastUserMessage.content);
}
