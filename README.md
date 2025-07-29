# AI Analyst by E2B - Agentic Data Analysis System
This is an advanced agentic AI-powered data analysis tool built with Next.js and the [E2B SDK](https://e2b.dev/docs). It features multi-turn reasoning, automatic tool selection, and transparent thought processes - just like ChatGPT or Claude.

![Preview](preview.png)

→ Try on [ai-analyst.e2b.dev](https://ai-analyst.e2b.dev/)

## Features
- 🤖 **Agentic Reasoning**: Multi-turn thought process with tool selection and error recovery
- 🧠 **Transparent Thinking**: See the agent's reasoning process in real-time
- 🛠️ **Smart Tool Selection**: Automatically chooses between predefined analysis scripts or custom code
- 📊 **Predefined Analysis Scripts**:
  - **Helium Analysis**: Traffic metrics over time (organic/paid traffic, keywords, costs)
  - **Keyword Analysis**: Search intent classification, branded vs non-branded split
  - **Channel Analysis**: Marketing channel performance (direct, referral, search, social, email)
- 🔄 **Error Recovery**: Automatic retry with different approaches when errors occur
- 🔸 Upload CSV files and get professional analysis
- 🔸 Create interactive charts with Matplotlib

**Powered by:**
- 🔸 ✶ [E2B Sandbox](https://github.com/e2b-dev/code-interpreter)
- 🔸 Vercel's AI SDK
- 🔸 Next.js
- 🔸 echarts library for interactive charts

**Supported LLM Providers:**
- 🔸 TogetherAI
- 🔸 Fireworks

**Supported chart types:**
- 🔸 All the supported charts are descriebd [here](https://e2b.dev/docs/code-interpreting/create-charts-visualizations/interactive-charts#supported-intertactive-charts).

**Make sure to give us a star!**

<img width="165" alt="Screenshot 2024-04-20 at 22 13 32" src="https://github.com/mishushakov/llm-scraper/assets/10400064/11e2a79f-a835-48c4-9f85-5c104ca7bb49">

## How It Works

The AI Analyst uses an agentic architecture similar to ChatGPT or Claude:

1. **Query Analysis**: When you upload a CSV and ask for analysis, the agent first analyzes your request
2. **Tool Selection**: Based on your query, it selects the most appropriate tool:
   - Helium script for traffic/SEO metrics
   - Keyword script for search term analysis
   - Channel script for marketing channel breakdowns
   - Custom code generation for unique requests
3. **Execution**: Runs the selected tool in an E2B sandbox with your data
4. **Error Handling**: If errors occur, the agent analyzes them and retries with adjustments
5. **Results**: Returns charts, processed data, and summary statistics

You can see the agent's thought process in real-time, including its reasoning, tool selection, and confidence levels.

## Get started

Visit the [online version](https://ai-analyst.e2b.dev/) or run locally on your own.

### 1. Clone repository
```
git clone https://github.com/e2b-dev/ai-analyst.git
```

### 2. Install dependencies
```
cd fragments && npm i
```

### 3. Get API keys
Copy `.example.env` to `.env.local` and fill in variables for E2B and one LLM provider.

E2B: `E2B_API_KEY`

- Get your [E2B API key here](https://e2b.dev/dashboard?tab=keys).

LLM Providers:

- Fireworks: `FIREWORKS_API_KEY`
- Together AI: `TOGETHER_API_KEY`
- Ollama: `OLLAMA_BASE_URL`
