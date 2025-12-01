# AI Chat Application

A modern, extensible chat application built with React and TypeScript that supports multiple AI providers including DeepSeek and Claude (Anthropic). Features a clean architecture following SOLID principles and design patterns.

## Features

- **Multiple AI Providers**: Support for DeepSeek and Claude (Anthropic) with easy extensibility
- **Real-time Streaming**: Streaming responses from AI providers
- **Clean Architecture**: SOLID principles, Strategy pattern, Dependency Injection
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Markdown Support**: Formatted AI responses with React Markdown
- **Type Safety**: Full TypeScript coverage with runtime validation (Zod)
- **Error Handling**: Comprehensive error handling and validation
- **Composable Components**: Well-structured React components with custom hooks

## Tech Stack

### Frontend
- React 19
- TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Markdown (message formatting)

### Backend
- Node.js & Express
- TypeScript
- Multiple AI SDKs:
  - Anthropic SDK (Claude)
  - OpenAI SDK (DeepSeek)
- Zod (validation)
- CORS support

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- API key for your chosen AI provider:
  - DeepSeek API key: [Get one here](https://platform.deepseek.com/)
  - Claude API key: [Get one here](https://console.anthropic.com/)

## Installation

### 1. Clone and setup

```bash
# Navigate to the project directory
cd chat
```

### 2. Backend Setup

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and configure your AI provider
# Choose either DeepSeek or Claude (or configure both)
```

**Environment Variables** (`.env`):
```bash
# AI Provider Selection
AI_PROVIDER=claude  # Options: 'deepseek' or 'claude'

# DeepSeek Configuration (if using DeepSeek)
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Claude Configuration (if using Claude)
CLAUDE_API_KEY=your_claude_api_key
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_MAX_TOKENS=4096

# Server Configuration
PORT=3001
```

### 3. Frontend Setup

```bash
# Navigate to frontend folder (from project root)
cd frontend

# Install dependencies
npm install

# Create environment file (optional)
cp .env.example .env
```

## Running the Application

You need to run both the backend and frontend servers.

### Terminal 1 - Backend

```bash
cd backend
npm run dev
```

The backend will start on http://localhost:3001

### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

The frontend will start on http://localhost:5173 (or another port if 5173 is busy)

## Usage

1. Open your browser and navigate to the frontend URL (typically http://localhost:5173)
2. Type your message in the input field
3. Press Enter or click Send
4. Watch as the AI responds in real-time with streaming!

## Configuration

### Switching AI Providers

To switch between AI providers, simply change the `AI_PROVIDER` value in your backend `.env` file:

```bash
# Use Claude
AI_PROVIDER=claude

# Or use DeepSeek
AI_PROVIDER=deepseek
```

Then restart your backend server. The application architecture uses the Strategy Pattern, making provider switching seamless.

### Backend Environment Variables

**Core Settings:**
- `AI_PROVIDER` - Which AI provider to use: `deepseek` or `claude`
- `PORT` - Server port (default: 3001)

**DeepSeek Settings:**
- `DEEPSEEK_API_KEY` - Your DeepSeek API key
- `DEEPSEEK_MODEL` - Model to use (default: deepseek-chat)
- `DEEPSEEK_BASE_URL` - API base URL (default: https://api.deepseek.com)

**Claude Settings:**
- `CLAUDE_API_KEY` - Your Claude API key
- `CLAUDE_MODEL` - Model to use (default: claude-3-5-sonnet-20241022)
- `CLAUDE_MAX_TOKENS` - Max response tokens (default: 4096)

### Frontend Environment Variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:3001)

### Adding a New AI Provider

Thanks to the Strategy Pattern and Open/Closed Principle, adding a new provider is easy:

1. Create a new service implementing `IAIProvider` interface
2. Add configuration in `app.config.ts`
3. Update the factory in `server.ts`

No existing code needs modification! See `backend/ARCHITECTURE.md` for details.

## Building for Production

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
npm run preview
```

The built files will be in the `frontend/dist` directory.

## Troubleshooting

### "API key not found" error
- Make sure you've created a `.env` file in the backend folder
- Verify your API key for your chosen provider is correct
- Check that `AI_PROVIDER` matches the provider whose key you've set

### CORS errors
- Ensure the backend is running on port 3001
- Check that the frontend's `VITE_API_URL` matches your backend URL
- Verify the backend CORS configuration

### Port already in use
- Change the `PORT` in backend's `.env` file
- Update `VITE_API_URL` in frontend's `.env` to match

### Provider switching not working
- Restart the backend server after changing `AI_PROVIDER`
- Ensure the new provider's API key is configured
- Check backend logs for provider initialization messages

### Stream not displaying
- Check browser console for errors
- Verify the backend is running and accessible
- Ensure your API key has sufficient credits/quota

## License

MIT
