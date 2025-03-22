#!/usr/bin/env node
/**
 * LocalViz MCP Server - V1
 * Provides local image generation capabilities using Fooocus API
 */

const { McpServer } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js');
const { StdioServerTransport } = require('./node_modules/@modelcontextprotocol/sdk/dist/cjs/server/stdio.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { spawn, exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');

// Load environment variables from .env file
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('Loading environment variables from .env file');
  dotenv.config({ path: envPath });
}

// Helper to get log level number
function getLogLevel() {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  }[level] || 2; // Default to info
}

// Helper to clean environment variables with quotes
function cleanEnv(value) {
  if (!value) return value;
  return value.replace(/^["'](.*)["']$/, '$1');
}

// Configuration
const CONFIG = {
  // API settings
  FOOOCUS_API_URL: cleanEnv(process.env.FOOOCUS_API_URL) || 'http://127.0.0.1:8888',
  FOOOCUS_API_PATH: cleanEnv(process.env.FOOOCUS_API_PATH) || path.join(process.cwd(), 'Fooocus-API'),
  FOOOCUS_PATH: cleanEnv(process.env.FOOOCUS_PATH) || path.join(process.cwd(), 'Fooocus'),
  API_TIMEOUT: parseInt(process.env.API_TIMEOUT || '30000', 10),
  POLLING_INTERVAL: parseInt(process.env.POLLING_INTERVAL || '2000', 10),
  
  // Output settings
  OUTPUT_DIR: cleanEnv(process.env.OUTPUT_DIR) || path.join(process.cwd(), 'output'),
  
  // Concurrent job limits
  MAX_CONCURRENT_JOBS: parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10),
  
  // API management
  MANAGE_API: process.env.MANAGE_API === 'true',
  API_SHUTDOWN_TIMEOUT: parseInt(process.env.API_SHUTDOWN_TIMEOUT || '300000', 10), // Default 5 minutes
  
  // Logging
  LOG_LEVEL: cleanEnv(process.env.LOG_LEVEL) || 'info',
  LOG_FILE: cleanEnv(process.env.LOG_FILE) || null
};

// Promisify fs functions
const accessAsync = promisify(fs.access);
const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const execAsync = promisify(exec);

// Verify critical paths exist
const verifyPaths = async () => {
  console.log("Verifying configured paths:");
  
  // Check output directory
  if (CONFIG.OUTPUT_DIR) {
    try {
      await accessAsync(CONFIG.OUTPUT_DIR, fs.constants.W_OK);
      console.log(`✅ Output directory exists and is writable: ${CONFIG.OUTPUT_DIR}`);
    } catch (error) {
      try {
        await mkdirAsync(CONFIG.OUTPUT_DIR, { recursive: true });
        console.log(`✅ Created output directory: ${CONFIG.OUTPUT_DIR}`);
      } catch (mkdirError) {
        console.error(`❌ Failed to create output directory: ${mkdirError.message}`);
      }
    }
  }
  
  // Check Fooocus API path
  if (CONFIG.FOOOCUS_API_PATH) {
    try {
      await accessAsync(CONFIG.FOOOCUS_API_PATH, fs.constants.R_OK);
      console.log(`✅ Fooocus API path exists: ${CONFIG.FOOOCUS_API_PATH}`);
      
      try {
        await accessAsync(path.join(CONFIG.FOOOCUS_API_PATH, 'run_api.sh'), fs.constants.X_OK);
        console.log('✅ run_api.sh script found and is executable');
      } catch (err) {
        console.error(`❌ run_api.sh script not found or not executable in ${CONFIG.FOOOCUS_API_PATH}`);
      }
    } catch (error) {
      console.error(`❌ Fooocus API path does not exist or is not accessible: ${CONFIG.FOOOCUS_API_PATH}`);
    }
  }
  
  // Check Fooocus path
  if (CONFIG.FOOOCUS_PATH) {
    try {
      await accessAsync(CONFIG.FOOOCUS_PATH, fs.constants.R_OK);
      console.log(`✅ Fooocus path exists: ${CONFIG.FOOOCUS_PATH}`);
    } catch (error) {
      console.error(`❌ Fooocus path does not exist or is not accessible: ${CONFIG.FOOOCUS_PATH}`);
    }
  }
};

/**
 * Logger utility for structured logging
 */
class Logger {
  constructor(level = 'info', logFile = null) {
    this.level = level;
    this.logFile = logFile;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    // Create log directory if needed
    if (this.logFile) {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }
  
  // Format message with timestamp
  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }
  
  // Generic log method
  log(level, message) {
    if (this.levels[level] <= this.levels[this.level]) {
      const formattedMessage = this.formatMessage(level, message);
      console.log(formattedMessage);
      
      // Also write to log file if specified
      if (this.logFile) {
        try {
          fs.appendFileSync(
            this.logFile, 
            formattedMessage + '\n', 
            { flag: 'a' }
          );
        } catch (err) {
          console.error(`Failed to write to log file: ${err.message}`);
        }
      }
    }
  }
  
  // Convenience methods for each log level
  error(message) { this.log('error', message); }
  warn(message) { this.log('warn', message); }
  info(message) { this.log('info', message); }
  debug(message) { this.log('debug', message); }
}

// Initialize logger
const logger = new Logger(CONFIG.LOG_LEVEL, CONFIG.LOG_FILE);

/**
 * File management utilities
 */
class FileManager {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }
  
  // Create directory if it doesn't exist
  async ensureDirectoryExists(dir) {
    try {
      await accessAsync(dir, fs.constants.F_OK);
    } catch (error) {
      await mkdirAsync(dir, { recursive: true });
    }
  }
  
  // Create a unique output directory based on prompt
  async createOutputDirectory(promptInfo) {
    // Create base output directory if it doesn't exist
    await this.ensureDirectoryExists(this.baseDir);
    
    // Create a prompt-based subdirectory
    const promptText = promptInfo.substring(0, 40).replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputDir = path.join(this.baseDir, `${timestamp}_${promptText}`);
    
    await this.ensureDirectoryExists(outputDir);
    return outputDir;
  }
  
  // Save metadata for a generated image
  async saveMetadata(outputDir, filename, metadata) {
    const metadataPath = path.join(outputDir, `${path.basename(filename, path.extname(filename))}.json`);
    await writeFileAsync(metadataPath, JSON.stringify(metadata, null, 2));
  }
}

// Initialize file manager
const fileManager = new FileManager(CONFIG.OUTPUT_DIR);

console.log("Starting LocalViz MCP V1 server...");

// Verify paths at startup
verifyPaths().then(() => {
  console.log("\n┌───────────────────────────────────────────────┐");
  console.log("│                                               │");
  console.log("│  🎨 LocalViz MCP Server V1                    │");
  console.log("│  Local Image Generation with Fooocus          │");
  console.log("│                                               │");
  console.log("└───────────────────────────────────────────────┘\n");
  
  console.log("🌟 Starting LocalViz MCP server for local image generation");
  console.log("🔧 Configuration:");
  console.log(`   • Images will be saved to: ${CONFIG.OUTPUT_DIR}`);
  console.log(`   • API URL: ${CONFIG.FOOOCUS_API_URL}`);
  console.log(`   • Max concurrent jobs: ${CONFIG.MAX_CONCURRENT_JOBS}`);
  console.log(`   • Log level: ${CONFIG.LOG_LEVEL}`);
  console.log("\n⚡ Ready to generate images!\n");

/**
 * Fooocus API Management
 */
class FoocusApiManager {
  constructor() {
    this.apiProcess = null;
    this.shutdownTimer = null;
    this.lastUseTimestamp = 0;
  }
  
  // Check if the API is running and accessible
  async isApiRunning() {
    try {
      const response = await axios.get(`${CONFIG.FOOOCUS_API_URL}/ping`, { 
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
  
  // Start the Fooocus API
  async startApi() {
    if (await this.isApiRunning()) {
      logger.info("Fooocus API is already running");
      return true;
    }
    
    try {
      logger.info("Starting Fooocus API...");
      
      const runApiPath = path.join(CONFIG.FOOOCUS_API_PATH, 'run_api.sh');
      if (!fs.existsSync(runApiPath)) {
        throw new Error(`run_api.sh not found at ${runApiPath}`);
      }
      
      // Kill any existing Python processes running the Fooocus API
      await execAsync("pkill -f 'python3.*api.py' || true");
      
      // Start the API with the run_api.sh script
      this.apiProcess = spawn('bash', [runApiPath], {
        detached: true,
        stdio: 'pipe',
        cwd: CONFIG.FOOOCUS_API_PATH
      });
      
      // Handle process events
      this.apiProcess.stdout.on('data', (data) => {
        logger.debug(`API stdout: ${data}`);
      });
      
      this.apiProcess.stderr.on('data', (data) => {
        logger.debug(`API stderr: ${data}`);
      });
      
      this.apiProcess.on('error', (error) => {
        logger.error(`Failed to start API: ${error.message}`);
      });
      
      this.apiProcess.on('close', (code) => {
        logger.info(`API process exited with code ${code}`);
        this.apiProcess = null;
      });
      
      // Wait for the API to be accessible
      let isRunning = false;
      const maxRetries = 30;
      let retries = 0;
      
      while (!isRunning && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        isRunning = await this.isApiRunning();
        retries++;
        if (!isRunning) {
          logger.debug(`API not ready, retrying (${retries}/${maxRetries})...`);
        }
      }
      
      if (!isRunning) {
        throw new Error(`Failed to start API after ${maxRetries} attempts`);
      }
      
      logger.info("✅ Fooocus API is now running");
      this.updateLastUse();
      return true;
    } catch (error) {
      logger.error(`Failed to start API: ${error.message}`);
      return false;
    }
  }
  
  // Stop the Fooocus API
  async stopApi() {
    // Clear any existing shutdown timer
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = null;
    }
    
    if (!await this.isApiRunning()) {
      logger.info("API is not running");
      return true;
    }
    
    try {
      logger.info("Stopping Fooocus API...");
      
      // Try graceful shutdown first
      try {
        await axios.post(`${CONFIG.FOOOCUS_API_URL}/shutdown`);
        logger.info("Sent shutdown request to API");
      } catch (error) {
        logger.warn(`Failed to send shutdown request: ${error.message}`);
      }
      
      // Kill the process
      if (this.apiProcess) {
        process.kill(-this.apiProcess.pid);
        this.apiProcess = null;
      }
      
      // Kill any remaining Python processes running the Fooocus API
      await execAsync("pkill -f 'python3.*api.py' || true");
      
      logger.info("✅ Fooocus API stopped");
      return true;
    } catch (error) {
      logger.error(`Failed to stop API: ${error.message}`);
      return false;
    }
  }
  
  // Update last use timestamp and schedule automatic shutdown
  updateLastUse() {
    this.lastUseTimestamp = Date.now();
    
    // If auto-management is enabled, schedule shutdown
    if (CONFIG.MANAGE_API && CONFIG.API_SHUTDOWN_TIMEOUT > 0) {
      // Clear any existing shutdown timer
      if (this.shutdownTimer) {
        clearTimeout(this.shutdownTimer);
      }
      
      // Schedule new shutdown
      this.shutdownTimer = setTimeout(async () => {
        const idleTime = Date.now() - this.lastUseTimestamp;
        if (idleTime >= CONFIG.API_SHUTDOWN_TIMEOUT) {
          logger.info(`API idle for ${Math.round(idleTime / 1000)} seconds, shutting down`);
          await this.stopApi();
        }
      }, CONFIG.API_SHUTDOWN_TIMEOUT);
    }
  }
}

// Initialize API manager
const apiManager = new FoocusApiManager();

/**
 * Job Management
 */
class JobManager {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.activeJobs = {};
    this.jobQueue = [];
  }
  
  // Add a new job to the queue
  addJob(jobId, jobData) {
    this.activeJobs[jobId] = {
      id: jobId,
      ...jobData,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null
    };
    
    this.jobQueue.push(jobId);
    this.processQueue();
    return jobId;
  }
  
  // Process the job queue
  async processQueue() {
    // Check how many jobs are currently running
    const runningJobs = Object.values(this.activeJobs).filter(job => job.status === 'running');
    
    // Process as many jobs as possible up to max concurrent
    while (runningJobs.length < this.maxConcurrent && this.jobQueue.length > 0) {
      const jobId = this.jobQueue.shift();
      const job = this.activeJobs[jobId];
      
      if (job) {
        // Update job status and start time
        job.status = 'running';
        job.startedAt = new Date();
        job.progress = 0;
        
        // Start the job processing
        this.processJob(jobId);
        runningJobs.push(job);
      }
    }
  }
  
  // Process a specific job
  async processJob(jobId) {
    const job = this.activeJobs[jobId];
    if (!job || job.status !== 'running') return;
    
    try {
      // Ensure the API is running
      if (!(await apiManager.isApiRunning())) {
        if (CONFIG.MANAGE_API) {
          const started = await apiManager.startApi();
          if (!started) {
            throw new Error("Failed to start Fooocus API");
          }
        } else {
          throw new Error("Fooocus API is not running");
        }
      }
      
      // Update API last use time
      apiManager.updateLastUse();
      
      // Call the API to start image generation
      const generateResponse = await axios.post(
        `${CONFIG.FOOOCUS_API_URL}/v1/generation/text-to-image`, 
        {
          prompt: job.prompt,
          negative_prompt: job.negative_prompt || "",
          style_selections: [job.style || "Fooocus V2"],
          performance_selection: "Speed",
          aspect_ratios: job.aspect_ratio || "1152×896 (Custom)",
          image_number: 1,
          seed: -1,
        },
        { timeout: CONFIG.API_TIMEOUT }
      );
      
      const { task_id } = generateResponse.data;
      if (!task_id) {
        throw new Error("No task ID returned from API");
      }
      
      job.taskId = task_id;
      job.progress = 10;
      
      // Poll for job progress
      const startTime = Date.now();
      let completed = false;
      
      while (!completed) {
        // Check if job has been running too long
        if (Date.now() - startTime > CONFIG.API_TIMEOUT) {
          throw new Error("Job timed out");
        }
        
        // Wait before polling again
        await new Promise(r => setTimeout(r, CONFIG.POLLING_INTERVAL));
        
        try {
          const progressResponse = await axios.get(
            `${CONFIG.FOOOCUS_API_URL}/v1/generation/task/${task_id}`
          );
          
          const { status, progress, done } = progressResponse.data;
          
          // Update job progress
          job.progress = Math.max(job.progress, Math.round(progress * 100));
          
          if (done) {
            // Job is complete
            completed = true;
            job.progress = 100;
            
            // Get the job result
            const resultResponse = await axios.get(
              `${CONFIG.FOOOCUS_API_URL}/v1/generation/result/${task_id}`
            );
            
            const { imgs, metadata } = resultResponse.data;
            
            if (!imgs || imgs.length === 0) {
              throw new Error("No images generated");
            }
            
            // Create output directory
            const outputDir = await fileManager.createOutputDirectory(job.prompt);
            
            // Process and save each image
            const savedImages = [];
            for (let i = 0; i < imgs.length; i++) {
              const imgData = imgs[i];
              const imgBuffer = Buffer.from(imgData, 'base64');
              
              // Generate filename
              const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
              const filename = `fooocus_${timestamp}_${i}.png`;
              const imagePath = path.join(outputDir, filename);
              
              // Save image
              await writeFileAsync(imagePath, imgBuffer);
              
              // Save metadata
              await fileManager.saveMetadata(outputDir, filename, {
                prompt: job.prompt,
                negative_prompt: job.negative_prompt,
                style: job.style,
                aspect_ratio: job.aspect_ratio,
                seed: metadata?.seed || -1,
                generated_at: new Date().toISOString(),
                task_id: task_id
              });
              
              savedImages.push({
                filename,
                path: imagePath
              });
            }
            
            // Update job with results
            job.status = 'completed';
            job.completedAt = new Date();
            job.result = {
              images: savedImages,
              metadata
            };
          }
        } catch (error) {
          logger.warn(`Error polling job progress: ${error.message}`);
          // Continue polling despite errors
        }
      }
    } catch (error) {
      // Handle job failure
      logger.error(`Job failed: ${error.message}`);
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
    }
    
    // Process next job in queue
    this.processQueue();
  }
  
  // Get job status
  getJobStatus(jobId) {
    const job = this.activeJobs[jobId];
    if (!job) {
      return { error: "Job not found" };
    }
    
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      result: job.result
    };
  }
}

// Initialize job manager
const jobManager = new JobManager(CONFIG.MAX_CONCURRENT_JOBS);

// Start server function
async function startServer() {
  try {
    // Create server
    const server = new McpServer({
      name: "localviz",
      version: "1.0.0"
    });
    
    // Test API tool - tests connection to Fooocus API
    server.tool("test_api", "Test connection to the Fooocus API", async (params) => {
      logger.info("Test API tool called");
      
      try {
        const isRunning = await apiManager.isApiRunning();
        if (isRunning) {
          return {
            content: [
              {
                type: "text",
                text: "✅ Fooocus API is running and accessible."
              }
            ]
          };
        } else {
          // Try to start the API if management is enabled
          if (CONFIG.MANAGE_API) {
            logger.info("API not running, attempting to start...");
            const started = await apiManager.startApi();
            
            if (started) {
              return {
                content: [
                  {
                    type: "text",
                    text: "✅ Fooocus API has been started successfully."
                  }
                ]
              };
            } else {
              return {
                content: [
                  {
                    type: "text",
                    text: "❌ Fooocus API is not running and could not be started automatically. Please check your configuration or start the API manually."
                  }
                ]
              };
            }
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Fooocus API is not running. Please start it manually."
                }
              ]
            };
          }
        }
      } catch (error) {
        logger.error(`Error testing API: ${error.message}`);
        return {
          content: [
            {
              type: "text",
              text: `❌ Error testing API: ${error.message}`
            }
          ]
        };
      }
    });
    
    // Manage API tool - manually start/stop API
    server.tool("manage_api", "Manually start or stop the Fooocus API", async (params) => {
      logger.info(`Manage API tool called with action: ${params.action}`);
      
      try {
        if (params.action === "start") {
          const started = await apiManager.startApi();
          if (started) {
            return {
              content: [
                {
                  type: "text",
                  text: "✅ Fooocus API has been started successfully."
                }
              ]
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Failed to start Fooocus API. Please check logs for details."
                }
              ]
            };
          }
        } else if (params.action === "stop") {
          const stopped = await apiManager.stopApi();
          if (stopped) {
            return {
              content: [
                {
                  type: "text",
                  text: "✅ Fooocus API has been stopped successfully."
                }
              ]
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Failed to stop Fooocus API. Please check logs for details."
                }
              ]
            };
          }
        } else if (params.action === "status") {
          const isRunning = await apiManager.isApiRunning();
          return {
            content: [
              {
                type: "text",
                text: isRunning 
                  ? "✅ Fooocus API is running." 
                  : "❌ Fooocus API is not running."
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: "❌ Invalid action. Please use 'start', 'stop', or 'status'."
              }
            ]
          };
        }
      } catch (error) {
        logger.error(`Error managing API: ${error.message}`);
        return {
          content: [
            {
              type: "text",
              text: `❌ Error managing API: ${error.message}`
            }
          ]
        };
      }
    });
    
    // List styles tool
    server.tool("list_styles", "List all available style presets for image generation", async (params) => {
      logger.info("List styles tool called");
      
      try {
        // Ensure the API is running
        if (!(await apiManager.isApiRunning())) {
          if (CONFIG.MANAGE_API) {
            const started = await apiManager.startApi();
            if (!started) {
              throw new Error("Failed to start Fooocus API");
            }
          } else {
            throw new Error("Fooocus API is not running");
          }
        }
        
        // Update API last use time
        apiManager.updateLastUse();
        
        // Get styles from API
        const response = await axios.get(`${CONFIG.FOOOCUS_API_URL}/v1/generation/styles`);
        const styles = response.data;
        
        if (!styles || !Array.isArray(styles)) {
          throw new Error("Invalid response from API");
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Available styles:\n${styles.join('\n')}`
            }
          ]
        };
      } catch (error) {
        logger.error(`Error listing styles: ${error.message}`);
        return {
          content: [
            {
              type: "text",
              text: `❌ Error listing styles: ${error.message}`
            }
          ]
        };
      }
    });
    
    // List aspect ratios tool
    server.tool("list_aspect_ratios", "List available aspect ratios for image generation", async (params) => {
      logger.info("List aspect ratios tool called");
      
      try {
        // Ensure the API is running
        if (!(await apiManager.isApiRunning())) {
          if (CONFIG.MANAGE_API) {
            const started = await apiManager.startApi();
            if (!started) {
              throw new Error("Failed to start Fooocus API");
            }
          } else {
            throw new Error("Fooocus API is not running");
          }
        }
        
        // Update API last use time
        apiManager.updateLastUse();
        
        // Get aspect ratios from API
        const response = await axios.get(`${CONFIG.FOOOCUS_API_URL}/v1/generation/aspect_ratios`);
        const ratios = response.data;
        
        if (!ratios || !Array.isArray(ratios)) {
          throw new Error("Invalid response from API");
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Available aspect ratios:\n${ratios.join('\n')}`
            }
          ]
        };
      } catch (error) {
        logger.error(`Error listing aspect ratios: ${error.message}`);
        return {
          content: [
            {
              type: "text",
              text: `❌ Error listing aspect ratios: ${error.message}`
            }
          ]
        };
      }
    });
    
    // Generate image tool
    server.tool("generate_image", "Generate an image based on a text description using Fooocus API. Results will be saved locally.", async (params) => {
      logger.info(`Generate image tool called with prompt: "${params.prompt}"`);
      
      try {
        // Create unique job ID
        const jobId = uuidv4();
        
        // Extract parameters
        const jobData = {
          prompt: params.prompt,
          negative_prompt: params.negative_prompt || "",
          style: params.style || "Fooocus V2",
          aspect_ratio: params.aspect_ratio || "1152×896 (Custom)"
        };
        
        // Add job to queue
        jobManager.addJob(jobId, jobData);
        
        // Return initial response with job ID
        return {
          content: [
            {
              type: "text",
              text: `🎨 Image generation started!\n\nCreating image with prompt: "${params.prompt}"\nStyle: ${jobData.style}\n\nThis will take 30-60 seconds. Images will be saved to: ${CONFIG.OUTPUT_DIR}\n\nJob ID: ${jobId}`
            }
          ],
          metadata: {
            job_id: jobId,
            prompt: params.prompt,
            style: jobData.style,
            created: new Date().toISOString()
          }
        };
      } catch (error) {
        logger.error(`Error generating image: ${error.message}`);
        return {
          content: [
            {
              type: "text",
              text: `❌ Error generating image: ${error.message}`
            }
          ]
        };
      }
    });
    
    // Check job status tool
    server.tool("check_job_status", "Check the status of an image generation job", async (params) => {
      logger.info(`Check job status tool called for job ID: ${params.job_id}`);
      
      try {
        const jobStatus = jobManager.getJobStatus(params.job_id);
        
        if (jobStatus.error) {
          return {
            content: [
              {
                type: "text",
                text: `❌ ${jobStatus.error}`
              }
            ]
          };
        }
        
        let statusText = `Job Status: ${jobStatus.status}\n`;
        statusText += `Progress: ${jobStatus.progress}%\n`;
        
        if (jobStatus.status === 'completed') {
          statusText += `\n✅ Job completed successfully!\n`;
          statusText += `Generated ${jobStatus.result.images.length} image(s):\n`;
          
          jobStatus.result.images.forEach(img => {
            statusText += `- ${img.filename}\n`;
          });
        } else if (jobStatus.status === 'failed') {
          statusText += `\n❌ Job failed: ${jobStatus.error}\n`;
        }
        
        return {
          content: [
            {
              type: "text",
              text: statusText
            }
          ],
          metadata: {
            job_id: params.job_id,
            status: jobStatus.status,
            progress: jobStatus.progress,
            created_at: jobStatus.createdAt,
            completed_at: jobStatus.completedAt
          }
        };
      } catch (error) {
        logger.error(`Error checking job status: ${error.message}`);
        return {
          content: [
            {
              type: "text",
              text: `❌ Error checking job status: ${error.message}`
            }
          ]
        };
      }
    });

    // Start MCP server with stdio transport
    const transport = new StdioServerTransport();
    logger.info("Transport initialized, connecting to server...");
    
    try {
      await server.connect(transport);
      logger.info("Server connected successfully");
    } catch (error) {
      logger.error(`Error connecting server: ${error.message}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Failed to start MCP server: ${error.message}`);
    process.exit(1);
  }
}

// Start server
startServer();

// Handle process cleanup
process.on('exit', async () => {
  logger.info("Shutting down server...");
  if (CONFIG.MANAGE_API) {
    await apiManager.stopApi();
  }
});

process.on('SIGINT', () => {
  logger.info("Received SIGINT, shutting down...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info("Received SIGTERM, shutting down...");
  process.exit(0);
});

});
