import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { mcpConfigService, MCPServerConfig } from './mcp.config';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, any>;
  serverName: string;
}

interface MCPClientConnection {
  client: Client;
  transport: Transport;
  serverConfig: MCPServerConfig;
}

export class MCPClientService {
  private connections: Map<string, MCPClientConnection> = new Map();

  async connect(): Promise<void> {
    const enabledServers = mcpConfigService.getEnabledServers();

    if (enabledServers.length === 0) {
      console.log('ℹ️ No MCP servers configured');
      return;
    }

    for (const serverConfig of enabledServers) {
      if (this.connections.has(serverConfig.name)) {
        continue;
      }

      try {
        await this.connectToServer(serverConfig);
      } catch (error) {
        console.error(`Failed to connect to ${serverConfig.name} MCP:`, error);
      }
    }
  }

  private async connectToServer(serverConfig: MCPServerConfig): Promise<void> {
    let transport: Transport;

    if (serverConfig.transport === 'stdio') {
      const env: Record<string, string> = {};

      // Copy process.env
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
          env[key] = value;
        }
      }

      // Add server-specific env vars
      if (serverConfig.env) {
        Object.assign(env, serverConfig.env);
      }

      transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env,
      });
    } else {
      // HTTP transport
      transport = new StreamableHTTPClientTransport(new URL(serverConfig.url));
    }

    const client = new Client({
      name: 'chat-ai-backend',
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    await client.connect(transport);

    this.connections.set(serverConfig.name, {
      client,
      transport,
      serverConfig,
    });

    console.log(`✅ Connected to ${serverConfig.name} MCP via ${serverConfig.transport}`);
  }

  async disconnect(): Promise<void> {
    for (const [name, connection] of this.connections.entries()) {
      try {
        await connection.client.close();
        console.log(`✅ Disconnected from ${name} MCP`);
      } catch (error) {
        console.error(`Error disconnecting from ${name} MCP:`, error);
      }
    }

    this.connections.clear();
  }

  async listTools(): Promise<MCPTool[]> {
    const allTools: MCPTool[] = [];

    for (const [serverName, connection] of this.connections.entries()) {
      try {
        const response = await connection.client.listTools();

        const tools = response.tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          serverName,
        }));

        allTools.push(...tools);
      } catch (error) {
        console.error(`Failed to list tools from ${serverName}:`, error);
      }
    }

    return allTools;
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    // Find which server has this tool
    for (const [serverName, connection] of this.connections.entries()) {
      try {
        const tools = await connection.client.listTools();
        const hasTool = tools.tools.some(t => t.name === name);

        if (hasTool) {
          const response = await connection.client.callTool({
            name,
            arguments: args,
          });
          return response;
        }
      } catch (error) {
        console.error(`Error checking/calling tool on ${serverName}:`, error);
      }
    }

    throw new Error(`Tool ${name} not found in any connected MCP server`);
  }

  isClientConnected(): boolean {
    return this.connections.size > 0;
  }

  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }
}

export const mcpClientService = new MCPClientService();
