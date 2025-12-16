import { IAIProvider } from '../interfaces/ai-provider.interface';
import { Message, StreamResponse, AppError, HISTORY_THRESHOLD, RECENT_MESSAGES_COUNT, MAX_MESSAGE_LENGTH } from '../types';
import { summaryRepository } from '../database/summary.repository';
import { conversationRequiresTools, isToolsListRequest } from '../utils/tool-detection.util';
import { config } from '../config/app.config';
import { mcpToolsService } from './mcp/mcp-tools.service';

export class ChatService {
  constructor(
    private aiProvider: IAIProvider,
    private deepSeekProvider?: IAIProvider
  ) {}

  /**
   * Processes a chat request and streams the response
   * @param conversationHistory - Previous messages in the conversation
   * @param newMessage - The new message from the user
   * @param response - Express response object for streaming
   * @param customPrompt - Optional custom system prompt
   * @param temperature - Optional temperature parameter for AI response
   */
  async processChat(
    conversationHistory: Message[],
    newMessage: string,
    response: StreamResponse,
    customPrompt?: string,
    temperature?: number
  ): Promise<void> {
    this.validateMessage(newMessage);

    // Check if user is requesting tools list
    if (isToolsListRequest(newMessage)) {
      await this.handleToolsListRequest(response);
      return;
    }

    const processedHistory = await this.processHistory(conversationHistory);
    const messages = this.buildConversation(processedHistory, newMessage);

    const needsTools = conversationRequiresTools(messages);
    const mcpEnabled = config.mcp.enabled;

    // Route to DeepSeek if tools are needed and MCP is enabled
    if (needsTools && mcpEnabled && this.deepSeekProvider) {
      console.log('🔧 Routing to DeepSeek for MCP tool usage');
      await this.deepSeekProvider.streamChat(messages, response, customPrompt, temperature);
    } else {
      await this.aiProvider.streamChat(messages, response, customPrompt, temperature);
    }
  }

  private async handleToolsListRequest(response: StreamResponse): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');

    if (!config.mcp.enabled || !mcpToolsService.hasTools()) {
      const message = 'No MCP tools are currently available. Enable MCP servers in configuration to use tools.';
      response.write(`data: ${JSON.stringify({ text: message })}\n\n`);
      response.write('data: [DONE]\n\n');
      response.end();
      return;
    }

    const tools = mcpToolsService.getTools();

    // Group tools by server
    const toolsByServer = tools.reduce((acc, tool) => {
      if (!acc[tool.serverName]) {
        acc[tool.serverName] = [];
      }
      acc[tool.serverName].push(tool);
      return acc;
    }, {} as Record<string, typeof tools>);

    let responseText = `🛠️ Available MCP Tools (${tools.length}):\n\n`;

    Object.entries(toolsByServer).forEach(([serverName, serverTools]) => {
      responseText += `**${serverName}** (${serverTools.length} tools):\n`;
      serverTools.forEach((tool, index) => {
        responseText += `  ${index + 1}. **${tool.name}**\n`;
        if (tool.description) {
          responseText += `     ${tool.description}\n`;
        }
      });
      responseText += '\n';
    });

    response.write(`data: ${JSON.stringify({ text: responseText })}\n\n`);
    response.write('data: [DONE]\n\n');
    response.end();
  }

  /**
   * Validates the user's message
   */
  private validateMessage(message: string): void {
    if (!message || message.trim().length === 0) {
      throw new AppError(400, 'Message is required and cannot be empty');
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new AppError(400, `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`);
    }
  }

  /**
   * Builds the complete conversation including history and new message
   */
  private buildConversation(
    conversationHistory: Message[],
    newMessage: string
  ): Message[] {
    return [
      ...conversationHistory,
      {
        role: 'user' as const,
        content: newMessage,
      },
    ];
  }

  private async processHistory(history: Message[]): Promise<Message[]> {
    const existingSummary = await summaryRepository.getLatestSummary();

    if (history.length <= HISTORY_THRESHOLD) {
      if (existingSummary) {
        return [
          { role: 'system' as const, content: existingSummary.summary_text },
          ...history
        ];
      }
      return history;
    }

    const oldMessages = history.slice(0, -RECENT_MESSAGES_COUNT);
    const recentMessages = history.slice(-RECENT_MESSAGES_COUNT);

    let summary: string;

    if (existingSummary && existingSummary.message_count >= oldMessages.length - 2) {
      summary = existingSummary.summary_text;
    } else {
      summary = await this.summarizeMessages(oldMessages);
      await summaryRepository.saveSummary(summary, oldMessages.length);
    }

    return [
      { role: 'system' as const, content: summary },
      ...recentMessages
    ];
  }

  private async summarizeMessages(messages: Message[]): Promise<string> {
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = `Summarize this conversation concisely in 2-3 sentences. It's important to memorize and retain all critical information, key facts, and important context from the conversation:\n\n${conversationText}`;

    return new Promise((resolve, reject) => {
      let summary = '';

      const mockResponse = {
        setHeader: () => {},
        write: (data: string) => {
          if (data.startsWith('data: ') && !data.includes('[DONE]') && !data.includes('token_usage')) {
            try {
              const jsonStr = data.slice(6).trim();
              const parsed = JSON.parse(jsonStr);
              if (parsed.text) {
                summary += parsed.text;
              }
            } catch {}
          }
        },
        end: () => resolve(summary),
        headersSent: false,
        closed: false,
        writable: true
      } as unknown as StreamResponse;

      this.aiProvider.streamChat(
        [{ role: 'user', content: summaryPrompt }],
        mockResponse
      ).catch(reject);
    });
  }

  /**
   * Returns the name of the current AI provider
   */
  getProviderName(): string {
    return this.aiProvider.getProviderName();
  }
}
