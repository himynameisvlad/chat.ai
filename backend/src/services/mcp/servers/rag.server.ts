import { BaseMCPServer } from './base.server';
import { MCPServerConfig } from '../mcp.config';
import path from 'path';
import fs from 'fs';

export class RAGServer extends BaseMCPServer {
  name = 'rag';

  isEnabled(): boolean {
    return this.getEnvBool('MCP_RAG_ENABLED');
  }

  getConfig(): MCPServerConfig | null {
    if (!this.isEnabled()) return null;

    // Try multiple possible paths (for different execution contexts)
    const possiblePaths = [
      path.join(process.cwd(), 'backend/src/services/mcp/servers/rag-mcp-server.ts'), // From project root
      path.join(process.cwd(), 'src/services/mcp/servers/rag-mcp-server.ts'), // From backend dir
      path.join(__dirname, 'rag-mcp-server.ts'), // Relative to this file (compiled)
    ];

    // Find the first path that exists
    let serverPath = possiblePaths[0];
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        serverPath = possiblePath;
        break;
      }
    }

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
