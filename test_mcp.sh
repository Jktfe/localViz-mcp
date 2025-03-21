#!/bin/bash

# Test script for the LocalViz MCP server
# This will create a test JSON payload and send it to the server

echo "Building and starting LocalViz MCP server..."
npm run build

# Start the server in the background
node dist/server.js > server.log 2>&1 &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"
echo "Waiting 3 seconds for server to initialize..."
sleep 3

echo "Creating test JSON payload..."
cat > test_payload.json << EOF
{
  "type": "tool_call",
  "tool_call": {
    "name": "generate_image",
    "parameters": {
      "prompt": "A beautiful sunset over mountains, high quality, detailed",
      "negative_prompt": "bad quality, low resolution",
      "style_selections": ["Fooocus V2"],
      "image_number": 1
    }
  }
}
EOF

echo "Sending test request to server..."
echo "Check server.log for response and any errors"
cat test_payload.json | node -e "
const payload = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
process.stdout.write(JSON.stringify(payload) + '\n');
process.on('SIGINT', () => {
  process.exit(0);
});
" | node dist/server.js

echo "Test complete. Press Ctrl+C to exit."
echo "Killing server process..."
kill $SERVER_PID

echo "Done"
