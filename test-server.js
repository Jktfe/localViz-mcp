#!/usr/bin/env node

// Minimal MCP server for testing LocalViz
const { McpServer } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js');
const { StdioServerTransport } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js');
const fs = require('fs');
const path = require('path');

console.log("Starting test LocalViz MCP server...");

// Configuration - using hardcoded values for testing
const CONFIG = {
  FOOOCUS_API_URL: 'http://127.0.0.1:8888',
  OUTPUT_DIR: '/Users/jamesking/New Model Dropbox/James King/Air - JK Work/imageGens'
};

async function startServer() {
  try {
    // Create server
    const server = new McpServer({
      name: "test-localviz",
      version: "1.0.0"
    });
    
    // Simple test tool
    server.tool("test_tool", "A simple test tool", async (params) => {
      console.log("Test tool called with params:", params);
      return {
        content: [
          {
            type: "text",
            text: "Test tool called successfully!"
          }
        ]
      };
    });
    
    // List styles tool
    server.tool("list_styles", "List all available style presets for image generation", async (params) => {
      console.log("List styles tool called");
      
      // Hardcoded styles for testing
      const styles = [
        "Fooocus_V2",
        "Anime",
        "Cinematic",
        "Photographic"
      ];
      
      return {
        content: [
          {
            type: "text",
            text: `Available styles:\n${styles.join('\n')}`
          }
        ]
      };
    });
    
    // Generate image tool
    server.tool("generate_image", "Generate an image based on a text description", async (params) => {
      console.log("Generate image tool called with params:", params);
      
      // This is just a mock response for testing
      return {
        content: [
          {
            type: "text",
            text: `🎨 Image generation started!\n\nCreating image with prompt: "${params.prompt}"\nStyle: ${params.style || 'Default'}\n\nThis would normally take 30-60 seconds. Images would be saved to: ${CONFIG.OUTPUT_DIR}`
          }
        ],
        metadata: {
          job_id: "test-job-123",
          prompt: params.prompt,
          style: params.style || "Default",
          created: new Date().toISOString()
        }
      };
    });
    
    // Start MCP server with stdio transport
    const transport = new StdioServerTransport();
    console.log("Transport initialized, connecting to server...");
    
    try {
      await server.connect(transport);
      console.log("Server connected successfully");
    } catch (error) {
      console.error(`Error connecting server: ${error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Failed to start test MCP server: ${error}`);
    process.exit(1);
  }
}

// Start server
startServer();
