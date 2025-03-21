#!/usr/bin/env node

// Minimal MCP server for testing
const { McpServer } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js');
const { StdioServerTransport } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js');

console.log("Starting minimal MCP server...");

async function startServer() {
  try {
    // Create server
    const server = new McpServer({
      name: "minimal-localviz",
      version: "1.0.0"
    });
    
    // Register a single simple tool using string format
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
    console.error(`Failed to start minimal MCP server: ${error}`);
    process.exit(1);
  }
}

// Start server
startServer();
