# Backend Architecture

This document explains the design patterns and architectural decisions implemented in the backend.

## Design Patterns & Principles

### 1. SOLID Principles

#### Single Responsibility Principle (SRP)
Each class/module has one reason to change:
- `DeepSeekService` (src/services/ai/deepseek.service.ts:13) - Only handles DeepSeek API interactions
- `ChatService` (src/services/chat.service.ts:9) - Only orchestrates chat logic
- `ChatController` (src/controllers/chat.controller.ts:9) - Only handles HTTP request/response
- `ValidationMiddleware` (src/middleware/validation.middleware.ts:18) - Only validates requests
- `ErrorMiddleware` (src/middleware/error.middleware.ts:8) - Only handles errors

#### Open/Closed Principle (OCP)
Open for extension, closed for modification:
- `IAIProvider` interface (src/interfaces/ai-provider.interface.ts:8) - New AI providers can be added without modifying existing code
- Factory pattern in server.ts (src/server.ts:56) - Easy to add new providers by extending the switch statement

#### Liskov Substitution Principle (LSP)
- Any implementation of `IAIProvider` can be substituted without breaking the application
- `DeepSeekService` can be replaced with `OpenAIService` or `ClaudeService` transparently

#### Interface Segregation Principle (ISP)
- `IAIProvider` interface contains only essential methods that all AI providers must implement
- No client is forced to depend on methods it doesn't use

#### Dependency Inversion Principle (DIP)
- High-level modules (`ChatService`) depend on abstractions (`IAIProvider`), not concrete implementations
- `ChatService` doesn't know about `DeepSeekService` - it only knows about `IAIProvider`

### 2. Strategy Pattern

The AI provider system uses the Strategy Pattern:
- `IAIProvider` defines the strategy interface
- `DeepSeekService` is a concrete strategy
- Future providers (`OpenAIService`, `ClaudeService`) would be additional strategies
- The strategy is selected at runtime based on configuration

**Benefits:**
- Easy to switch between AI providers
- Easy to add new providers
- Each provider is isolated and testable

### 3. Dependency Injection (DI)

Dependencies are injected through constructors:

```typescript
// In server.ts
const aiProvider = new DeepSeekService(config);      // Create dependency
const chatService = new ChatService(aiProvider);     // Inject into service
const chatController = new ChatController(chatService); // Inject into controller
```

**Benefits:**
- Loose coupling between components
- Easy to test (can inject mock dependencies)
- Clear dependency graph
- Follows Hollywood Principle: "Don't call us, we'll call you"

### 4. Factory Pattern

The `createAIProvider()` method (src/server.ts:56) is a factory:
- Encapsulates object creation logic
- Returns different implementations based on configuration
- Easy to extend with new providers

### 5. Service Layer Pattern

Business logic is separated into service classes:
- `ChatService` - Chat orchestration logic
- `DeepSeekService` - AI provider implementation

**Benefits:**
- Controllers remain thin (only handle HTTP)
- Business logic is reusable
- Easy to test business logic independently

### 6. Middleware Pattern

Express middleware for cross-cutting concerns:
- `validateChatRequest` (src/middleware/validation.middleware.ts:18) - Request validation
- `errorHandler` (src/middleware/error.middleware.ts:8) - Error handling
- `notFoundHandler` (src/middleware/error.middleware.ts:35) - 404 handling

**Benefits:**
- Separation of concerns
- Reusable across routes
- Clean request pipeline

### 7. Configuration Management

Centralized configuration (src/config/app.config.ts:17):
- Single source of truth for all config
- Type-safe configuration
- Validation at startup

**Benefits:**
- Easy to change configuration
- Type safety prevents errors
- Clear configuration structure

## Project Structure

```
backend/src/
├── config/
│   └── app.config.ts           # Centralized configuration
├── interfaces/
│   └── ai-provider.interface.ts # AI provider contract (ISP)
├── services/
│   ├── ai/
│   │   ├── deepseek.service.ts  # DeepSeek implementation (SRP, LSP)
│   │   └── claude.service.ts    # Claude implementation (SRP, LSP)
│   └── chat.service.ts          # Chat orchestration (SRP, DIP)
├── controllers/
│   └── chat.controller.ts       # HTTP handlers (SRP)
├── middleware/
│   ├── error.middleware.ts      # Error handling
│   └── validation.middleware.ts # Request validation (Zod)
├── routes/
│   └── chat.routes.ts           # Route definitions
├── types/
│   └── index.ts                 # Shared types & custom errors
└── server.ts                    # App initialization & DI container
```

## Supported AI Providers

### Current Implementations

1. **DeepSeek** (src/services/ai/deepseek.service.ts:13)
   - OpenAI-compatible API
   - Streaming support
   - Configurable model and base URL

2. **Claude** (src/services/ai/claude.service.ts:13)
   - Anthropic API
   - Streaming support
   - Configurable model and max tokens
   - Models: claude-3-5-sonnet, claude-3-opus, etc.

### Adding a New AI Provider

To add a new AI provider (e.g., OpenAI):

1. **Create the service** (implements `IAIProvider`):
```typescript
// src/services/ai/openai.service.ts
export class OpenAIService implements IAIProvider {
  async streamChat(messages: Message[], response: StreamResponse): Promise<void> {
    // Implementation
  }

  getProviderName(): string {
    return 'OpenAI';
  }
}
```

2. **Add configuration** in `app.config.ts`:
```typescript
openai: {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4',
}
```

3. **Update factory** in `server.ts`:
```typescript
case 'openai':
  return new OpenAIService(config.ai.openai);
```

That's it! No existing code needs to be modified (Open/Closed Principle).

## Testing Strategy

The architecture enables easy testing:

### Unit Tests
- **Services**: Mock dependencies via constructor injection
- **Controllers**: Mock services
- **Middleware**: Test in isolation

Example:
```typescript
// Test ChatService
const mockAIProvider: IAIProvider = {
  streamChat: jest.fn(),
  getProviderName: () => 'Mock',
};
const chatService = new ChatService(mockAIProvider);
```

### Integration Tests
- Test full request flow
- Use test AI provider or mock responses

## Error Handling

Custom `AppError` class (src/types/index.ts:15):
- Operational errors (expected) vs programming errors (unexpected)
- Consistent error responses
- Proper HTTP status codes

Error flow:
1. Error thrown in service/controller
2. Caught by error middleware
3. Formatted response sent to client

## Type Safety

- TypeScript throughout
- Zod for runtime validation
- Interfaces for contracts
- Type guards where needed

## Best Practices Applied

1. **No magic strings/numbers**: All config in config file
2. **Clear naming**: Functions/classes describe their purpose
3. **Comments**: Document "why", not "what"
4. **Immutability**: Prefer const, avoid mutations where possible
5. **Error handling**: Proper try/catch and error propagation
6. **Async/await**: Clean asynchronous code
7. **Type annotations**: Explicit types for clarity

## Future Improvements

Potential enhancements while maintaining architecture:

1. **Caching Layer**: Add caching service (new strategy)
2. **Rate Limiting**: Middleware for API rate limits
3. **Logging**: Structured logging service
4. **Metrics**: Add monitoring service
5. **Authentication**: Auth middleware + user service
6. **Database**: Add repository pattern if persistence needed
7. **Message Queue**: For async processing
8. **Testing**: Unit + integration test suite

All can be added without breaking existing code (Open/Closed Principle).
