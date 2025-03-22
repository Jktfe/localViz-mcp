#!/bin/bash

# Test script for the LocalViz MCP server
# This will create a test JSON payload and send it to the server

set -e  # Exit on error

echo "Building the LocalViz MCP server..."
npm run build || { echo "Build failed. Check for errors and try again."; exit 1; }

# Check if server is already running on the same port
if pgrep -f "node server-v1.cjs" > /dev/null; then
  echo "Warning: MCP server is already running. This test will start another instance."
  echo "You may want to stop the existing instance first."
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Test cancelled."
    exit 1
  fi
fi

# Create log file
echo "Starting MCP server in test mode..." > server.log

# Start the server in the background using the correct wrapper
node server-v1.cjs >> server.log 2>&1 &
SERVER_PID=$!

if [ -z "$SERVER_PID" ]; then
  echo "Failed to start server. Check server.log for details."
  exit 1
fi

echo "Server started with PID: $SERVER_PID"
echo "Waiting 3 seconds for server to initialize..."
sleep 3

# Check if server process is still running
if ! ps -p $SERVER_PID > /dev/null; then
  echo "Server process has terminated unexpectedly. Check server.log for details."
  cat server.log
  exit 1
fi

echo "Creating test JSON payload..."
cat > test_payload.json << EOF
{
  "type": "tool_call",
  "tool_call": {
    "name": "generate_image",
    "parameters": {
      "prompt": "A beautiful sunset over mountains, high quality, detailed",
      "negative_prompt": "bad quality, low resolution",
      "style": "Fooocus V2",
      "num_images": 1,
      "aspect_ratio": "landscape",
      "seed": -1
    }
  }
}
EOF

echo "Sending test request to server..."
echo "Check server.log for responses and any errors"

# Define a timeout for the test
TIMEOUT=60
echo "Setting test timeout to $TIMEOUT seconds"

# Send the request in a subshell with timeout
(
  # Use timeout command if available
  if command -v timeout &> /dev/null; then
    timeout $TIMEOUT bash -c "cat test_payload.json | node -e \"
    const payload = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    process.stdout.write(JSON.stringify(payload) + '\n');
    process.on('SIGINT', () => {
      process.exit(0);
    });
    \" | node server-v1.cjs"
    TEST_EXIT_CODE=$?
  else
    # Fallback if timeout command is not available
    cat test_payload.json | node -e "
    const payload = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    process.stdout.write(JSON.stringify(payload) + '\n');
    process.on('SIGINT', () => {
      process.exit(0);
    });
    " | node server-v1.cjs
    TEST_EXIT_CODE=$?
  fi

  if [ $TEST_EXIT_CODE -eq 124 ]; then
    echo "Test timed out after $TIMEOUT seconds."
    exit 1
  elif [ $TEST_EXIT_CODE -ne 0 ]; then
    echo "Test failed with exit code $TEST_EXIT_CODE."
    exit $TEST_EXIT_CODE
  fi
) || {
  echo "Test failed. Check server.log for details."
  echo "Last 10 lines of server.log:"
  tail -n 10 server.log
}

echo "Test complete."
echo "Killing server process..."
kill $SERVER_PID 2>/dev/null || echo "Server already terminated."

# Check for any error patterns in the log
if grep -i "error\|exception\|failed" server.log > /dev/null; then
  echo "Possible errors detected in server.log. You should review the log file."
else
  echo "No obvious errors detected in the logs."
fi

echo "Done. Check server.log for complete output."
