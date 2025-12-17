import express from 'express';
import cors from 'cors';
import { config } from './config/app.config';
import { DeepSeekService } from './services/ai/deepseek.service';
import { HuggingFaceService } from './services/ai/huggingface.service';
import { ChatService } from './services/chat.service';
import { ChatController } from './controllers/chat.controller';
import { createChatRoutes } from './routes/chat.routes';
import { createMCPRoutes } from './routes/mcp.routes';
import sseRoutes from './routes/sse.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { IAIProvider } from './interfaces/ai-provider.interface';
import { initializeDatabase, disconnect } from './database/database';
import { mcpToolsService } from './services/mcp/mcp-tools.service';
import { mcpClientService } from './services/mcp/mcp-client.service';
import { cronService } from './services/cron.service';
import { DailyToastTask } from './tasks/daily-toast.task';

class Application {
  private app: express.Application;
  private aiProvider!: IAIProvider;
  private deepSeekProvider?: IAIProvider;
  private chatService!: ChatService;
  private chatController!: ChatController;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.initializeDependencies();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private initializeDependencies(): void {
    this.aiProvider = this.createAIProvider();

    // Create DeepSeek provider for MCP if enabled and primary provider is not DeepSeek
    if (config.mcp.enabled && config.ai.provider !== 'deepseek') {
      console.log('🔧 Initializing DeepSeek for MCP tool support');
      this.deepSeekProvider = this.createDeepSeekProvider();
    }

    this.chatService = new ChatService(this.aiProvider, this.deepSeekProvider);
    this.chatController = new ChatController(this.chatService);
  }

  private createDeepSeekProvider(): IAIProvider {
    return new DeepSeekService({
      apiKey: config.ai.deepseek.apiKey,
      baseURL: config.ai.deepseek.baseURL,
      model: config.ai.deepseek.model,
      maxTokens: config.ai.maxTokens,
    });
  }

  private createAIProvider(): IAIProvider {
    switch (config.ai.provider) {
      case 'deepseek':
        return new DeepSeekService({
          apiKey: config.ai.deepseek.apiKey,
          baseURL: config.ai.deepseek.baseURL,
          model: config.ai.deepseek.model,
          maxTokens: config.ai.maxTokens,
        });
      case 'huggingface':
        return new HuggingFaceService({
          apiKey: config.ai.huggingface.apiKey,
          model: config.ai.huggingface.model,
          maxTokens: config.ai.maxTokens,
        });
      // case 'openai':
      //   return new OpenAIService(config.ai.openai);
      default:
        throw new Error(`Unsupported AI provider: ${config.ai.provider}`);
    }
  }

  private setupRoutes(): void {
    const chatRoutes = createChatRoutes(this.chatController);
    const mcpRoutes = createMCPRoutes();
    this.app.use('/api', chatRoutes);
    this.app.use('/sse', sseRoutes);
    this.app.use('/mcp', mcpRoutes);
  }

  // Must be called last
  private setupErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      await initializeDatabase();

      if (config.mcp.enabled) {
        console.log(`🔧 Loading MCP tools from ${config.mcp.servers.length} server(s)...`);
        await mcpToolsService.loadTools();
        const connectedServers = mcpClientService.getConnectedServers();
        if (connectedServers.length > 0) {
          console.log(`✅ Connected to MCP servers: ${connectedServers.join(', ')}`);
        }
      }

      this.app.listen(config.server.port, () => {
        console.log(`🚀 Server running on http://localhost:${config.server.port}`);
        console.log(`🤖 AI Provider: ${this.aiProvider.getProviderName()}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      const dailyToastTask = new DailyToastTask(this.chatService);
      cronService.registerTask(dailyToastTask);
      cronService.start();

      this.setupGracefulShutdown();
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      try {
        cronService.stop();
        if (config.mcp.enabled) {
          await mcpClientService.disconnect();
        }
        await disconnect();
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

const app = new Application();
app.start();
