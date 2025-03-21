// CommonJS wrapper to load the MCP SDK
const { Server, StdioServerTransport } = require('@modelcontextprotocol/sdk');
const { spawn } = require('child_process');
const path = require('path');

// Make the SDK classes available globally
// We need to pass these values to the ESM module
// Using environment variables because we can't directly share global objects
process.env.MCP_SDK_AVAILABLE = 'true';

// Start the ESM module with the SDK preloaded
const child = spawn(
  'node',
  [
    '--experimental-vm-modules',
    '--input-type=module',
    '--eval',
    `
    import { dirname } from 'path';
    import { fileURLToPath } from 'url';
    
    // Make the Server class available globally
    globalThis.SERVER_CLASS = eval('(${Server.toString()})');
    globalThis.STDIO_TRANSPORT_CLASS = eval('(${StdioServerTransport.toString()})');
    
    // Now import our actual server
    import("${path.resolve(__dirname, 'dist/server.js')}");
    `
  ],
  { 
    stdio: 'inherit',
    shell: false
  }
);

child.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
