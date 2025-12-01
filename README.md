# DeepSeek Chat Application

A modern chat application built with React and TypeScript that uses the DeepSeek API for AI-powered conversations.

## Features

- Real-time streaming responses from DeepSeek AI
- Clean, modern UI with Tailwind CSS
- Markdown support for formatted responses
- Message history management
- TypeScript for type safety
- Responsive design

## Tech Stack

### Frontend
- React 19
- TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Markdown (message formatting)

### Backend
- Node.js
- Express
- TypeScript
- OpenAI SDK (DeepSeek API)
- CORS support

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- DeepSeek API key ([get one here](https://platform.deepseek.com/))

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

# Edit .env and add your DeepSeek API key
# DEEPSEEK_API_KEY=your_api_key_here
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
4. Watch as DeepSeek responds in real-time with streaming!

## Configuration

### Backend Environment Variables

- `DEEPSEEK_API_KEY` - Your DeepSeek API key (required)
- `PORT` - Server port (default: 3001)

### Frontend Environment Variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:3001)

## Project Structure

```
chat/
├── backend/
│   ├── src/
│   │   └── server.ts          # Express server with DeepSeek API integration
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Chat.tsx       # Main chat component
│   │   ├── api.ts             # API client for backend
│   │   ├── types.ts           # TypeScript types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── .env.example
└── README.md
```

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
- Verify your API key is correct and properly set in the `.env` file

### CORS errors
- Ensure the backend is running on port 3001
- Check that the frontend's `VITE_API_URL` matches your backend URL

### Port already in use
- Change the port in backend's `.env` file
- Update `VITE_API_URL` in frontend's `.env` to match

## License

MIT
