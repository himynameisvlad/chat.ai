import express from 'express';
import cors from 'cors';
import { config } from './config/app.config';
import { DeepSeekService } from './services/ai/deepseek.service';
import { HuggingFaceService } from './services/ai/huggingface.service';
import { ChatService } from './services/chat.service';
import { ChatController } from './controllers/chat.controller';
import { PDFController } from './controllers/pdf.controller';
import { createChatRoutes } from './routes/chat.routes';
import { createMCPRoutes } from './routes/mcp.routes';
import { createEmbeddingsRoutes } from './routes/embeddings.routes';
import { createPDFRoutes } from './routes/pdf.routes';
import sseRoutes from './routes/sse.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { IAIProvider } from './interfaces/ai-provider.interface';
import { initializeDatabase, disconnect } from './database/database';
import { mcpInitializationService, mcpConfigService } from './services/mcp';
import { cronService } from './services/cron.service';
import { DailyToastTask } from './tasks/daily-toast.task';
import { FetchPokemonTask } from './tasks/fetch-pokemon.task';

class Application {
  private app: express.Application;
  private aiProvider!: IAIProvider;
  private deepSeekProvider?: IAIProvider;
  private chatService!: ChatService;
  private chatController!: ChatController;
  private pdfController!: PDFController;

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
    if (mcpConfigService.isEnabled() && config.ai.provider !== 'deepseek') {
      console.log('🔧 Initializing DeepSeek for MCP tool support');
      this.deepSeekProvider = this.createDeepSeekProvider();
    }

    this.chatService = new ChatService(this.aiProvider, this.deepSeekProvider);
    this.chatController = new ChatController(this.chatService);
    this.pdfController = new PDFController();
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
    const embeddingsRoutes = createEmbeddingsRoutes();
    const pdfRoutes = createPDFRoutes(this.pdfController);
    this.app.use('/api', chatRoutes);
    this.app.use('/sse', sseRoutes);
    this.app.use('/mcp', mcpRoutes);
    this.app.use('/embeddings', embeddingsRoutes);
    this.app.use('/api/pdf', pdfRoutes);
  }

  // Must be called last
  private setupErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      await initializeDatabase();
      await mcpInitializationService.initialize();

      this.app.listen(config.server.port, () => {
        console.log(`🚀 Server running on http://localhost:${config.server.port}`);
        console.log(`🤖 AI Provider: ${this.aiProvider.getProviderName()}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      // const fetchPokemonTask = new FetchPokemonTask(this.chatService);
      // const dailyToastTask = new DailyToastTask(this.chatService);
      // cronService.registerTask(fetchPokemonTask);
      // cronService.registerTask(dailyToastTask);
      // cronService.start();

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
        await mcpInitializationService.shutdown();
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
