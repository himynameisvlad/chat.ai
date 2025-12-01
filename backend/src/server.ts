import express from 'express';
import cors from 'cors';
import { config } from './config/app.config';
import { DeepSeekService } from './services/ai/deepseek.service';
import { ClaudeService } from './services/ai/claude.service';
import { ChatService } from './services/chat.service';
import { ChatController } from './controllers/chat.controller';
import { createChatRoutes } from './routes/chat.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { IAIProvider } from './interfaces/ai-provider.interface';

/**
 * Application entry point.
 * Follows Dependency Injection pattern - all dependencies are created and injected here.
 */
class Application {
  private app: express.Application;
  private aiProvider!: IAIProvider;
  private chatService!: ChatService;
  private chatController!: ChatController;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.initializeDependencies();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Sets up Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  /**
   * Initializes all dependencies using Dependency Injection.
   * This is where we wire up our services following the SOLID principles.
   */
  private initializeDependencies(): void {
    // Initialize AI provider based on configuration
    this.aiProvider = this.createAIProvider();

    // Inject AI provider into Chat Service
    this.chatService = new ChatService(this.aiProvider);

    // Inject Chat Service into Controller
    this.chatController = new ChatController(this.chatService);
  }

  /**
   * Factory method to create AI provider based on configuration.
   * Follows Factory Pattern and Open/Closed Principle - easy to add new providers.
   */
  private createAIProvider(): IAIProvider {
    switch (config.ai.provider) {
      case 'deepseek':
        return new DeepSeekService({
          apiKey: config.ai.deepseek.apiKey,
          baseURL: config.ai.deepseek.baseURL,
          model: config.ai.deepseek.model,
        });
      case 'claude':
        return new ClaudeService({
          apiKey: config.ai.claude.apiKey,
          model: config.ai.claude.model,
          maxTokens: config.ai.claude.maxTokens,
        });
      // Easy to add more providers in the future:
      // case 'openai':
      //   return new OpenAIService(config.ai.openai);
      default:
        throw new Error(`Unsupported AI provider: ${config.ai.provider}`);
    }
  }

  /**
   * Sets up application routes
   */
  private setupRoutes(): void {
    const chatRoutes = createChatRoutes(this.chatController);
    this.app.use('/api', chatRoutes);
  }

  /**
   * Sets up error handling middleware (must be last)
   */
  private setupErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  /**
   * Starts the Express server
   */
  public start(): void {
    this.app.listen(config.server.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.server.port}`);
      console.log(`🤖 AI Provider: ${this.aiProvider.getProviderName()}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }
}

// Bootstrap the application
const app = new Application();
app.start();
