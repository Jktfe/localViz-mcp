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
- [Python](https://www.python.org/) (3.10 or later - required for Fooocus)
- [Fooocus](https://github.com/lllyasviel/Fooocus) (with API enabled)
- [Fooocus-API](https://github.com/mrhan1993/Fooocus-API)

### System Requirements

Fooocus requires significant computational resources for image generation:

- **GPU**: NVIDIA GPU with at least 4GB VRAM (8GB+ recommended)
- **CPU**: Modern multi-core processor (for non-GPU operations)
- **RAM**: Minimum 16GB, 32GB recommended
- **Disk Space**: 15GB+ for model files plus storage for generated images
- **Operating System**: Linux or macOS recommended (Windows support through shell compatibility layer)

### Setting Up Fooocus and Fooocus-API

1. Download and set up Fooocus:
   ```bash
   git clone https://github.com/lllyasviel/Fooocus.git
   cd Fooocus
   python -m venv venv
   
   # Activate the virtual environment
   # On Linux/macOS:
   source venv/bin/activate
   # On Windows:
   # venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   # Download the models (this may take some time)
   python download_models.py
   ```

2. Download and set up Fooocus-API:
   ```bash
   git clone https://github.com/mrhan1993/Fooocus-API.git
   cd Fooocus-API
   
   # Create a virtual environment using the same Python version
   python -m venv venv
   
   # Activate the virtual environment
   # On Linux/macOS:
   source venv/bin/activate
   # On Windows:
   # venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   ```

3. Make the shell scripts executable:
   ```bash
   chmod +x *.sh
   ```

## Installation

1. Clone this repository:

```bash
git clone https://github.com/jamesking/localviz-mcp.git
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
     - `style`: Style preset to use for generation (e.g., 'Fooocus_V2', 'Cinematic')
     - `num_images`: Number of images to generate
     - `seed`: Specific seed for reproducible generation (use -1 for random)
     - `aspect_ratio`: Aspect ratio for generated images (e.g., 'square', 'portrait', 'landscape', or specific dimensions like '1024*1024')

2. `list_styles`: List all available style presets for image generation

3. `list_aspect_ratios`: List all available aspect ratios for image generation
   
4. `test_api`: Test the connection to the Fooocus API

## V1 Server (New)

The LocalViz MCP now includes a V1 server implementation with enhanced features:

### V1 Features

- Improved error handling with detailed error messages
- Progress tracking for image generation
- Job queue management with concurrent job limits
- Better logging with configurable log levels
- Configurable output directory with optional subdirectory creation
- Simplified API integration
- Detailed documentation
- **Automatic Fooocus API management** - starts and stops the API as needed

### Using the V1 Server

To use the V1 server, update your MCP configuration to point to the server-v1.js script:

```json
{
  "localviz": {
    "command": "node",
    "args": [
      "/path/to/your/localviz-mcp/server-v1.js"
    ],
    "transport": "stdio"
  }
}
```

### Configuration

The V1 server supports the following configuration options via environment variables:

```
# API settings
FOOOCUS_API_URL=http://127.0.0.1:8888
API_TIMEOUT=10000
POLLING_INTERVAL=2000

# Output settings
OUTPUT_DIR=/path/to/your/output/directory
CREATE_SUBDIRS=true

# Processing settings
MAX_CONCURRENT_JOBS=3

# Logging
LOG_LEVEL=info
LOG_FILE=localviz.log

# API Management Settings
MANAGE_API=true            # Whether to automatically manage Fooocus API
API_SHUTDOWN_TIMEOUT=300000 # Shutdown API after 5 minutes of inactivity

# Fooocus API Paths
FOOOCUS_API_PATH=/path/to/your/Fooocus-API
FOOOCUS_PATH=/path/to/your/Fooocus
```

### API Management

The V1 server can automatically manage the Fooocus API lifecycle:

1. **Automatic startup**: The server will start the Fooocus API when needed for image generation
2. **Intelligent shutdown**: The API will be shut down after a configurable period of inactivity
3. **Graceful termination**: The server will ensure the API is properly shut down when the server exits

You can also manually control the API using the `manage_api` tool with the following actions:
- `start`: Start the Fooocus API
- `stop`: Stop the Fooocus API
- `status`: Check if the API is running

### Troubleshooting

If you encounter issues with the V1 server:

1. Check if the Fooocus API is running at the configured URL
2. Verify that the output directory exists and is writable
3. Check the log file for detailed error messages
4. Try with a simpler prompt or different parameters
5. Ensure the FOOOCUS_API_PATH and FOOOCUS_PATH are correctly configured in your .env file

## Examples

### Generating a Basic Image

```
Use LocalViz to create an image of a futuristic cityscape with flying cars in the style of cinematic_photography
```

### Generating Multiple Images with a Specific Style

```
Use LocalViz to generate 4 images of a peaceful garden with Japanese_styling using the "Watercolor" style
```

### Using Negative Prompts

```
Use LocalViz to create an image of a mountain landscape with snow-capped peaks, negative prompt: people, text, watermarks
```

### Specifying Aspect Ratio

```
Use LocalViz to create a portrait oriented image of a business professional in a modern office setting
```

### Using a Specific Seed for Reproducibility

```
Use LocalViz to create an image of a tropical beach at sunset with seed 42
```

### Combining Multiple Parameters

```
Use LocalViz to generate 2 square images of a fantasy dragon with colorful scales, style Oil_Painting, negative prompt: blurry, low quality
```

### Browsing Recently Generated Images

```
Use LocalViz to browse recently generated images
```

### Creating Variations of an Existing Image

```
Use LocalViz to browse recently generated images, then generate a variation of image 1 with the prompt "make it more vibrant and colorful"
```

### Image Browsing with Filters

```
Use LocalViz to browse the 5 oldest generated images
```

### Getting Server Status Information

```
Use LocalViz to show server status
```

## Usage Example
```yml
generate_image:
  prompt: "A cartoon_style image of Donald Duck rapping on top of a mountain, microphone in hand, snow-capped peaks in the background, dramatic lighting"
  style: "Fooocus_V2"
  aspect_ratio: "landscape"
```

## Troubleshooting

### Common Issues

- **Server won't start**: 
  - Check that the paths in your `.env` file are correct
  - Ensure Node.js is properly installed (v16+)
  - Verify typescript is installed globally or locally
  - Check that the build process completed successfully

- **Images not generating**: 
  - Ensure the Fooocus API server is running (`./start_fooocus_api.sh`)
  - Check that your GPU has enough VRAM available
  - Verify Python dependencies are correctly installed
  - Look at the Fooocus API console for specific errors
  - Try using the `manage_fooocus_server` tool with "start" parameter

- **Claude doesn't recognize commands**: 
  - Verify your Claude Desktop configuration
  - Check that the MCP server is running
  - Ensure the path to server.js is correct in claude_desktop_config.json
  - Restart Claude Desktop after configuration changes

- **Python environment issues**:
  - Ensure you have Python 3.10+ installed
  - Check that virtual environments are set up properly
  - Verify all dependencies are installed in the correct environment

- **Permission denied errors**:
  - Make sure shell scripts are executable: `chmod +x *.sh`
  - Check file permissions on output directory

### Debugging Tips

- Check the server logs in the `logs` directory (`logs/localviz-*.log`)
- For test runs, check `server.log` for information
- Monitor the Fooocus API process for errors
- Set environment variable `LOG_LEVEL=debug` in `.env` for more verbose logging
- View server statistics with the `server_status` tool
- For CUDA errors, check GPU compatibility and driver versions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
