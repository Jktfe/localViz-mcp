# Setting Up Claude Desktop with LocalViz MCP

This guide will help you configure Claude Desktop to use the LocalViz MCP server for local image generation.

## Prerequisites

- Claude Desktop App installed
- [Fooocus](https://github.com/lllyasviel/Fooocus) (for image generation)
- [Fooocus-API](https://github.com/mrhan1993/Fooocus-API) (for API access)
- LocalViz MCP server built and ready to run

## Configuration Steps

1. Open the Claude Desktop configuration file:

```bash
# On macOS:
open -a "TextEdit" ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. If the file doesn't exist, create it with the following content:

```json
{
  "mcpServers": [
    {
      "name": "LocalViz",
      "path": "/Users/yourusername/CascadeProjects/localViz-mcp/dist/server.js"
    }
  ]
}
```

3. If the file already exists, add the LocalViz entry to the `mcpServers` array:

```json
{
  "mcpServers": [
    // ... existing entries
    {
      "name": "LocalViz",
      "path": "/Users/yourusername/CascadeProjects/localViz-mcp/dist/server.js"
    }
  ]
}
```

4. Save the file and restart Claude Desktop.

## Testing the Integration

1. Start the LocalViz MCP server:

```bash
cd /Users/yourusername/CascadeProjects/localViz-mcp
./start_mcp.sh
```

2. Open Claude Desktop and type a prompt like:

```
Use LocalViz to create 4 images of a sunset over mountains
```

3. Claude should recognize the command and generate the requested images using your local Fooocus installation.

## Troubleshooting

- If Claude doesn't recognize the LocalViz command, check the `claude_desktop_config.json` file for errors.
- Ensure the MCP server is running before asking Claude to generate images.
- Check the terminal running the MCP server for any error messages.
- The generated images will be saved to the output directory specified in your `.env` file.

## Shutting Down

To properly shut down:

1. Close Claude Desktop when finished
2. Press Ctrl+C in the terminal running the MCP server
3. If needed, run `./stop_api.sh` to ensure all Fooocus processes are terminated
