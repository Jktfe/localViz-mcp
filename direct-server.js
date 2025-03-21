// Direct import from the SDK's CJS directory
const { McpServer } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js');
const { StdioServerTransport } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js');
console.log("McpServer class methods:", Object.getOwnPropertyNames(McpServer.prototype));
console.log("StdioServerTransport class methods:", Object.getOwnPropertyNames(StdioServerTransport.prototype));

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Set default paths if not specified in environment variables
const FOOOCUS_API_URL = process.env.FOOOCUS_API_URL || 'http://127.0.0.1:8888';
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve(process.cwd(), '../New Model Dropbox/James King/Air - JK Work/imageGens');

// Ensure output directory exists
function ensureOutputDirExists() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  return OUTPUT_DIR;
}

// Utility for saving image metadata
function saveImageMetadata(filename, metadata) {
  const metadataPath = path.join(OUTPUT_DIR, `${filename}.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

// Fooocus service implementation
const fooocusService = {
  async isApiUp() {
    try {
      const response = await axios.get(`${FOOOCUS_API_URL}/v1/status`, { timeout: 2000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  },

  async generateImage(params) {
    try {
      const response = await axios.post(`${FOOOCUS_API_URL}/v1/generation/text-to-image`, params);
      return response.data;
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  },

  async checkJobStatus(jobId) {
    try {
      const response = await axios.get(`${FOOOCUS_API_URL}/v1/generation/job/${jobId}`);
      return response.data;
    } catch (error) {
      console.error("Error checking job status:", error);
      throw error;
    }
  }
};

// Start server
async function startServer() {
  try {
    // Ensure output directory exists
    ensureOutputDirExists();
    
    // Create an MCP server
    const server = new McpServer({
      name: "localviz",
      description: "Generate images locally using Fooocus",
      version: "1.0.0",
      transport: new StdioServerTransport()
    });

    // Register tool for generating images
    server.tool({
      name: "generate_image",
      description: "Generate an image based on a text description using Fooocus. Results will be saved locally.",
      parameters: [
        {
          name: "prompt",
          description: "The text description of the image to generate",
          type: "string",
          required: true
        },
        {
          name: "negative_prompt",
          description: "Elements to avoid in the generated image",
          type: "string",
          required: false
        },
        {
          name: "style",
          description: "Style preset to use for generation (e.g., 'Fooocus V2', 'Cinematic', 'Anime', 'Fantasy', 'Realistic')",
          type: "string",
          required: false
        },
        {
          name: "num_images",
          description: "Number of images to generate (default: 1)",
          type: "number",
          required: false
        },
        {
          name: "seed",
          description: "Specific seed for reproducible generation (use -1 for random)",
          type: "number",
          required: false
        },
        {
          name: "aspect_ratio",
          description: "Aspect ratio for generated images (e.g., 'square', 'portrait', 'landscape', or specific dimensions like '1024*1024')",
          type: "string",
          required: false
        }
      ],
      execute: async ({ prompt, negative_prompt, style, num_images, seed, aspect_ratio }) => {
        try {
          // Default values
          const styleSelections = style ? [style] : ["Fooocus V2"];
          const imageNumber = num_images ? Math.max(1, Math.floor(Number(num_images))) : 1;
          const negPrompt = negative_prompt || "";
          const imageSeed = seed !== undefined ? seed : -1; // Use -1 for random seed
          
          // Map aspect ratio strings to resolution values
          let aspectRatioSelection = "1152*896"; // Default resolution
          if (aspect_ratio) {
            const aspectRatioMap = {
              "square": "1024*1024",
              "portrait": "896*1152",
              "landscape": "1152*896",
              "widescreen": "1216*832"
            };
            
            // Use predefined aspect ratio or use directly if it contains dimensions
            aspectRatioSelection = aspectRatioMap[aspect_ratio.toLowerCase()] || 
                                  (aspect_ratio.includes("*") ? aspect_ratio : aspectRatioSelection);
          }
          
          // Log the request
          console.log(`Generating ${imageNumber} images with prompt: "${prompt}" using aspect ratio: ${aspectRatioSelection}`);
          if (imageSeed !== -1) {
            console.log(`Using specified seed: ${imageSeed}`);
          }
          
          // Check if Fooocus API is running
          const isApiRunning = await fooocusService.isApiUp();
          if (!isApiRunning) {
            return {
              content: [
                {
                  type: "text",
                  text: "The Fooocus API is not running. Please start the Fooocus API server first."
                }
              ],
              isError: true
            };
          }
          
          // Generate image through Fooocus API
          const response = await fooocusService.generateImage({
            prompt: prompt,
            negative_prompt: negPrompt,
            style_selections: styleSelections,
            performance_selection: "Quality",
            aspect_ratios_selection: aspectRatioSelection,
            image_number: imageNumber,
            image_seed: imageSeed,
            async_process: true, // Process asynchronously
            save_extension: "png"
          });
          
          // If async processing, wait for job to complete
          if (response.job_id) {
            let jobStatus = await fooocusService.checkJobStatus(response.job_id);
            
            // Send initial progress information back to Claude
            const initialResponse = {
              content: [
                {
                  type: "text",
                  text: `Image generation in progress with prompt: "${prompt}"\nGenerating ${imageNumber} image(s)...\nWill show results when complete.`
                }
              ],
              isPartial: true // Flag that more updates will follow
            };
            
            // Return initial response
            if (jobStatus.job_stage === "PENDING" || jobStatus.job_stage === "RUNNING") {
              console.log("Returning initial progress to Claude");
            }
            
            // Poll for job completion
            let lastProgressUpdate = 0;
            while (jobStatus.job_stage === "PENDING" || jobStatus.job_stage === "RUNNING") {
              // Get polling interval from environment variables or use default
              const pollingInterval = parseInt(process.env.POLLING_INTERVAL || '2000', 10);
              
              // Wait before polling again
              await new Promise(resolve => setTimeout(resolve, pollingInterval));
              
              try {
                jobStatus = await fooocusService.checkJobStatus(response.job_id);
                
                // Log progress if available and significantly different from last update
                if (jobStatus.job_progress) {
                  const currentProgress = Math.round(jobStatus.job_progress * 100);
                  if (currentProgress >= lastProgressUpdate + 20) { // Only update every 20% progress
                    console.log(`Generation progress: ${currentProgress}%`);
                    lastProgressUpdate = currentProgress;
                  }
                }
              } catch (error) {
                console.error("Error checking job status:", error);
                // Continue the loop despite errors - don't break the generation
              }
            }
            
            // Check if job completed successfully
            if (jobStatus.job_stage === "COMPLETED" && jobStatus.job_result && jobStatus.job_result.length > 0) {
              // Extract the actual filename from the URL for a cleaner display
              const extractFilename = (url) => {
                try {
                  const parsedUrl = new URL(url);
                  const pathSegments = parsedUrl.pathname.split('/');
                  return pathSegments[pathSegments.length - 1];
                } catch (e) {
                  // If URL parsing fails, just return the full URL
                  return url;
                }
              };
              
              // Save metadata for each generated image
              for (const result of jobStatus.job_result) {
                const filename = extractFilename(result.url);
                saveImageMetadata(filename, {
                  prompt: prompt,
                  negative_prompt: negPrompt,
                  seed: result.seed,
                  style: styleSelections.join(', '),
                  style_selections: styleSelections,
                  aspect_ratio: aspectRatioSelection,
                  created: new Date().toISOString()
                });
              }
              
              // Format results with image URLs and detailed information
              const results = jobStatus.job_result.map((image, index) => {
                const imageUrl = image.url;
                const imageSeed = image.seed || "random";
                return `Image ${index + 1} (seed: ${imageSeed}):\\n${imageUrl}\\n`;
              }).join("\\n");
              
              const generationDetails = [
                `Prompt: "${prompt}"`,
                negPrompt ? `Negative prompt: "${negPrompt}"` : null,
                `Style: ${styleSelections.join(', ')}`,
                `Aspect ratio: ${aspectRatioSelection}`,
                `Images saved to: ${OUTPUT_DIR}`
              ].filter(Boolean).join('\\n');
              
              return {
                content: [
                  {
                    type: "text",
                    text: `Successfully generated ${jobStatus.job_result.length} image(s)\\n\\n${results}\\n\\nGeneration Details:\\n${generationDetails}`
                  }
                ]
              };
            } else if (jobStatus.job_error) {
              console.error("Job error:", jobStatus.job_error);
              return {
                content: [
                  {
                    type: "text",
                    text: `Error generating images: ${jobStatus.job_error}\n\nTroubleshooting tips:\n- Check if Fooocus API is running\n- Verify your prompt doesn't contain prohibited content\n- Try with a different style or aspect ratio\n- Check the Fooocus API logs for more details`
                  }
                ],
                isError: true
              };
            }
          }
          
          // If we get here, something went wrong
          return {
            content: [
              {
                type: "text",
                text: "There was a problem with the image generation process. The Fooocus API may have failed to respond properly.\n\nTroubleshooting steps:\n1. Check if the Fooocus API is running\n2. Verify the Fooocus installation is working correctly\n3. Check server logs for more detailed error information\n4. Try again with a simpler prompt"
              }
            ],
            isError: true
          };
        } catch (error) {
          console.error("Error in generate_image tool:", error);
          return {
            content: [
              {
                type: "text",
                text: `Error generating image: ${error.message || String(error)}\n\nTroubleshooting steps:\n1. Check if the Fooocus API is running\n2. Verify the API URL is correct\n3. Check system resources (memory, disk space)\n4. Try with a simpler prompt or different parameters`
              }
            ],
            isError: true
          };
        }
      }
    });

    // Create a registry of active jobs for rate limiting
    const activeJobs = new Set();
    const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10);

    // Display a startup banner
    const startupBanner = `
    ┌───────────────────────────────────────────────┐
    │                                               │
    │  🎨 LocalViz MCP Server                       │
    │  Local Image Generation with Fooocus          │
    │                                               │
    └───────────────────────────────────────────────┘
    
    🌟 Starting LocalViz MCP server for local image generation
    🔧 Configuration:
       • Images will be saved to: ${OUTPUT_DIR}
       • API URL: ${process.env.FOOOCUS_API_URL || 'http://127.0.0.1:8888'}
       • Max concurrent jobs: ${MAX_CONCURRENT_JOBS}
       • Log level: ${process.env.LOG_LEVEL || 'info'}
    
    ⚡ Ready to generate images!
    `;
    
    console.log(startupBanner);
    
    // Start the server
    await server.connect();
  } catch (error) {
    console.error("Failed to start LocalViz server:", error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  console.error("Unhandled error in server startup:", error);
  process.exit(1);
});
