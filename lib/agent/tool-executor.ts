import { Sandbox } from "@e2b/code-interpreter";
import { readFileSync } from "fs";
import { join } from "path";
import { ToolExecutionResult } from "./schemas";
import { CustomFiles } from "../types";

const ANALYSIS_SCRIPTS = {
  helium_analysis: (filename: string) => `
import sys
import os
import pandas as pd
import matplotlib.pyplot as plt
import json
import glob
from datetime import datetime
import base64
from io import BytesIO
import warnings
warnings.filterwarnings('ignore')

# Ensure output directory exists
os.makedirs('/tmp/output', exist_ok=True)

try:
    # Find the data file
    csv_files = glob.glob('/tmp/*.csv')
    if not csv_files:
        result = {
            "success": False,
            "error": "No CSV files found",
            "artifacts": []
        }
        print(json.dumps(result))
        sys.exit(0)
    
    data_file = csv_files[0]  # Use the first CSV file found
    
    # Load the helium analysis script
    exec(open('/tmp/helium_analysis.py').read())
    
except Exception as e:
    result = {
        "success": False,
        "error": f"Script execution failed: {str(e)}",
        "artifacts": []
    }
    print(json.dumps(result))
`,
  
  keyword_analysis: (filename: string) => `
import sys
import os
import pandas as pd
import matplotlib.pyplot as plt
import json
import glob
from datetime import datetime
import base64
from io import BytesIO
import warnings
warnings.filterwarnings('ignore')

# Ensure output directory exists
os.makedirs('/tmp/output', exist_ok=True)

try:
    # Find the data file
    csv_files = glob.glob('/tmp/*.csv')
    if not csv_files:
        result = {
            "success": False,
            "error": "No CSV files found",
            "artifacts": []
        }
        print(json.dumps(result))
        sys.exit(0)
    
    data_file = csv_files[0]  # Use the first CSV file found
    
    # Load the keyword analysis script
    exec(open('/tmp/keyword_analysis.py').read())
    
except Exception as e:
    result = {
        "success": False,
        "error": f"Script execution failed: {str(e)}",
        "artifacts": []
    }
    print(json.dumps(result))
`,
  
  channel_analysis: (filename: string) => `
import sys
import os
import pandas as pd
import matplotlib.pyplot as plt
import json
import glob
from datetime import datetime
import base64
from io import BytesIO
import warnings
warnings.filterwarnings('ignore')

# Ensure output directory exists
os.makedirs('/tmp/output', exist_ok=True)

try:
    # Find the data file
    csv_files = glob.glob('/tmp/*.csv')
    if not csv_files:
        result = {
            "success": False,
            "error": "No CSV files found",
            "artifacts": []
        }
        print(json.dumps(result))
        sys.exit(0)
    
    data_file = csv_files[0]  # Use the first CSV file found
    
    # Load the channel analysis script
    exec(open('/tmp/channel_analysis.py').read())
    
except Exception as e:
    result = {
        "success": False,
        "error": f"Script execution failed: {str(e)}",
        "artifacts": []
    }
    print(json.dumps(result))
`,

  custom_analysis: (filename: string) => `
import pandas as pd
import matplotlib.pyplot as plt
import json
import base64
from io import BytesIO
import glob
import os

# Find the CSV file
csv_files = glob.glob('/tmp/*.csv')
if not csv_files:
    result = {
        "success": False,
        "error": "No CSV files found",
        "artifacts": []
    }
    print(json.dumps(result))
    exit()

data_file = csv_files[0]
print(f"Using data file: {data_file}")

# Load and analyze the CSV file
df = pd.read_csv(data_file)

# Basic analysis
summary = {
    "rows": int(df.shape[0]),
    "columns": int(df.shape[1]),
    "column_names": df.columns.tolist(),
    "dtypes": {col: str(dtype) for col, dtype in df.dtypes.to_dict().items()},
    "missing_values": {col: int(val) for col, val in df.isnull().sum().to_dict().items()},
    "numeric_summary": df.describe().to_dict() if len(df.select_dtypes(include='number').columns) > 0 else {}
}

# Create a simple chart
plt.figure(figsize=(10, 6))
if len(df.columns) >= 2:
    if df.dtypes.iloc[0] in ['int64', 'float64'] and df.dtypes.iloc[1] in ['int64', 'float64']:
        plt.scatter(df.iloc[:, 0], df.iloc[:, 1])
        plt.xlabel(df.columns[0])
        plt.ylabel(df.columns[1])
        plt.title(f"{df.columns[0]} vs {df.columns[1]}")
    else:
        df.hist(bins=20, figsize=(15, 10))
        plt.suptitle("Data Distribution")
else:
    df.plot(kind='bar')
    plt.title("Data Overview")

plt.tight_layout()

# Save chart as base64
buffer = BytesIO()
plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
buffer.seek(0)
chart_base64 = base64.b64encode(buffer.getvalue()).decode()
plt.close()

# Return results
result = {
    "success": True,
    "summary": summary,
    "artifacts": [
        {
            "name": "analysis_chart.png",
            "type": "chart",
            "content": chart_base64
        }
    ]
}

print(json.dumps(result))
`
};

function getAnalysisScript(scriptName: keyof typeof ANALYSIS_SCRIPTS): string {
  const scriptPath = join(process.cwd(), "lib", "analysis", `${scriptName}.py`);
  try {
    return readFileSync(scriptPath, "utf-8");
  } catch (error) {
    console.warn(`Could not read ${scriptName}.py, using fallback`);
    return "";
  }
}

export async function executeToolInSandbox(
  toolName: string,
  files: CustomFiles[]
): Promise<ToolExecutionResult> {
  let sandbox: Sandbox | null = null;
  
  try {
    console.log(`Uploading ${files.length} files to sandbox`);
    
    // Create E2B sandbox
    sandbox = await Sandbox.create({
      metadata: { toolName },
    });

    // Upload files to sandbox
    for (const file of files) {
      console.log(`Uploading file: ${file.name}`);
      // CustomFiles.content is a base64 string, need to convert to ArrayBuffer
      const buffer = Buffer.from(file.content, 'base64');
      await sandbox.files.write(`/tmp/${file.name}`, buffer.buffer);
    }

    // Get the appropriate analysis script
    const scriptTemplate = ANALYSIS_SCRIPTS[toolName as keyof typeof ANALYSIS_SCRIPTS];
    if (!scriptTemplate) {
      return {
        toolName,
        success: false,
        error: `Unknown tool: ${toolName}`,
        artifacts: []
      };
    }

    // Upload the analysis script to sandbox
    const scriptContent = getAnalysisScript(toolName as keyof typeof ANALYSIS_SCRIPTS);
    if (scriptContent) {
      await sandbox.files.write(`/tmp/${toolName}.py`, scriptContent);
    }

    // Execute the script
    const executionCode = scriptTemplate(files[0]?.name || "data.csv");
    console.log("Executing analysis script...");
    
    const execution = await sandbox.runCode(executionCode);
    console.log("Execution completed");

    // Parse the JSON result from Python output
    let analysisResult: any = {};
    try {
      // The JSON output is in logs.stdout, which is an array of strings
      const stdout = execution.logs?.stdout;
      if (stdout && Array.isArray(stdout)) {
        console.log("Parsing stdout:", stdout);
        console.log("Stdout length:", stdout.length);
        
        // The stdout array contains the JSON as a single element
        // Let's check each element
        for (let i = 0; i < stdout.length; i++) {
          console.log(`Stdout[${i}]:`, stdout[i]);
          const line = stdout[i].trim();
          if (line && line.startsWith('{') && line.includes('"success"')) {
            console.log("Found JSON at index", i, ":", line);
            try {
              analysisResult = JSON.parse(line);
              console.log("Successfully parsed JSON:", analysisResult);
              break;
            } catch (parseErr) {
              console.error("Failed to parse line:", parseErr);
            }
          }
        }
      } else {
        console.log("No stdout found in logs or stdout is not an array");
        console.log("Type of stdout:", typeof stdout);
        console.log("Stdout value:", stdout);
      }
    } catch (error) {
      console.error("Failed to parse analysis result:", error);
      console.log("Raw stdout:", execution.logs?.stdout);
    }

    console.log("Analysis result:", analysisResult);

    // Prepare the final result
    const result: ToolExecutionResult = {
      toolName,
      success: analysisResult.success || false,
      output: analysisResult,
      artifacts: []
    };
    
    // Ensure artifacts array exists
    if (!result.artifacts) {
      result.artifacts = [];
    }

    // Handle artifacts from the analysis result
    if (analysisResult.artifacts && Array.isArray(analysisResult.artifacts)) {
      console.log("Processing artifacts from analysis result:", analysisResult.artifacts);
      
      for (const artifact of analysisResult.artifacts) {
        if (artifact.path) {
          // Read the artifact from the sandbox
          try {
            console.log(`Reading artifact from path: ${artifact.path}`);
            const content = await sandbox.files.read(artifact.path);
            result.artifacts.push({
              name: artifact.name,
              type: artifact.type as "chart" | "csv" | "json" | "text",
              content: Buffer.isBuffer(content) ? content.toString('base64') : content
            });
            console.log(`Successfully read artifact: ${artifact.name}`);
          } catch (err) {
            console.error(`Failed to read artifact ${artifact.path}:`, err);
          }
        } else if (artifact.content) {
          // Artifact already has content (base64 encoded)
          result.artifacts.push({
            name: artifact.name,
            type: artifact.type as "chart" | "csv" | "json" | "text",
            content: artifact.content
          });
          console.log(`Added artifact with embedded content: ${artifact.name}`);
        }
      }
    }

    if (analysisResult.error) {
      result.error = analysisResult.error;
    }

    return result;

  } catch (error) {
    console.error("Tool execution error:", error);
    return {
      toolName,
      success: false,
      error: String(error),
      artifacts: []
    };
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch (error) {
        console.warn("Failed to cleanup sandbox:", error);
      }
    }
  }
} 