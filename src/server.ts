import { Server } from "@modelcontextprotocol/sdk";
import { StdioServerTransport } from "@modelcontextprotocol/sdk";
import { fooocusService } from "./services/fooocusService";
import { 
  ensureOutputDirExists, 
  getOutputDir, 
  saveImageMetadata, 
  getRecentImages, 
  getImageMetadata, 
  openOutputDirectory 
} from "./utils/fileUtils";
import logger from "./utils/logger";
import dotenv from 'dotenv';
import path from 'path';

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
  execute: async ({ prompt, negative_prompt, style, num_images, seed, aspect_ratio }: { 
    prompt: string, 
    negative_prompt?: string, 
    style?: string, 
    num_images?: number,
    seed?: number,
    aspect_ratio?: string
  }) => {
    try {
      // Default values
      const styleSelections = style ? [style] : ["Fooocus V2"];
      const imageNumber = num_images ? Math.max(1, Math.floor(Number(num_images))) : 1;
      const negPrompt = negative_prompt || "";
      const imageSeed = seed !== undefined ? seed : -1; // Use -1 for random seed

      // Map aspect ratio strings to resolution values
      let aspectRatioSelection = "1152*896"; // Default resolution
      if (aspect_ratio) {
        const aspectRatioMap: Record<string, string> = {
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
          const extractFilename = (url: string) => {
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
          jobStatus.job_result.forEach((result: { url: string; seed?: number }) => {
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
          });
          
          // Format results with image URLs and detailed information
          const results = jobStatus.job_result.map((image: { url: string; seed?: number }, index: number) => {
            const imageUrl = image.url;
            const imageSeed = image.seed || "random";
            return `Image ${index + 1} (seed: ${imageSeed}):\\n${imageUrl}\\n`;
          }).join("\\n");
          
          const generationDetails = [
            `Prompt: "${prompt}"`,
            negPrompt ? `Negative prompt: "${negPrompt}"` : null,
            `Style: ${styleSelections.join(', ')}`,
            `Aspect ratio: ${aspectRatioSelection}`,
            `Images saved to: ${getOutputDir()}`
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
            text: "There was a problem with the image generation process. The Fooocus API may have failed to respond properly.\n\nTroubleshooting steps:\n1. Check if the Fooocus API is running using the manage_fooocus_server tool\n2. Verify the Fooocus installation is working correctly\n3. Check server logs for more detailed error information\n4. Try again with a simpler prompt"
          }
        ],
        isError: true
      };
    } catch (error) {
      // Log the full error for debugging
      console.error("Error in generate_image tool:", error);
      
      // Try to determine what kind of error occurred
      let errorMessage = "An unexpected error occurred during image generation.";
      let troubleshootingTips = "";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Add specific troubleshooting tips based on error message patterns
        if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("connect")) {
          troubleshootingTips = "The Fooocus API server appears to be offline. Try running the manage_fooocus_server tool with 'start' parameter.";
        } else if (errorMessage.includes("timeout")) {
          troubleshootingTips = "The API request timed out. Your image might be too complex or require more processing time.";
        } else if (errorMessage.includes("404")) {
          troubleshootingTips = "The requested API endpoint was not found. Check your Fooocus API installation.";
        }
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}\n\n${troubleshootingTips}`
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

// Register a tool to browse recent generated images
server.tool({
  name: "browse_images",
  description: "Browse recently generated images",
  parameters: [
    {
      name: "limit",
      description: "Maximum number of images to return (default: 10)",
      type: "number",
      required: false
    },
    {
      name: "sort_by",
      description: "Sort order ('newest' or 'oldest')",
      type: "string",
      required: false
    },
    {
      name: "open_folder",
      description: "Whether to open the output folder in the system file explorer (default: true)",
      type: "boolean",
      required: false
    }
  ],
  execute: async ({ limit, sort_by, open_folder }: { limit?: number, sort_by?: string, open_folder?: boolean }) => {
    try {
      // Validate and set defaults
      const imageLimit = limit ? Math.min(Math.max(1, parseInt(String(limit))), 50) : 10;
      const sortOrder = sort_by?.toLowerCase() === 'oldest' ? 'oldest' : 'newest';
      // Default to opening folder unless explicitly set to false
      const shouldOpenFolder = open_folder !== false;
      
      // Get recent images
      const images = getRecentImages(imageLimit, sortOrder);
      
      if (images.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No images found in the output directory. Try generating some images first."
            }
          ]
        };
      }
      
      // Format the response
      const formattedResponse = images.map((image, index) => {
        const filename = path.basename(image.path);
        const created = new Date(image.stats.birthtime).toLocaleString();
        const metadata = getImageMetadata(image.path);
        
        let metadataText = '';
        if (metadata) {
          metadataText = `\nPrompt: ${metadata.prompt || 'Unknown'}\n`;
          if (metadata.negative_prompt) metadataText += `Negative: ${metadata.negative_prompt}\n`;
          if (metadata.seed) metadataText += `Seed: ${metadata.seed}\n`;
          if (metadata.style) metadataText += `Style: ${metadata.style}\n`;
        }
        
        // Include path but not URL since we'll open the folder directly
        return `Image ${index + 1}: ${filename}\nCreated: ${created}${metadataText}`;
      }).join('\n\n');
      
      // Open the folder if requested
      let folderMessage = '';
      if (shouldOpenFolder) {
        try {
          await openOutputDirectory();
          folderMessage = 'The images folder has been opened in your file explorer.';
        } catch (error) {
          console.error('Failed to open folder:', error);
          folderMessage = `Note: Could not automatically open the output folder (${error}). Please navigate to it manually.`;
        }
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Found ${images.length} recent images:\n\n${formattedResponse}\n\nImages are stored in: ${getOutputDir()}\n\n${folderMessage}`
          }
        ]
      };
    } catch (error) {
      console.error("Error in browse_images tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error browsing images: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
});

// Register a tool to generate variations of an existing image
server.tool({
  name: "generate_variation",
  description: "Generate variations of an existing image",
  parameters: [
    {
      name: "image_index",
      description: "Index of the image to use as reference (from browse_images tool)",
      type: "number",
      required: true
    },
    {
      name: "prompt",
      description: "New prompt to modify the image (optional, will use original if not provided)",
      type: "string",
      required: false
    },
    {
      name: "negative_prompt",
      description: "Elements to avoid in the generated image",
      type: "string",
      required: false
    },
    {
      name: "num_images",
      description: "Number of variations to generate (default: 1)",
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
      description: "Aspect ratio for generated images (e.g., 'square', 'portrait', 'landscape')",
      type: "string",
      required: false
    }
  ],
  execute: async ({ image_index, prompt, negative_prompt, num_images, seed, aspect_ratio }: { 
    image_index: number,
    prompt?: string,
    negative_prompt?: string,
    num_images?: number,
    seed?: number,
    aspect_ratio?: string
  }) => {
    try {
      // Get recent images to find the referenced one
      const recentImages = getRecentImages(20, 'newest');
      
      // Get the specified image by index
      const sourceImage = recentImages[image_index - 1];
      if (!sourceImage) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Image with index ${image_index} not found. Please use browse_images tool to see available images.`
            }
          ],
          isError: true
        };
      }

      // Get metadata for the source image
      const metadata = getImageMetadata(sourceImage.path);
      
      // Use provided parameters or fall back to original image metadata
      const variationPrompt = prompt || metadata.prompt || "A variation of the original image";
      const variationNegative = negative_prompt || metadata.negative_prompt || "";
      const imageNumber = num_images ? Math.max(1, Math.floor(Number(num_images))) : 1;
      const imageSeed = seed !== undefined ? seed : (metadata.seed || -1);
      
      // Map aspect ratio strings to resolution values or use original
      let aspectRatioSelection = metadata.aspect_ratio || "1152*896"; // Default resolution
      if (aspect_ratio) {
        const aspectRatioMap: Record<string, string> = {
          "square": "1024*1024",
          "portrait": "896*1152",
          "landscape": "1152*896",
          "widescreen": "1216*832"
        };
        
        // Use predefined aspect ratio or use directly if it contains dimensions
        aspectRatioSelection = aspectRatioMap[aspect_ratio.toLowerCase()] || 
                              (aspect_ratio.includes("*") ? aspect_ratio : aspectRatioSelection);
      }
      
      // Log the variation request
      console.log(`Generating ${imageNumber} variations with prompt: "${variationPrompt}"`);
      console.log(`Based on original image: ${path.basename(sourceImage.path)}`);
      
      // Generate image through Fooocus API
      const response = await fooocusService.generateImage({
        prompt: variationPrompt,
        negative_prompt: variationNegative,
        style_selections: metadata.style_selections || ["Fooocus V2"],
        performance_selection: "Quality",
        aspect_ratios_selection: aspectRatioSelection,
        image_number: imageNumber,
        image_seed: imageSeed,
        async_process: true,
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
              text: `Generating ${imageNumber} variation(s) of ${path.basename(sourceImage.path)}...\nWill show results when complete.`
            }
          ],
          isPartial: true
        };
        
        if (jobStatus.job_stage === "PENDING" || jobStatus.job_stage === "RUNNING") {
          console.log("Returning initial progress to Claude");
        }
        
        // Poll for job completion
        let lastProgressUpdate = 0;
        while (jobStatus.job_stage === "PENDING" || jobStatus.job_stage === "RUNNING") {
          // Get polling interval from environment variables or use default
          const pollingInterval = parseInt(process.env.POLLING_INTERVAL || '2000', 10);
          
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
          
          try {
            jobStatus = await fooocusService.checkJobStatus(response.job_id);
            
            if (jobStatus.job_progress) {
              const currentProgress = Math.round(jobStatus.job_progress * 100);
              if (currentProgress >= lastProgressUpdate + 20) {
                console.log(`Variation progress: ${currentProgress}%`);
                lastProgressUpdate = currentProgress;
              }
            }
          } catch (error) {
            console.error("Error checking variation job status:", error);
          }
        }
        
        // Check if job completed successfully
        if (jobStatus.job_stage === "COMPLETED" && jobStatus.job_result && jobStatus.job_result.length > 0) {
          // Extract the actual filename from the URL
          const extractFilename = (url: string) => {
            try {
              const parsedUrl = new URL(url);
              const pathSegments = parsedUrl.pathname.split('/');
              return pathSegments[pathSegments.length - 1];
            } catch (e) {
              return url;
            }
          };
          
          // Save metadata for generated images
          jobStatus.job_result.forEach((result: { url: string; seed?: number }) => {
            const filename = extractFilename(result.url);
            saveImageMetadata(filename, {
              prompt: variationPrompt,
              negative_prompt: variationNegative,
              seed: result.seed,
              style: metadata.style_selections?.[0] || "Fooocus V2",
              aspect_ratio: aspectRatioSelection,
              original_image: path.basename(sourceImage.path),
              created: new Date().toISOString()
            });
          });
          
          // Format results with image URLs
          const results = jobStatus.job_result.map((result: { url: string; seed?: number }, idx: number) => {
            const imageUrl = result.url;
            const seed = result.seed || "random";
            return `Variation ${idx + 1} (seed: ${seed}):\\n${imageUrl}\\n`;
          }).join("\\n");
          
          // Include information about the original image
          const sourceInfo = `Based on original image: ${path.basename(sourceImage.path)}`;
          
          const generationDetails = [
            `Prompt: "${variationPrompt}"`,
            variationNegative ? `Negative prompt: "${variationNegative}"` : null,
            `Original image: ${path.basename(sourceImage.path)}`,
            `Images saved to: ${getOutputDir()}`
          ].filter(Boolean).join('\\n');
          
          return {
            content: [
              {
                type: "text",
                text: `Successfully generated ${jobStatus.job_result.length} variation(s)\\n\\n${results}\\n\\nGeneration Details:\\n${generationDetails}`
              }
            ]
          };
        } else if (jobStatus.job_error) {
          console.error("Variation job error:", jobStatus.job_error);
          return {
            content: [
              {
                type: "text",
                text: `Error generating image variations: ${jobStatus.job_error}\n\nTroubleshooting tips:\n- Check if Fooocus API is running\n- Verify your prompt doesn't contain prohibited content\n- Try with a different aspect ratio`
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
            text: "There was a problem with the variation generation process. Please try again."
          }
        ],
        isError: true
      };
    } catch (error) {
      console.error("Error in generate_variation tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error generating variations: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
});

// Create a registry of active jobs for rate limiting
const activeJobs: Set<string> = new Set();
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10);

// Implement proper job queue management and rate limiting
server.middleware((request: any, next: (request: any) => Promise<any>) => {
  // Only rate limit image generation requests
  if (request.type === 'tool_call' && 
     (request.tool_call.name === 'generate_image' || request.tool_call.name === 'generate_variation')) {
    
    // Check if we're at capacity
    if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
      console.log(`Rate limiting: ${activeJobs.size} jobs in progress (max: ${MAX_CONCURRENT_JOBS})`);
      return {
        content: [
          {
            type: "text",
            text: `Server is currently processing ${activeJobs.size} image generation jobs. Please try again in a moment when some jobs complete.`
          }
        ],
        isError: true
      };
    }
    
    // Add a unique job ID to track this request
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    activeJobs.add(jobId);
    
    // Process the request
    return next(request).then((response: any) => {
      // Remove the job from tracking when done
      activeJobs.delete(jobId);
      return response;
    }).catch((error: any) => {
      // Make sure to remove the job even on error
      activeJobs.delete(jobId);
      throw error;
    });
  }
  
  // Pass through non-image generation requests
  return next(request);
});

// Handle server shutdown with graceful cleanup
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  // Allow time for in-progress requests to complete
  console.log(`Waiting for ${activeJobs.size} active jobs to complete...`);
  
  // Try graceful shutdown of the API
  await fooocusService.stopApi();
  
  // Wait a moment for any lingering processes
  if (activeJobs.size > 0) {
    console.log('Waiting 5 seconds for graceful shutdown...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down from SIGTERM...');
  await fooocusService.stopApi();
  
  // Wait a moment before exiting
  await new Promise(resolve => setTimeout(resolve, 2000));
  process.exit(0);
});

// Add a server status tool
server.tool({
  name: "server_status",
  description: "Get information about the LocalViz MCP server status and statistics",
  parameters: [],
  execute: async () => {
    try {
      // Get uptime
      const uptime = process.uptime();
      const uptimeFormatted = formatUptime(uptime);
      
      // Get image directory stats
      const outputDir = getOutputDir();
      const imageStats = await getImageDirectoryStats();
      
      // Check API status
      const apiStatus = await fooocusService.isApiUp() 
        ? "Running" 
        : "Stopped (will auto-start when needed)";
        
      // Server version and platform info
      const version = "1.0.0";
      const platformInfo = `${process.platform} (${process.arch})`;
      
      // Memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);
      
      // Active jobs
      const activeJobCount = activeJobs.size;
      const maxJobs = MAX_CONCURRENT_JOBS;
      
      // Format all the information
      const statusInfo = [
        `📊 LocalViz MCP Server Status`,
        `----------------------------`,
        `Version: ${version}`,
        `Uptime: ${uptimeFormatted}`,
        `Platform: ${platformInfo}`,
        `Fooocus API: ${apiStatus}`,
        `Memory usage: ${memoryUsageMB} MB`,
        ``,
        `📈 Job Information`,
        `----------------------------`,
        `Active jobs: ${activeJobCount}/${maxJobs}`,
        `Output directory: ${outputDir}`,
        `Total images generated: ${imageStats.totalImages}`,
        `Most recent image: ${imageStats.mostRecentImage || 'None'}`,
        ``,
        `🔧 Server Configuration`,
        `----------------------------`,
        `API URL: ${process.env.FOOOCUS_API_URL || 'http://127.0.0.1:8888'}`,
        `API timeout: ${process.env.FOOOCUS_API_TIMEOUT || '30000'}ms`,
        `Polling interval: ${process.env.POLLING_INTERVAL || '2000'}ms`,
        `Max concurrent jobs: ${maxJobs}`
      ].join('\n');
      
      return {
        content: [
          {
            type: "text",
            text: statusInfo
          }
        ]
      };
    } catch (error) {
      console.error("Error in server_status tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error getting server status: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
});

// Helper function to format uptime nicely
function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// Helper function to get image directory stats
async function getImageDirectoryStats(): Promise<{totalImages: number, mostRecentImage: string | null}> {
  try {
    const images = getRecentImages(1, 'newest');
    const allImages = getRecentImages(1000, 'newest'); // Get a large number to count all
    
    return {
      totalImages: allImages.length,
      mostRecentImage: images.length > 0 ? path.basename(images[0].path) : null
    };
  } catch (error) {
    console.error("Error getting image stats:", error);
    return {
      totalImages: 0,
      mostRecentImage: null
    };
  }
}

// Display a startup banner
const startupBanner = `
┌───────────────────────────────────────────────┐
│                                               │
│             LocalViz MCP Server v1.0.0        │
│                                               │
└───────────────────────────────────────────────┘

🌟 Starting LocalViz MCP server for local image generation
🔧 Configuration:
   • Images will be saved to: ${getOutputDir()}
   • API URL: ${process.env.FOOOCUS_API_URL || 'http://127.0.0.1:8888'}
   • Max concurrent jobs: ${MAX_CONCURRENT_JOBS}
   • Log level: ${process.env.LOG_LEVEL || 'info'}

⚙️  Available tools:
   • generate_image: Create images from text prompts
   • browse_images: Browse and manage generated images 
   • generate_variation: Create variations of existing images
   • server_status: Get server information and statistics
   • list_styles: View available style presets
   • manage_fooocus_server: Control the Fooocus API server

💡 The server will start the Fooocus API automatically when needed
`;

console.log(startupBanner);
logger.info("Server starting up");

// Start the server
server.start()
  .then(() => {
    logger.info('Server started successfully and ready for requests');
  })
  .catch((err: Error) => {
    logger.error("Failed to start server", err);
    process.exit(1);
  });
