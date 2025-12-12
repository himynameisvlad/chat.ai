import express from 'express';
import cors from 'cors';
import { config } from './config/app.config';
import { DeepSeekService } from './services/ai/deepseek.service';
import { HuggingFaceService } from './services/ai/huggingface.service';
import { ChatService } from './services/chat.service';
import { ChatController } from './controllers/chat.controller';
import { createChatRoutes } from './routes/chat.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { IAIProvider } from './interfaces/ai-provider.interface';

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

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private initializeDependencies(): void {
    this.aiProvider = this.createAIProvider();
    this.chatService = new ChatService(this.aiProvider);
    this.chatController = new ChatController(this.chatService);
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
    this.app.use('/api', chatRoutes);
  }

  // Must be called last
  private setupErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public start(): void {
    this.app.listen(config.server.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.server.port}`);
      console.log(`🤖 AI Provider: ${this.aiProvider.getProviderName()}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  }
}

const app = new Application();
app.start();
