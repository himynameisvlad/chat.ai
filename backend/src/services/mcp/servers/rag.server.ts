import { BaseMCPServer } from './base.server';
import { MCPServerConfig } from '../mcp.config';
import path from 'path';

export class RAGServer extends BaseMCPServer {
  name = 'rag';

  isEnabled(): boolean {
    return this.getEnvBool('MCP_RAG_ENABLED');
  }

  getConfig(): MCPServerConfig | null {
    if (!this.isEnabled()) return null;

    // Try multiple possible paths (for different execution contexts)
    const serverPath = path.join(process.cwd(), 'backend/src/services/mcp/servers/rag-mcp-server.ts');

    console.log(`[RAG Server] Using path: ${serverPath}`);

    return {
      name: this.name,
      enabled: true,
      transport: 'stdio',
      command: 'tsx',
      args: [serverPath],
      env: {
        OLLAMA_BASE_URL: this.getEnvVar('OLLAMA_BASE_URL', 'http://localhost:11434'),
        OLLAMA_EMBEDDING_MODEL: this.getEnvVar('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text'),
        OLLAMA_RERANK_MODEL: this.getEnvVar('OLLAMA_RERANK_MODEL', 'llama3.2:3b'),
      },
      timeout: 120000,
    };
  }
}
