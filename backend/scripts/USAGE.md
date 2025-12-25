# Research RAG Test Script - Quick Guide

## Базовое использование

```bash
# С параметрами по умолчанию
npm run test:rag

# Показать помощь
npm run test:rag -- --help
```

## Примеры с именованными параметрами

```bash
# Изменить только query
npm run test:rag -- --query "How does entropy calculation work?"

# Короткая форма
npm run test:rag -- -q "What are the memory settings?"

# Несколько параметров
npm run test:rag -- -q "Database configuration" -n 5 -t 0.6

# Все параметры
npm run test:rag -- --query "Processor settings" --topN 3 --threshold 0.7 --initialTopK 15
```

## Параметры

| Флаг | Короткий | Значение | По умолчанию |
|------|----------|----------|--------------|
| `--query` | `-q` | Вопрос для RAG | "What are the memory settings?" |
| `--topN` | `-n` | Количество финальных чанков | 3 |
| `--threshold` | `-t` | Порог релевантности (0-1) | 0.5 |
| `--initialTopK` | `-k` | Кандидатов для reranking | 10 |
| `--help` | `-h` | Показать помощь | - |

## Результат

Скрипт создаст файл `backend/result.md` с детальными результатами, включая:
- Сравнение чанков с/без reranking
- Оценки релевантности от LLM
- Сгенерированные ответы
- Статистику и insights

## Требования

Перед запуском убедитесь:
1. ✅ Backend запущен: `npm run dev`
2. ✅ Ollama работает: `ollama list`
3. ✅ Модель установлена: `llama3.2:1b`
4. ✅ В БД есть embeddings
