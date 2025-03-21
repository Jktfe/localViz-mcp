#!/bin/bash

# LocalViz MCP V1 Server Startup Script

# Banner 
echo "┌───────────────────────────────────────────────┐"
echo "│                                               │"
echo "│  🎨 LocalViz MCP Server V1                    │"
echo "│  Local Image Generation with Fooocus          │"
echo "│                                               │"
echo "└───────────────────────────────────────────────┘"

# Load environment variables
if [ -f .env ]; then
  echo "Loading environment variables from .env file"
  # Use set -a to export all variables, then source the file directly instead of using xargs
  set -a
  source ./.env
  set +a
else
  echo "No .env file found, using default settings"
fi

echo "Starting LocalViz MCP V1 server..."
echo "The server will automatically manage the Fooocus API as needed."
echo "You can use the manage_api tool to manually control the API if required."

# Start the V1 server
node ./server-v1.js
