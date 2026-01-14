# AI PR Review через MCP

Автоматический анализ Pull Request с помощью AI через MCP (Model Context Protocol), использующий RAG для контекстной осведомленности и DeepSeek API для генерации ревью.

## Архитектура

```
┌─────────────────┐
│   Chatbot       │
│   (User)        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Git MCP Server                    │
│   Tool: review_pr                   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   PR Review Service                 │
│   ┌─────────────────────────────┐   │
│   │  1. Git MCP Tools           │   │
│   │     - git_pr_diff           │   │
│   │     - git_pr_changed_files  │   │
│   │     - git_compare_branches  │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │  2. RAG MCP Server          │   │
│   │     - rag_query             │   │
│   │     - Ollama embeddings     │   │
│   │     - Vector search         │   │
│   │     - Documentation context │   │
│   │     - .env.example check    │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │  3. DeepSeek LLM            │   │
│   │     - Code analysis         │   │
│   │     - Review generation     │   │
│   │     - Env var validation    │   │
│   └─────────────────────────────┘   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Review Result  │
│  (Markdown)     │
└─────────────────┘
```

## Возможности

- ✅ **Анализ кода**: проверка качества, стиля, best practices
- 🔒 **Безопасность**: поиск уязвимостей (XSS, SQL injection, etc.)
- ⚡ **Производительность**: выявление неоптимальных решений
- 📚 **Документация**: проверка комментариев и README
- 🧪 **Тесты**: анализ покрытия и качества тестов
- 🔍 **RAG-контекст**: использование документации проекта для анализа
- 🌍 **Валидация env переменных**: проверка, что все `process.env.*` задокументированы в `.env.example`

## Установка

### 1. Настройка DeepSeek API

1. Получите API ключ на [DeepSeek Platform](https://platform.deepseek.com/)
2. Добавьте ключ в `.env`:

```bash
DEEPSEEK_API_KEY=your-api-key-here
```

### 2. Настройка Git MCP Server

Убедитесь, что Git MCP Server включен в `.env`:

```bash
MCP_GIT_ENABLED=true
```

### 3. Настройка RAG (опционально, но рекомендуется)

Для использования RAG с документацией проекта и валидации env переменных:

1. Убедитесь, что Ollama запущен:

```bash
ollama serve
ollama pull nomic-embed-text
```

2. Настройте RAG MCP в `.env`:

```bash
MCP_RAG_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

3. Убедитесь, что документация проиндексирована (включая `.env.example`):

```bash
# Если есть скрипт инициализации
npm run rag:init
```

## Использование

### Автоматическое обнаружение активных PR

Чатбот может самостоятельно находить активные pull requests и предлагать их для ревью:

```
"Какие сейчас открыты PR?"

"Покажи активные pull requests"

"Есть ли PR для ревью?"
```

Чатбот использует GitHub CLI для получения списка PR и может предложить провести ревью любого из них.

### Ревью конкретного PR

Вы также можете напрямую попросить провести ревью:

```
"Проведи ревью PR, сравни main и feature-branch"
```

или

```
"Review my PR comparing origin/main to HEAD"
```

### Параметры

Чатбот может использовать следующие параметры (передаются автоматически через MCP):

- **baseBranch** (обязательно): базовая ветка для сравнения (например, "main", "origin/main")
- **headBranch** (обязательно): ветка или коммит для ревью (например, "feature-branch", "HEAD")
- **includeCodeQuality** (опционально, по умолчанию true): проверка качества кода
- **includeSecurity** (опционально, по умолчанию true): проверка безопасности
- **includePerformance** (опционально, по умолчанию true): анализ производительности
- **includeDocumentation** (опционально, по умолчанию true): проверка документации
- **includeTests** (опционально, по умолчанию true): анализ тестов
- **useRAG** (опционально, по умолчанию true): использовать RAG для контекста
- **ragThreshold** (опционально, по умолчанию 0.5): минимальный score для RAG
- **ragTopN** (опционально, по умолчанию 3): количество документов из RAG

### Примеры запросов

**Автоматическое обнаружение и ревью:**
```
"Какие PR сейчас открыты?"
→ Чатбот вызовет list_active_prs и покажет список

"Проведи ревью первого PR из списка"
→ Чатбот использует информацию из предыдущего ответа

"Покажи все PR включая закрытые"
→ Чатбот вызовет list_active_prs с параметром state: 'all'
```

**Прямое ревью:**
```
"Проведи ревью PR между main и task20"

"Review the changes between origin/main and my current branch, focus on security"

"Analyze the PR from main to feature-auth with code quality checks only"
```

## Формат вывода

Ревью возвращается в формате markdown:

```markdown
## 🤖 AI Code Review

### Summary
Краткое описание изменений и общее впечатление

### 📊 Statistics
- Files Changed: 5
- Lines Added: 120
- Lines Deleted: 45
- Commits: 3
- Review Duration: 12345 ms

### ✅ Positive Points
- Хорошо структурированный код
- Добавлены unit тесты
- Понятные имена переменных

### 💡 Suggestions
- `src/service.ts:42` [code_quality]
  Рекомендуется вынести магическое число в константу

- `src/api.ts:15` [performance]
  Можно использовать мемоизацию для оптимизации

### 🔴 Critical Issues
- `src/auth.ts:28` [security]
  Обнаружена потенциальная SQL injection уязвимость

- `general` [documentation]
  Environment variable DEEPSEEK_API_KEY_TEST used but not documented in .env.example

### 📚 Relevant Documentation
1. **.env.example** (Chunk 1, relevance: 0.85)
   ```
   DEEPSEEK_API_KEY=
   OLLAMA_BASE_URL=http://localhost:11434
   ...
   ```

2. **coding-standards.md** (Chunk 2, relevance: 0.72)
   Best practices for code organization...

### 📋 Metadata
- Reviewed at: 2024-01-13T10:30:00.000Z
- Model: deepseek-chat
- RAG used: Yes
- Analysis options: code_quality, security, performance, documentation, tests

---
🤖 Reviewed by AI
```

## Валидация Environment Variables

Система автоматически проверяет, что все переменные окружения, используемые в коде (`process.env.*`), задокументированы в `.env.example`.

### Как это работает

1. RAG MCP извлекает содержимое `.env.example` из векторной базы
2. DeepSeek LLM анализирует изменения в коде
3. Если найдено использование `process.env.VARIABLE_NAME`, но `VARIABLE_NAME` отсутствует в `.env.example`, это попадает в **Critical Issues**

Пример критической ошибки:

```
🔴 Critical Issues
- general [documentation]
  Environment variable DEEPSEEK_API_KEY_TEST used but not documented in .env.example
```

### Требования для валидации

- `.env.example` должен быть проиндексирован в RAG базе
- `useRAG` должен быть `true` (по умолчанию)
- DeepSeek LLM автоматически проверяет env переменные согласно системному промпту

## Настройка параметров анализа

### Параметры по умолчанию

В `backend/src/services/pr-review.service.ts`:

```typescript
const DEFAULT_ANALYSIS_OPTIONS: Required<AnalysisOptions> = {
  includeCodeQuality: true,      // Анализ качества кода
  includeSecurity: true,         // Проверка безопасности
  includePerformance: true,      // Анализ производительности
  includeDocumentation: true,    // Проверка документации
  includeTests: true,            // Анализ тестов
  useRAG: true,                  // Использовать RAG
  ragThreshold: 0.5,             // Минимальный score для RAG
  ragTopN: 3,                    // Количество документов из RAG
};
```

### Изменение промптов

Системный промпт находится в методе `getSystemPrompt()` в `pr-review.service.ts`:

```typescript
private getSystemPrompt(): string {
  return `You are an expert code reviewer AI...

  **IMPORTANT**: If you find any process.env.VARIABLE_NAME used in the code changes:
  1. Check if VARIABLE_NAME exists in the .env.example documentation provided
  2. If NOT found in .env.example, add to CRITICAL issues
  `;
}
```

## Файлы и компоненты

### Основные файлы

- **`backend/src/services/mcp/servers/git-mcp-server.ts`** - Git MCP Server с tool `review_pr`
- **`backend/src/services/pr-review.service.ts`** - Основной сервис анализа
- **`shared/src/types/pr-review.types.ts`** - TypeScript типы
- **`backend/src/services/mcp/servers/rag-mcp-server.ts`** - RAG MCP Server

### MCP Tools

#### list_active_prs

Tool для получения списка активных pull requests:

```typescript
{
  name: 'list_active_prs',
  description: 'List all active pull requests in the repository',
  inputSchema: {
    type: 'object',
    properties: {
      state: {
        type: 'string',
        description: 'Filter by PR state: "open" (default), "closed", "merged", or "all"',
        enum: ['open', 'closed', 'merged', 'all'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of PRs to return (default: 10)',
      },
    },
  },
}
```

**Требования:**
- GitHub CLI (`gh`) должен быть установлен и авторизован
- Команда для установки: `brew install gh` (macOS) или см. https://cli.github.com/
- Авторизация: `gh auth login`

**Пример вывода:**
```markdown
## Open Pull Requests (2)

### #42: Add user authentication feature

- **Status:** OPEN
- **Author:** username
- **Branches:** `main` ← `feature-auth`
- **Created:** 1/13/2025
- **Updated:** 1/14/2025
- **URL:** https://github.com/owner/repo/pull/42
- **Review Command:** Use `review_pr` tool with `baseBranch: "main"` and `headBranch: "feature-auth"`

---

### #41: Fix login bug

- **Status:** OPEN
- **Author:** username2
- **Branches:** `main` ← `bugfix-login`
- **Created:** 1/12/2025
- **Updated:** 1/14/2025
- **URL:** https://github.com/owner/repo/pull/41
- **Review Command:** Use `review_pr` tool with `baseBranch: "main"` and `headBranch: "bugfix-login"`

---
```

#### review_pr

Основной tool для проведения PR ревью:

```typescript
{
  name: 'review_pr',
  description: 'Perform AI-powered code review of a pull request',
  inputSchema: {
    type: 'object',
    properties: {
      baseBranch: { type: 'string', description: 'Base branch (e.g., "main")' },
      headBranch: { type: 'string', description: 'Head branch (e.g., "feature")' },
      // ... analysis options
    },
    required: ['baseBranch', 'headBranch'],
  },
}
```

## Troubleshooting

### Ошибка: "GitHub CLI (gh) is not installed or not authenticated"

**Проблема:** GitHub CLI не установлен или не авторизован.

**Решение:**
1. Установите GitHub CLI:
   - macOS: `brew install gh`
   - Windows: `winget install --id GitHub.cli`
   - Linux: см. https://cli.github.com/
2. Авторизуйтесь: `gh auth login`
3. Проверьте статус: `gh auth status`

### Ошибка: "DEEPSEEK_API_KEY environment variable is required"

**Решение:** Добавьте `DEEPSEEK_API_KEY` в `.env` файл.

### Ошибка: "Tool 'review_pr' not found"

**Проблема:** Git MCP Server не включен.

**Решение:** Проверьте, что `MCP_GIT_ENABLED=true` в `.env`.

### RAG не работает / No embeddings found

**Проблема:** Нет эмбеддингов в базе данных.

**Решение:**
1. Проверьте, что Ollama запущен: `ollama list`
2. Проверьте, что модель загружена: `ollama pull nomic-embed-text`
3. Убедитесь, что документация проиндексирована
4. Или отключите RAG: передайте `useRAG: false` через параметры

### Валидация env переменных не работает

**Проблема:** `.env.example` не найден в RAG базе.

**Решение:**
1. Убедитесь, что `.env.example` существует в корне проекта
2. Проиндексируйте его в RAG базе
3. Проверьте RAG query логи: должен быть запрос `.env.example environment variables`

### Git ошибки "unknown revision"

**Проблема:** Ветка не существует или неправильное имя.

**Решение:**
1. Проверьте имена веток: `git branch -a`
2. Используйте полное имя для удаленных веток: `origin/main`, `origin/feature`
3. Для текущей ветки используйте: `HEAD`

## Расширение функциональности

### Добавление новых категорий анализа

1. Обновите тип `ReviewComment['category']` в `shared/src/types/pr-review.types.ts`:

```typescript
export interface ReviewComment {
  category: 'code_quality' | 'security' | 'performance' |
            'documentation' | 'tests' | 'best_practices' | 'your_new_category';
}
```

2. Добавьте логику категоризации в `pr-review.service.ts`:

```typescript
private categorizeComment(message: string): ReviewComment['category'] {
  const lower = message.toLowerCase();

  if (lower.includes('your_keyword')) {
    return 'your_new_category';
  }

  // ... existing logic
}
```

### Настройка системного промпта

Измените промпт для более специфичных проверок:

```typescript
private getSystemPrompt(): string {
  return `You are an expert code reviewer AI...

  Additional focus areas:
  - Check for TypeScript strict mode compliance
  - Verify error handling patterns
  - Ensure proper logging practices
  `;
}
```

### Добавление новых Git MCP tools

В `backend/src/services/mcp/servers/git-mcp-server.ts`:

```typescript
{
  name: 'git_custom_analysis',
  description: 'Your custom git analysis tool',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string' }
    },
  },
}
```

## Лицензия

MIT

## Поддержка

Если возникли вопросы или проблемы, создайте Issue в репозитории.
