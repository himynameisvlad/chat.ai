import { mcpClientService, MCPTool } from './mcp-client.service';
import OpenAI from 'openai';

export interface MCPToolCall {
  toolName: string;
  arguments: Record<string, any>;
}

export class MCPToolsService {
  private cachedTools: MCPTool[] = [];
  private toolsLoaded = false;

  async loadTools(): Promise<void> {
    try {
      if (!mcpClientService.isClientConnected()) {
        await mcpClientService.connect();
      }

      this.cachedTools = await mcpClientService.listTools();
      this.toolsLoaded = true;

      console.log(`✅ Loaded ${this.cachedTools.length} MCP tools`);
    } catch (error) {
      console.error('Failed to load MCP tools:', error);
      this.cachedTools = [];
      this.toolsLoaded = false;
    }
  }

  convertToOpenAIFormat(): OpenAI.Chat.ChatCompletionTool[] {
    return this.cachedTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        parameters: tool.inputSchema,
      },
    }));
  }

  async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
    try {
      const response = await mcpClientService.callTool(toolName, args);
      return response;
    } catch (error) {
      console.error(`Failed to execute tool ${toolName}:`, error);
      throw error;
    }
  }

  hasTools(): boolean {
    return this.toolsLoaded && this.cachedTools.length > 0;
  }

  getTools(): MCPTool[] {
    return this.cachedTools;
  }
}

export const mcpToolsService = new MCPToolsService();
