#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001/api/research-rag';
const OUTPUT_FILE = path.join(__dirname, '..', 'result.md');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    query: 'What are the memory settings?',
    topN: 3,
    threshold: 0.5,
    initialTopK: 10,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--query' || arg === '-q') {
      config.query = nextArg;
      i++;
    } else if (arg === '--topN' || arg === '-n') {
      config.topN = parseInt(nextArg);
      i++;
    } else if (arg === '--threshold' || arg === '-t') {
      config.threshold = parseFloat(nextArg);
      i++;
    } else if (arg === '--initialTopK' || arg === '-k') {
      config.initialTopK = parseInt(nextArg);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
Research RAG Test Script

Usage: npm run test:rag -- [options]

Options:
  -q, --query <text>         Query to test (default: "What are the memory settings?")
  -n, --topN <number>        Number of final chunks (default: 3)
  -t, --threshold <number>   Relevance threshold 0-1 (default: 0.5)
  -k, --initialTopK <number> Number of candidates for reranking (default: 10)
  -h, --help                 Show this help message

Examples:
  npm run test:rag -- --query "How does entropy work?" --topN 5
  npm run test:rag -- -q "Database config" -n 3 -t 0.6
  npm run test:rag -- -q "Memory settings" -n 2 -t 0.7 -k 15
  `);
}

// Configuration
const config = parseArgs();

async function testResearchRAG() {
  console.log('🔍 Testing Research RAG...');
  console.log(`Query: "${config.query}"`);
  console.log(`Parameters: topN=${config.topN}, threshold=${config.threshold}, initialTopK=${config.initialTopK}`);
  console.log();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error || response.statusText}`);
    }

    const data = await response.json();

    // Generate markdown
    const markdown = generateMarkdown(data);

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, markdown, 'utf8');

    console.log('✅ Results written to:', OUTPUT_FILE);
    console.log();
    console.log('📊 Summary:');
    console.log(`  - Chunks with reranking: ${data.metadata.chunksUsed.withReranking}`);
    console.log(`  - Chunks without reranking: ${data.metadata.chunksUsed.withoutReranking}`);
    console.log(`  - Filtered chunks: ${Math.abs(data.metadata.chunksUsed.withReranking - data.metadata.chunksUsed.withoutReranking)}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function generateMarkdown(data) {
  const timestamp = new Date().toISOString();

  let md = `# Research RAG Test Results\n\n`;
  md += `**Generated:** ${timestamp}\n\n`;
  md += `---\n\n`;

  // Query and Parameters
  md += `## Query\n\n`;
  md += `**"${data.query}"**\n\n`;

  md += `### Parameters\n\n`;
  md += `- **Top N:** ${data.parameters.topN}\n`;
  md += `- **Threshold:** ${data.parameters.threshold}\n`;
  md += `- **Initial Top K:** ${data.parameters.initialTopK}\n\n`;

  // Metadata
  md += `## Statistics\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total chunks in database | ${data.metadata.totalChunks} |\n`;
  md += `| Chunks above threshold (with reranking) | ${data.metadata.chunksAboveThreshold.withReranking} |\n`;
  md += `| Chunks above threshold (without reranking) | ${data.metadata.chunksAboveThreshold.withoutReranking} |\n`;
  md += `| Chunks used (with reranking) | ${data.metadata.chunksUsed.withReranking} |\n`;
  md += `| Chunks used (without reranking) | ${data.metadata.chunksUsed.withoutReranking} |\n\n`;

  // Chunks Comparison
  md += `## Retrieved Chunks Comparison\n\n`;

  md += `### With Reranking (LLM-based)\n\n`;
  if (data.chunksWithReranking.length > 0) {
    data.chunksWithReranking.forEach((chunk, idx) => {
      md += `#### Chunk ${idx + 1}\n`;
      md += `- **LLM Relevance Score:** ${chunk.relevanceScore.toFixed(3)}\n`;
      md += `- **Cosine Similarity:** ${chunk.similarity.toFixed(3)}\n`;
      md += `- **Source:** ${chunk.filename}\n\n`;
      md += `**Content:**\n`;
      md += `\`\`\`\n${chunk.text}\n\`\`\`\n\n`;
    });
  } else {
    md += `*No chunks passed the threshold.*\n\n`;
  }

  md += `### Without Reranking (Cosine similarity only)\n\n`;
  if (data.chunksWithoutReranking.length > 0) {
    data.chunksWithoutReranking.forEach((chunk, idx) => {
      md += `#### Chunk ${idx + 1}\n`;
      md += `- **Cosine Similarity:** ${chunk.similarity.toFixed(3)}\n`;
      md += `- **Source:** ${chunk.filename}\n\n`;
      md += `**Content:**\n`;
      md += `\`\`\`\n${chunk.text}\n\`\`\`\n\n`;
    });
  } else {
    md += `*No chunks passed the threshold.*\n\n`;
  }

  // Responses
  md += `---\n\n`;
  md += `## Generated Responses\n\n`;

  md += `### Response WITH Reranking\n\n`;
  md += `${data.responseWithReranking}\n\n`;

  md += `---\n\n`;

  md += `### Response WITHOUT Reranking\n\n`;
  md += `${data.responseWithoutReranking}\n\n`;

  // Insights
  md += `---\n\n`;
  md += `## Key Insights\n\n`;

  const diff = Math.abs(data.chunksWithReranking.length - data.chunksWithoutReranking.length);
  if (diff > 0) {
    md += `- ✅ Reranker filtered **${diff} chunk(s)** that had high cosine similarity but low semantic relevance\n`;
  } else {
    md += `- ℹ️ Both methods selected the same number of chunks\n`;
  }

  if (data.chunksWithReranking.length > 0 && data.chunksWithoutReranking.length > 0) {
    const avgLLMScore = data.chunksWithReranking.reduce((sum, c) => sum + c.relevanceScore, 0) / data.chunksWithReranking.length;
    const avgCosSim = data.chunksWithoutReranking.reduce((sum, c) => sum + c.similarity, 0) / data.chunksWithoutReranking.length;

    md += `- 📊 Average LLM relevance score: **${avgLLMScore.toFixed(3)}**\n`;
    md += `- 📊 Average cosine similarity: **${avgCosSim.toFixed(3)}**\n`;
  }

  md += `\n---\n\n`;
  md += `*Generated by Research RAG Test Script*\n`;

  return md;
}

// Run the test
testResearchRAG();
