import { Tool, ToolExecutionResult } from "./schemas";
import { CustomFiles } from "../types";
import { Sandbox } from "@e2b/code-interpreter";

function getAnalysisScriptTemplate(scriptName: string): string {
  return `
# Import the ${scriptName} analysis module
import sys
import json
import os
sys.path.append('/tmp')

# Create output directory
os.makedirs('/tmp/output', exist_ok=True)

# The analysis script will be written dynamically
from ${scriptName} import run_analysis

# Run the analysis
result = run_analysis('/tmp/data.csv', '/tmp/output', config)
print(json.dumps(result))
`;
}

const ANALYSIS_SCRIPTS = {
  helium_analysis: getAnalysisScriptTemplate('helium'),
  keyword_analysis: getAnalysisScriptTemplate('keywords'),
  channel_analysis: getAnalysisScriptTemplate('channels'),
};

async function getAnalysisScript(scriptName: string): Promise<string> {
  // Read the actual analysis script
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const scriptPath = path.join(process.cwd(), 'lib', 'analysis', `${scriptName}.py`);
  
  try {
    const content = await fs.readFile(scriptPath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Failed to load analysis script ${scriptName}:`, error);
    throw new Error(`Analysis script ${scriptName} not found`);
  }
}

export async function executeToolInSandbox(
  tool: Tool,
  query: string,
  files: CustomFiles[],
  config?: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const sandboxTimeout = 10 * 60 * 1000; // 10 minutes
  let sandbox: Sandbox | null = null;

  try {
    // Create sandbox
    sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: sandboxTimeout,
    });

    // Install required packages
    const installCode = `
import subprocess
import sys

packages = ['pandas', 'numpy', 'matplotlib', 'seaborn']
for package in packages:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])

# Download Poppins font for charts
import urllib.request
font_url = 'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Regular.ttf'
urllib.request.urlretrieve(font_url, '/tmp/Poppins-Regular.ttf')
print("Dependencies installed successfully")
`;

    await sandbox.runCode(installCode);

    // Upload files
    console.log(`Uploading ${files.length} files to sandbox`);
    for (const file of files) {
      console.log(`Uploading file: ${file.name}`);
      await sandbox.files.write(`/tmp/${file.name}`, file.content);
    }

    // Prepare config
    const configCode = `
import json
config = ${JSON.stringify(config || {})}
`;

    await sandbox.runCode(configCode);

    // Execute the appropriate tool
    let executionCode: string;

    if (tool.name === "custom_analysis") {
      // Generate custom code using LLM
      executionCode = await generateCustomAnalysisCode(query, files);
    } else {
      // Load and prepare the analysis script
      const scriptMap: Record<string, string> = {
        helium_analysis: 'helium',
        keyword_analysis: 'keywords',
        channel_analysis: 'channels'
      };
      
      const scriptName = scriptMap[tool.name];
      if (!scriptName) {
        throw new Error(`Unknown tool: ${tool.name}`);
      }
      
      const scriptContent = await getAnalysisScript(scriptName);
      
      // Create the execution code that writes the script and runs it
      executionCode = `
import sys
import json
import os

# Debug: List uploaded files
print("Uploaded files:", os.listdir('/tmp'))

# Create output directory
os.makedirs('/tmp/output', exist_ok=True)

# Write the analysis script
script_content = '''${scriptContent.replace(/'/g, "\\'")}'''
with open('/tmp/${scriptName}.py', 'w') as f:
    f.write(script_content)

# Add to path and import
sys.path.append('/tmp')

try:
    module = __import__('${scriptName}')
    
    # Find the CSV file - try multiple possible names
    possible_files = [
        '/tmp/${files[0]?.name || 'data.csv'}',
        '/tmp/data.csv'
    ]
    
    # Also check for any CSV files in /tmp
    import glob
    csv_files = glob.glob('/tmp/*.csv')
    possible_files.extend(csv_files)
    
    data_file = None
    for file_path in possible_files:
        if os.path.exists(file_path):
            data_file = file_path
            break
    
    print(f"Using data file: {data_file}")
    
    if not data_file:
        print("Error: No CSV data file found")
        print("Available files:", os.listdir('/tmp'))
        result = {"success": False, "errors": ["No CSV data file found"], "artifacts": []}
    else:
        # Run the analysis
        print("Running analysis...")
        result = module.run_analysis(data_file, '/tmp/output', config)
        print("Analysis completed")
        print("Result:", result)
        
except Exception as e:
    print(f"Error during execution: {str(e)}")
    import traceback
    traceback.print_exc()
    result = {"success": False, "errors": [f"Execution error: {str(e)}"], "artifacts": []}

print(json.dumps(result))
`;
    }

    const execution = await sandbox.runCode(executionCode);
    
    console.log("Execution result:", execution);
    console.log("Execution text:", execution.text);
    console.log("Execution results:", execution.results);
    console.log("Execution logs:", execution.logs);
    console.log("Execution error:", execution.error);

    if (execution.error) {
      console.error("Sandbox execution error:", execution.error);
      return {
        toolName: tool.name,
        success: false,
        error: `Sandbox error: ${execution.error.name}: ${execution.error.value}`,
      };
    }

    // Parse results and collect artifacts
    let analysisResult;
    
    // Try to get the output from the last print statement
    const output = execution.text || "";
    
    try {
      analysisResult = JSON.parse(output || "{}");
    } catch (parseError) {
      console.error("Failed to parse analysis result:", parseError);
      console.log("Raw text output:", output);
      
      // Check logs for any output
      if (execution.logs && execution.logs.stdout) {
        console.log("Stdout logs:", execution.logs.stdout);
      }
      if (execution.logs && execution.logs.stderr) {
        console.log("Stderr logs:", execution.logs.stderr);
      }
      
      analysisResult = { 
        success: false, 
        errors: [`Failed to parse analysis result: ${parseError}`],
        output: output,
        artifacts: []
      };
    }

    // Download artifacts
    const artifacts = [];
    console.log("Analysis result:", analysisResult);
    
    if (analysisResult.artifacts) {
      console.log(`Found ${analysisResult.artifacts.length} artifacts to download`);
      for (const artifact of analysisResult.artifacts) {
        try {
          console.log(`Reading artifact: ${artifact.name} from ${artifact.path}`);
          const content = await sandbox.files.read(artifact.path);
          artifacts.push({
            name: artifact.name,
            type: artifact.type,
            content: typeof content === 'string' ? content : Buffer.from(content).toString('base64'),
          });
          console.log(`Successfully read artifact: ${artifact.name}`);
        } catch (e) {
          console.error(`Failed to read artifact ${artifact.name}:`, e);
        }
      }
    } else {
      console.log("No artifacts found in analysis result");
    }

    return {
      toolName: tool.name,
      success: true,
      output: analysisResult,
      artifacts,
    };

  } catch (error) {
    return {
      toolName: tool.name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Clean up sandbox
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch (e) {
        console.error("Failed to kill sandbox:", e);
      }
    }
  }
}

async function generateCustomAnalysisCode(query: string, files: CustomFiles[]): Promise<string> {
  // This would use the LLM to generate custom analysis code
  // For now, returning a template
  return `
import pandas as pd
import matplotlib.pyplot as plt
import json
import os

# Create output directory
os.makedirs('/tmp/output', exist_ok=True)

# Load data
df = pd.read_csv('/tmp/${files[0]?.name || 'data.csv'}')

# Perform custom analysis based on query: "${query}"
# This is where LLM-generated code would go

# Create a simple visualization
plt.figure(figsize=(10, 6))
if len(df.columns) > 0:
    plt.plot(df.index, df.iloc[:, 0])
plt.title('Custom Analysis Result')
plt.savefig('/tmp/output/custom_chart.png')
plt.close()

# Return results
result = {
    "success": True,
    "summary": {
        "rows": len(df),
        "columns": len(df.columns),
        "query": "${query}"
    },
    "artifacts": [{
        "name": "custom_chart.png",
        "type": "chart",
        "path": "/tmp/output/custom_chart.png"
    }]
}

print(json.dumps(result))
`;
} 