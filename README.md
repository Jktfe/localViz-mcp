# LocalViz MCP - Local Image Generation for Claude

This is a Model Context Protocol (MCP) server that enables local image generation using Fooocus. It allows Claude Desktop, Windsurf IDE, and Claude Code to generate images based on natural language prompts.

## Features

- Text-to-image generation using locally installed Fooocus
- Multiple style selection options
- Negative prompt support
- Automatic Fooocus API server management
- Customizable output directory for generated images

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [TypeScript](https://www.typescriptlang.org/)
- [Fooocus](https://github.com/lllyasviel/Fooocus) (with API enabled)
- [Fooocus-API](https://github.com/mrhan1993/Fooocus-API)

### Setting Up Fooocus and Fooocus-API

1. Download and set up Fooocus:
   ```bash
   git clone https://github.com/lllyasviel/Fooocus.git
   cd Fooocus
   # Follow the installation instructions in the Fooocus README
   ```

2. Download and set up Fooocus-API:
   ```bash
   git clone https://github.com/mrhan1993/Fooocus-API.git
   cd Fooocus-API
   # Place this directory alongside your Fooocus installation
   ```

## Installation

1. Clone this repository:

```bash
git clone https://github.com/yourusername/localviz-mcp.git
cd localviz-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables by copying the example file:

```bash
cp example.env .env
```

4. Edit the `.env` file with your specific configuration:

```
# Fooocus API Configuration
FOOOCUS_API_URL=http://127.0.0.1:8888

# Fooocus API Paths
FOOOCUS_API_PATH=/path/to/your/Fooocus-API
FOOOCUS_PATH=/path/to/your/Fooocus

# Output Path for Generated Images
OUTPUT_DIR=/path/to/your/output/directory
```

5. Build the project:

```bash
npm run build
```

## Usage

### Starting the MCP Server

```bash
./start_mcp.sh
```

This will build the project and start the MCP server.

### Stopping the MCP Server

Press `Ctrl+C` in the terminal where the server is running.

To ensure all Fooocus processes are stopped:

```bash
./stop_api.sh
```

### Testing the MCP Server

```bash
./test_mcp.sh
```

## Integrating with Claude Desktop

See [CLAUDE_SETUP.md](CLAUDE_SETUP.md) for detailed instructions on integrating this MCP server with Claude Desktop.

## Integrating with Windsurf and Claude

### Claude Desktop Configuration

Add the following to your `claude_desktop_config.json` file (typically located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": [
    {
      "name": "LocalViz",
      "path": "/path/to/your/localviz-mcp/dist/server.js"
    }
  ]
}
```

### Windsurf Configuration

Add the following to your Windsurf settings:

```json
{
  "mcps": [
    {
      "name": "LocalViz",
      "path": "/path/to/your/localviz-mcp/dist/server.js"
    }
  ]
}
```

### Claude Code Configuration

For Claude Code (VSCode extension), add the following to your VSCode settings:

```json
{
  "claude.mcpServers": [
    {
      "name": "LocalViz",
      "path": "/path/to/your/localviz-mcp/dist/server.js"
    }
  ]
}
```

## Available Tools

The MCP server provides the following tools:

1. `generate_image`: Generate images from text prompts
   - Parameters:
     - `prompt`: Text description of the desired image
     - `negative_prompt`: What to avoid in the image
     - `style_selections`: Array of style presets
     - `image_number`: Number of images to generate

2. `list_styles`: List all available style presets

3. `start_api_server`: Start the Fooocus API server
   - Parameters: None

4. `stop_api_server`: Stop the Fooocus API server
   - Parameters: None

## Examples

### Generating an Image

```
Use LocalViz to create an image of a futuristic cityscape with flying cars in the style of cinematic photography
```

### Generating Multiple Images with a Specific Style

```
Use LocalViz to generate 4 images of a peaceful garden with Japanese styling using the "Watercolor" style preset
```

### Using Negative Prompts

```
Use LocalViz to create an image of a mountain landscape with snow-capped peaks, no people, no text
```

## Troubleshooting

- **Server won't start**: Check that the paths in your `.env` file are correct
- **Images not generating**: Ensure the Fooocus API server is running
- **Claude doesn't recognize commands**: Verify your Claude Desktop configuration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
