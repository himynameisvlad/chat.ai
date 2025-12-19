import { BaseMCPServer } from './base.server';
import { MCPServerConfig } from '../mcp.config';

export class PokemonServer extends BaseMCPServer {
  name = 'pokemon';

  isEnabled(): boolean {
    return this.getEnvBool('MCP_POKEMON_SERVER_ENABLED');
  }

  getConfig(): MCPServerConfig | null {
    if (!this.isEnabled()) return null;

    const url = this.getEnvVar('MCP_POKEMON_SERVER_URL');
    if (!url) return null;

    return {
      name: this.name,
      enabled: true,
      transport: 'http',
      url,
    };
  }
}
