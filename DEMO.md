# AI Analyst - Demo Guide

## Quick Start Demo

### 1. Upload a CSV File

The system comes with sample CSV files for testing:

- **Helium Sample**: Traffic metrics over time (organic/paid traffic, keywords, costs)
- **Keyword Sample**: Search terms with intent and traffic data
- **Channel Sample**: Marketing channel performance data

### 2. Example Queries

Try these queries to see the agent in action:

#### For Traffic Analysis (Helium Script):
- "Analyze the organic and paid traffic trends over time"
- "Show me how traffic correlates with keywords"
- "Compare organic vs paid traffic costs"

#### For Keyword Analysis:
- "Analyze keyword performance by intent"
- "Show me branded vs non-branded traffic split"
- "Which search intents drive the most traffic?"

#### For Channel Analysis:
- "Analyze traffic by marketing channels"
- "Which channels perform best?"
- "Show channel mix breakdown"

#### For Custom Analysis:
- "Create a correlation matrix of all metrics"
- "Show me year-over-year growth trends"
- "Build a custom dashboard with multiple charts"

### 3. Watch the Agent Think

As the agent processes your request, you'll see:

1. **Reasoning**: The agent analyzing your query
2. **Tool Selection**: Choosing the best analysis script
3. **Execution**: Running the analysis in the sandbox
4. **Error Recovery**: If something fails, watch it retry with a different approach

### 4. Understanding Results

The agent returns:
- **Charts**: Professional Matplotlib visualizations
- **Summary Statistics**: Key metrics and insights
- **Processed Data**: Cleaned CSV files for download
- **Thought Process**: Complete reasoning trail

## Advanced Features

### Multi-Turn Analysis

The agent maintains context, so you can:
1. Start with a broad analysis
2. Ask follow-up questions
3. Drill down into specific insights

### Error Recovery

If the initial approach fails, the agent will:
1. Analyze the error
2. Decide on a retry strategy
3. Try alternative tools or custom code
4. Provide clear error messages if all attempts fail

### Custom Configurations

For advanced users, you can provide configuration:
- Date ranges for analysis
- Brand keywords for classification
- Custom intent categories
- Specific chart preferences

## Tips for Best Results

1. **Be Specific**: "Analyze traffic trends" → "Show monthly organic traffic growth with trend lines"
2. **Mention Tools**: If you want a specific analysis, mention keywords like "traffic", "keywords", or "channels"
3. **Ask for Comparisons**: The agent excels at comparative analysis
4. **Request Multiple Views**: Ask for "multiple charts" or "comprehensive analysis"

## Sample Data Formats

### Helium Format (Traffic Metrics):
```csv
Target,Target Type,Metric,Database,Summary,2024-01-01,2024-02-01,...
example.com,root domain,Organic Traffic,us,24827,1200,1350,...
```

### Keyword Format:
```csv
Keyword,Traffic,Search Volume,Timestamp,Keyword Intents
"best shoes",150,5000,2024-01-01,"commercial,transactional"
```

### Channel Format:
```csv
Target,Direct,Referral,Organic Search,Paid Search,Organic Social,Paid Social,Email,Display Ads
example.com,1000,500,2000,300,150,100,250,50
``` 