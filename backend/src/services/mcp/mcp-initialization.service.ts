import { mcpClientService } from './mcp-client.service';
import { mcpToolsService } from './mcp-tools.service';
import { mcpConfigService } from './mcp.config';

console.log('test');

/**
 * Service responsible for initializing and managing MCP (Model Context Protocol) lifecycle
 */
export class MCPInitializationService {
  private initialized = false;

  /**
   * Initialize MCP services: connect to servers and load tools
   */
  async initialize(): Promise<void> {
    if (!mcpConfigService.isEnabled()) {
      console.log('ℹ️ MCP is disabled');
      return;
    }

    if (this.initialized) {
      console.warn('⚠️ MCP already initialized, skipping...');
      return;
    }

    try {
      const servers = mcpConfigService.getEnabledServers();
      console.log(`🔧 Initializing MCP with ${servers.length} server(s)...`);

      // Load MCP tools (this internally connects to servers)
      await mcpToolsService.loadTools();

      const connectedServers = mcpClientService.getConnectedServers();

      if (connectedServers.length > 0) {
        console.log(`✅ Connected to MCP servers: ${connectedServers.join(', ')}`);
        const tools = mcpToolsService.getTools();
        this.initialized = true;
      } else {
        console.warn('⚠️ No MCP servers connected');
      }
    } catch (error) {
      console.error('❌ Failed to initialize MCP:', error);
      throw error;
    }
  }

  /**
   * Shutdown MCP services and disconnect from servers
   */
  async shutdown(): Promise<void> {
    if (!mcpConfigService.isEnabled() || !this.initialized) {
      return;
    }

    try {
      console.log('🔌 Disconnecting from MCP servers...');
      await mcpClientService.disconnect();
      this.initialized = false;
      console.log('✅ MCP services disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting MCP services:', error);
      throw error;
    }
  }

  /**
   * Check if MCP is initialized and ready
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if MCP is enabled in configuration
   */
  isEnabled(): boolean {
    return mcpConfigService.isEnabled();
  }

  /**
   * Get list of connected MCP server names
   */
  getConnectedServers(): string[] {
    return mcpClientService.getConnectedServers();
  }

  /**
   * Check if MCP tools are available for use
   */
  hasTools(): boolean {
    return mcpToolsService.hasTools();
  }
}

export const mcpInitializationService = new MCPInitializationService();
