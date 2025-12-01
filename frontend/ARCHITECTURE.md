# Frontend Architecture

This document explains the design patterns and architectural decisions implemented in the React frontend.

## Design Patterns & Principles

### 1. Custom Hooks Pattern

Custom hooks extract business logic from components, following the Container/Presenter pattern.

#### **useChat Hook** (src/hooks/useChat.ts)
- Manages all chat state (messages, loading, errors)
- Handles API communication
- Provides clean interface: `{ messages, isLoading, error, sendMessage, clearError }`
- **Benefits**: Reusable, testable, separates logic from UI

#### **useAutoScroll Hook** (src/hooks/useAutoScroll.ts)
- Handles automatic scrolling to bottom
- Reusable across any component needing auto-scroll
- **Benefits**: Single Responsibility, easy to test

### 2. Component Composition

Breaking down monolithic components into smaller, focused pieces.

**Before**: One 148-line Chat.tsx doing everything
**After**: Multiple small components with clear responsibilities

- **Chat.tsx** (~30 lines) - Orchestration only
- **MessageList.tsx** (~20 lines) - Display messages
- **Message.tsx** (~30 lines) - Single message rendering
- **MessageInput.tsx** (~60 lines) - Input handling
- **EmptyState.tsx** (~10 lines) - Empty state display

### 3. Service Layer Pattern

**ChatService** (src/services/chat.service.ts:23)
- Encapsulates all API communication
- Custom error handling with `ChatServiceError`
- Singleton pattern for easy access
- Stream processing abstracted away
- **Benefits**: Testable, reusable, single source of API logic

### 4. Configuration Management

**app.config.ts** (src/config/app.config.ts)
- Centralized configuration
- Type-safe
- Easy to modify
- **Benefits**: Single source of truth

### 5. Type Safety

Strong TypeScript usage throughout:
- Interface for all component props
- Type imports for React types
- Custom types in `types/index.ts`
- Proper return types for hooks

## Project Structure

```
frontend/src/
├── config/
│   └── app.config.ts          # Centralized config
├── services/
│   └── chat.service.ts        # API communication layer
├── hooks/
│   ├── useChat.ts             # Chat business logic
│   └── useAutoScroll.ts       # Auto-scroll logic
├── components/
│   └── Chat/
│       ├── index.ts           # Barrel exports
│       ├── Chat.tsx           # Main orchestrator (thin)
│       ├── MessageList.tsx    # Message display
│       ├── Message.tsx        # Single message
│       ├── MessageInput.tsx   # Input component
│       └── EmptyState.tsx     # Empty state
├── types/
│   └── index.ts               # Shared types
├── App.tsx                    # App wrapper
└── main.tsx                   # Entry point
```

## Before vs After Comparison

### Before (Monolithic)

**Chat.tsx (148 lines)**:
```typescript
// All in one file:
- State management (messages, input, loading)
- API calls with fetch
- Error handling
- Scroll logic
- Form handling
- Message rendering
- Input rendering
- Empty state
```

**Problems**:
- Hard to test individual pieces
- Hard to reuse logic
- Tight coupling
- Difficult to maintain

### After (Composable)

**useChat.ts (~90 lines)**:
```typescript
// Business logic only
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // ... all logic here
  return { messages, isLoading, sendMessage };
}
```

**Chat.tsx (~30 lines)**:
```typescript
// Thin orchestration
export function Chat() {
  const { messages, isLoading, sendMessage } = useChat();
  const scrollRef = useAutoScroll(messages);

  return (
    <div>
      <MessageList messages={messages} scrollRef={scrollRef} />
      <MessageInput onSendMessage={sendMessage} isLoading={isLoading} />
    </div>
  );
}
```

**Benefits**:
✅ Each piece is testable independently
✅ Logic is reusable (useChat can be used elsewhere)
✅ Components have single responsibility
✅ Easy to add new features
✅ Clear separation of concerns

## Key React Patterns Applied

### 1. Container/Presenter Pattern
- **Container** (useChat): Business logic, state management
- **Presenter** (Chat, Message, etc.): UI rendering only

### 2. Single Responsibility Principle
Each component/hook does ONE thing:
- `useChat` → Manages chat state
- `useAutoScroll` → Handles scrolling
- `Message` → Renders a message
- `MessageInput` → Handles input
- `EmptyState` → Shows empty state

### 3. Composition over Inheritance
- Small, composable components
- Build complex UIs from simple pieces
- No class components, all functional

### 4. Prop Drilling Avoidance
- Hooks provide clean data access
- No need to pass props through many levels
- Each component gets exactly what it needs

## Testing Strategy

The architecture enables easy testing:

### Unit Testing Hooks
```typescript
// Test useChat
const { result } = renderHook(() => useChat());

expect(result.current.messages).toEqual([]);
act(() => {
  result.current.sendMessage('Hello');
});
// Assert state changes
```

### Unit Testing Components
```typescript
// Test Message component
render(<Message message={{ role: 'user', content: 'Hi' }} />);
expect(screen.getByText('Hi')).toBeInTheDocument();
```

### Integration Testing
```typescript
// Test full Chat flow
render(<Chat />);
const input = screen.getByPlaceholderText(/type your message/i);
fireEvent.change(input, { target: { value: 'Hello' } });
fireEvent.click(screen.getByText('Send'));
// Assert API was called, message appears, etc.
```

## Benefits Summary

1. **Maintainability**: Each file has clear purpose
2. **Testability**: Easy to test hooks and components separately
3. **Reusability**: Hooks and components can be reused
4. **Scalability**: Easy to add features without breaking existing code
5. **Type Safety**: TypeScript catches errors early
6. **Developer Experience**: Clear structure, easy to navigate
7. **Performance**: Can optimize components individually

## Common Use Cases

### Adding a New Feature (e.g., File Upload)

**Before (Monolithic)**:
- Modify 148-line Chat.tsx
- Risk breaking existing functionality
- Hard to test new feature in isolation

**After (Composable)**:
1. Create `useFileUpload` hook
2. Create `FileUpload` component
3. Add to `Chat.tsx` composition
4. Test independently
5. No risk to existing features

### Adding New Message Type (e.g., Image)

**Before**: Modify message rendering in Chat.tsx

**After**:
1. Update `Message.tsx` component only
2. Add image rendering logic
3. Test Message component
4. Done - no other files affected

### Switching API Provider

**Before**: Find and replace API calls throughout Chat.tsx

**After**:
1. Update `ChatService` only
2. All components automatically work
3. Single place to change

## Best Practices Applied

1. ✅ **Separation of Concerns**: Logic, UI, and data are separated
2. ✅ **DRY (Don't Repeat Yourself)**: Shared logic in hooks
3. ✅ **KISS (Keep It Simple)**: No over-engineering
4. ✅ **Type Safety**: TypeScript throughout
5. ✅ **Explicit Naming**: Clear, descriptive names
6. ✅ **Comments**: Document "why", not "what"
7. ✅ **Consistent Style**: Same patterns throughout

## What We Avoided

❌ **Redux/MobX**: Overkill for this app size
❌ **Complex State Management**: Simple useState is enough
❌ **Too Many Abstractions**: Kept it practical
❌ **Over-Engineering**: No unnecessary patterns
❌ **Class Components**: All functional for consistency

## Future Enhancements

Easy to add without breaking existing code:

1. **Message Persistence**: Add localStorage in useChat
2. **Typing Indicators**: Add state + UI in MessageList
3. **Message Reactions**: Extend Message component
4. **File Uploads**: New useFileUpload hook + component
5. **Message Search**: New useMessageSearch hook
6. **Dark Mode**: Add theme context (simple addition)
7. **Multiple Chats**: Extend useChat to manage multiple conversations
8. **Voice Input**: New component + hook

All follow the same patterns, easy to implement!

## Comparison: Lines of Code

### Before
- `Chat.tsx`: 148 lines (monolithic)
- `api.ts`: 58 lines
- **Total**: ~206 lines in 2 files

### After
- `Chat.tsx`: 30 lines (orchestration)
- `useChat.ts`: 90 lines (logic)
- `useAutoScroll.ts`: 15 lines (utility)
- `ChatService.ts`: 120 lines (API)
- `Message.tsx`: 30 lines (UI)
- `MessageList.tsx`: 20 lines (UI)
- `MessageInput.tsx`: 60 lines (UI)
- `EmptyState.tsx`: 10 lines (UI)
- `app.config.ts`: 15 lines (config)
- **Total**: ~390 lines in 9 files

**Why more lines?**
- Better structure and organization
- More comments and documentation
- Better error handling
- Type safety with interfaces
- Each piece is testable
- Much easier to maintain

**Key Point**: Not about fewer lines, it's about better organization!

## Conclusion

This architecture demonstrates:
- ✅ Simple but effective patterns
- ✅ React best practices
- ✅ Easy to understand and maintain
- ✅ Scalable without over-engineering
- ✅ Testable and type-safe
- ✅ Real-world practical approach

Perfect balance between simplicity and maintainability!
