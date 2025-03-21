import { Server } from "@modelcontextprotocol/sdk";
import { StdioServerTransport } from "@modelcontextprotocol/sdk";
import { fooocusService } from "./services/fooocusService";
import { ensureOutputDirExists, getOutputDir } from "./utils/fileUtils";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Ensure output directory exists
ensureOutputDirExists();

// Create an MCP server
const server = new Server({
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
      description: "Number of images to generate (1-4)",
      type: "number",
      required: false
    }
  ],
  execute: async ({ prompt, negative_prompt, style, num_images }: { 
    prompt: string, 
    negative_prompt?: string, 
    style?: string, 
    num_images?: number 
  }) => {
    try {
      // Default values
      const styleSelections = style ? [style] : ["Fooocus V2"];
      const imageNumber = num_images ? Math.min(Math.max(1, Math.floor(Number(num_images))), 4) : 1;
      const negPrompt = negative_prompt || "";

      // Log the request
      console.log(`Generating ${imageNumber} images with prompt: "${prompt}"`);
      
      // Generate image through Fooocus API
      const response = await fooocusService.generateImage({
        prompt: prompt,
        negative_prompt: negPrompt,
        style_selections: styleSelections,
        performance_selection: "Quality",
        aspect_ratios_selection: "1152*896", // Default resolution
        image_number: imageNumber,
        image_seed: -1, // Random seed
        async_process: true, // Process asynchronously
        save_extension: "png"
      });

      // If async processing, wait for job to complete
      if (response.job_id) {
        let jobStatus = await fooocusService.checkJobStatus(response.job_id);
        
        // Poll for job completion
        while (jobStatus.job_stage === "PENDING" || jobStatus.job_stage === "RUNNING") {
          // Wait before polling again
          await new Promise(resolve => setTimeout(resolve, 2000));
          jobStatus = await fooocusService.checkJobStatus(response.job_id);
          
          // Log progress if available
          if (jobStatus.job_progress) {
            console.log(`Generation progress: ${Math.round(jobStatus.job_progress * 100)}%`);
          }
        }
        
        // Check if job completed successfully
        if (jobStatus.job_stage === "COMPLETED" && jobStatus.job_result && jobStatus.job_result.length > 0) {
          // Format results with image URLs
          const results = jobStatus.job_result.map((result: { url: string; seed?: number }, index: number) => {
            const imageUrl = result.url;
            const seed = result.seed || "random";
            return `Image ${index + 1} (seed: ${seed}): ${imageUrl}`;
          }).join("\\n\\n");
          
          return {
            content: [
              {
                type: "text",
                text: `Successfully generated ${jobStatus.job_result.length} image(s)\\n\\n${results}\\n\\nImages have been saved to: ${getOutputDir()}`
              }
            ]
          };
        } else if (jobStatus.job_error) {
          return {
            content: [
              {
                type: "text",
                text: `Error generating images: ${jobStatus.job_error}`
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
            text: "There was a problem with the image generation process. Please try again."
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
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
});

// Register a tool to manage the Fooocus API server
server.tool({
  name: "manage_fooocus_server",
  description: "Manage the Fooocus API server (start or stop)",
  parameters: [
    {
      name: "action",
      description: "Action to perform (start or stop)",
      type: "string",
      required: true
    }
  ],
  execute: async ({ action }: { action: string }) => {
    try {
      if (action === "start") {
        const isRunning = await fooocusService.isApiUp();
        
        if (isRunning) {
          return {
            content: [
              {
                type: "text",
                text: "Fooocus API server is already running."
              }
            ]
          };
        }
        
        await fooocusService.startApi();
        
        return {
          content: [
            {
              type: "text",
              text: "Fooocus API server started successfully."
            }
          ]
        };
      } else if (action === "stop") {
        await fooocusService.stopApi();
        
        return {
          content: [
            {
              type: "text",
              text: "Fooocus API server stopped successfully."
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Invalid action: ${action}. Expected "start" or "stop".`
            }
          ],
          isError: true
        };
      }
    } catch (error) {
      console.error("Error in manage_fooocus_server tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
});

// Register a tool to list available styles
server.tool({
  name: "list_styles",
  description: "List available style presets for image generation",
  parameters: [],
  execute: async () => {
    try {
      // Common styles available in Fooocus
      const styles = [
        "Fooocus V2",
        "Fooocus Enhance",
        "Fooocus Sharp",
        "Fooocus Masterpiece",
        "Fooocus Photograph",
        "Fooocus Cinematic",
        "SAI Anime",
        "SAI Digital Art",
        "SAI Fantasy Art",
        "SAI Comic Book",
        "SAI Neonpunk",
        "SAI Photographic",
        "SAI Pixel Art",
        "Ads Advertising",
        "Ads Automotive",
        "Ads Corporate",
        "Ads Fashion Editorial",
        "Ads Food Photography",
        "Ads Luxury",
        "Ads Real Estate",
        "Ads Retail",
        "Architecture Exterior",
        "Architecture Interior",
        "Architecture Visualization",
        "Film Analog",
        "Film Cinematic",
        "Film Macro Photography",
        "Futuristic Sci-fi",
        "Landscape",
        "Mosaic",
        "Oil Painting",
        "Watercolor"
      ];
      
      return {
        content: [
          {
            type: "text",
            text: `Available style presets in Fooocus:\n\n${styles.join('\n')}`
          }
        ]
      };
    } catch (error) {
      console.error("Error in list_styles tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await fooocusService.stopApi();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await fooocusService.stopApi();
  process.exit(0);
});

// Start the server
server.start().catch((err: Error) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
