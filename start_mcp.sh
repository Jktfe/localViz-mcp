#!/bin/bash

echo "Building LocalViz MCP server..."
npm run build

echo "Starting LocalViz MCP server..."
node dist/server.js
