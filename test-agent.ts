import { AgentController } from "./lib/agent/controller";
import { LLMModel, LLMModelConfig } from "./lib/model";
import { CustomFiles } from "./lib/types";
import * as fs from "fs/promises";
import * as path from "path";

async function testAgentSystem() {
  console.log("🧪 Testing AI Analyst Agent System...\n");

  // Test configuration
  const testModel: LLMModel = {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    providerId: "anthropic",
  };

  const testConfig: LLMModelConfig = {
    model: testModel.id,
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0.3,
  };

  // Load sample CSV
  const sampleCsvPath = path.join(process.cwd(), "sample_data", "helium_sample.csv");
  const csvContent = await fs.readFile(sampleCsvPath, "utf-8");
  
  const testFiles: CustomFiles[] = [{
    name: "helium_sample.csv",
    content: csvContent,
    contentType: "text/csv",
  }];

  // Test cases
  const testCases = [
    {
      name: "Helium Traffic Analysis",
      query: "Analyze the organic and paid traffic trends over time. Show me how traffic and keywords correlate.",
      expectedTool: "helium_analysis",
    },
    {
      name: "Custom Analysis Request",
      query: "Create a scatter plot showing the relationship between all metrics",
      expectedTool: "custom_analysis",
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📊 Test: ${testCase.name}`);
    console.log(`📝 Query: "${testCase.query}"`);
    
    const controller = new AgentController(
      `test-${Date.now()}`,
      testModel,
      testConfig
    );

    try {
      const result = await controller.processQuery(testCase.query, testFiles);
      
      console.log("\n🤖 Agent Thoughts:");
      result.thoughts.forEach((thought, index) => {
        console.log(`  ${index + 1}. [${thought.type}] ${thought.content}`);
        if (thought.confidence < 1) {
          console.log(`     Confidence: ${Math.round(thought.confidence * 100)}%`);
        }
      });

      console.log(`\n📊 Status: ${result.status}`);
      
      if (result.finalResult) {
        console.log(`✅ Tool Used: ${result.finalResult.toolName}`);
        console.log(`🎯 Success: ${result.finalResult.success}`);
        
        if (result.finalResult.error) {
          console.log(`❌ Error: ${result.finalResult.error}`);
        }
        
        if (result.finalResult.artifacts) {
          console.log(`📁 Artifacts Generated: ${result.finalResult.artifacts.length}`);
          result.finalResult.artifacts.forEach(artifact => {
            console.log(`   - ${artifact.name} (${artifact.type})`);
          });
        }
      }
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
    }
  }

  console.log("\n✅ Agent system test completed!");
}

// Run the test
testAgentSystem().catch(console.error); 