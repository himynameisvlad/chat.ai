# AI PR Review Setup Guide

Автоматический анализ Pull Request с помощью AI, использующий RAG (Retrieval-Augmented Generation) для контекстной осведомленности и DeepSeek API для генерации ревью.

## Архитектура

```
┌─────────────────┐
│   GitHub PR     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   GitHub Actions Workflow           │
│   (.github/workflows/pr-review.yml) │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Review Script                     │
│   (scripts/review-pr.ts)            │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   PR Review Service                 │
│   ┌─────────────────────────────┐   │
│   │  1. Git MCP Server          │   │
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
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │  3. DeepSeek LLM            │   │
│   │     - Code analysis         │   │
│   │     - Review generation     │   │
│   └─────────────────────────────┘   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  PR Comment     │
└─────────────────┘
```

## Возможности

- ✅ **Анализ кода**: проверка качества, стиля, best practices
- 🔒 **Безопасность**: поиск уязвимостей (XSS, SQL injection, etc.)
- ⚡ **Производительность**: выявление неоптимальных решений
- 📚 **Документация**: проверка комментариев и README
- 🧪 **Тесты**: анализ покрытия и качества тестов
- 🔍 **RAG-контекст**: использование документации проекта для анализа

## Установка

### 1. Настройка DeepSeek API

1. Получите API ключ на [DeepSeek Platform](https://platform.deepseek.com/)
2. Добавьте секрет в GitHub:
   - Перейдите в Settings → Secrets and variables → Actions
   - Создайте новый secret: `DEEPSEEK_API_KEY`
   - Вставьте ваш API ключ

### 2. Настройка репозитория

1. Убедитесь, что у GitHub Actions есть права на:
   - Чтение содержимого репозитория
   - Запись комментариев к PR

   В Settings → Actions → General → Workflow permissions:
   - ✅ Read and write permissions
   - ✅ Allow GitHub Actions to create and approve pull requests

### 3. Настройка RAG (опционально)

Для использования RAG с документацией проекта:

1. Убедитесь, что Ollama установлен в workflow (уже настроено)
2. Загрузите документацию в векторную базу:

```bash
# Локально или в CI
npm run rag:init
```

Если RAG не настроен, ревью будет работать без контекста документации.

## Использование

### Автоматический запуск

Workflow запускается автоматически при:
- Создании нового PR
- Обновлении PR (новые коммиты)
- Переоткрытии PR

### Ручной запуск для тестирования

Локально:

```bash
export DEEPSEEK_API_KEY="your-api-key"
export OLLAMA_BASE_URL="http://localhost:11434"
export PR_NUMBER=123
export BASE_BRANCH="main"
export HEAD_BRANCH="feature-branch"
export GITHUB_REPOSITORY_OWNER="owner"
export GITHUB_REPOSITORY="owner/repo"

npm run review:pr
```

## Формат вывода

Ревью публикуется как комментарий к PR в следующем формате:

```markdown
## 🤖 AI Code Review

### Summary
Краткое описание изменений и общее впечатление

### 📊 Statistics
- Files Changed: 5
- Lines Added: 120
- Lines Deleted: 45
- Commits: 3

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
  💭 _Используйте параметризованные запросы_

### 📚 Relevant Documentation
1. **coding-standards.pdf** (relevance: 85%)
   Section: Best Practices

---
🤖 Reviewed by AI (deepseek-chat) • 📚 RAG-enhanced • ⏱️ 2024-01-13 10:30:00
```

## Настройка параметров анализа

### В коде

Измените параметры в `backend/src/services/pr-review.service.ts`:

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

### В workflow

Можно добавить условия запуска или параметры:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches:
      - main
      - develop
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

## Файлы и компоненты

### Основные файлы

- **`.github/workflows/pr-review.yml`** - GitHub Actions workflow
- **`scripts/review-pr.ts`** - Скрипт запуска анализа
- **`backend/src/services/pr-review.service.ts`** - Основной сервис
- **`backend/src/services/mcp/servers/git-mcp-server.ts`** - Git MCP tools
- **`shared/src/types/pr-review.types.ts`** - TypeScript типы

### NPM Scripts

```bash
npm run review:pr          # Запуск PR review
npm run build:shared       # Сборка shared пакета
npm run rag:init          # Инициализация RAG базы (если есть)
```

## Troubleshooting

### Ошибка: "DEEPSEEK_API_KEY environment variable is required"

**Решение:** Убедитесь, что секрет `DEEPSEEK_API_KEY` добавлен в GitHub Secrets.

### Ошибка: "Git MCP tool error"

**Проблема:** MCP сервер не инициализирован.

**Решение:** Проверьте, что Git MCP Server включен в конфигурации MCP.

### RAG не работает

**Проблема:** Нет эмбеддингов в базе данных.

**Решение:**
1. Отключите RAG: `useRAG: false` в опциях
2. Или загрузите документацию в векторную базу

### Workflow не запускается

**Проблема:** Нет прав у GitHub Actions.

**Решение:** Проверьте Workflow permissions в настройках репозитория.

## Расширение функциональности

### Добавление новых Git MCP tools

В `backend/src/services/mcp/servers/git-mcp-server.ts`:

```typescript
{
  name: 'git_custom_tool',
  description: 'Your custom git tool',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string' }
    },
  },
}
```

### Настройка промптов

Измените системный промпт в `pr-review.service.ts`:

```typescript
private getSystemPrompt(): string {
  return `Your custom system prompt...`;
}
```

### Добавление новых категорий анализа

1. Обновите тип `ReviewComment['category']` в `pr-review.types.ts`
2. Добавьте логику категоризации в метод `categorizeComment()`

## Лицензия

MIT

## Поддержка

Если возникли вопросы или проблемы, создайте Issue в репозитории.
