#!/bin/bash

# Check database schema for pdf_embeddings table

DB_PATH="backend/data/chat.db"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at $DB_PATH"
    echo "ℹ️  Start the backend server to create it: cd backend && npm run dev"
    exit 1
fi

echo "✅ Database found"
echo ""
echo "📋 Schema for pdf_embeddings table:"
echo "-----------------------------------"

sqlite3 "$DB_PATH" ".schema pdf_embeddings"

echo ""
echo "📊 Checking for chunk_text column:"
echo "-----------------------------------"

if sqlite3 "$DB_PATH" ".schema pdf_embeddings" | grep -q "chunk_text"; then
    echo "✅ chunk_text column EXISTS"
else
    echo "❌ chunk_text column MISSING"
    exit 1
fi

echo ""
echo "📈 Current embeddings count:"
echo "-----------------------------------"
sqlite3 "$DB_PATH" "SELECT COUNT(*) as count FROM pdf_embeddings;" 2>/dev/null || echo "0"

echo ""
echo "✅ Schema verification complete!"
