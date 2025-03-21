import axios from 'axios';
import { JobStatusResponse, TextToImageParams, TextToImageResponse } from '../interfaces/fooocus';
import { execFile, spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

// Set default paths if not specified in environment variables
const FOOOCUS_API_URL = process.env.FOOOCUS_API_URL || 'http://127.0.0.1:8888';
const FOOOCUS_API_PATH = process.env.FOOOCUS_API_PATH || path.resolve(process.cwd(), '../Fooocus-API');
const FOOOCUS_PATH = process.env.FOOOCUS_PATH || path.resolve(process.cwd(), '../Fooocus');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve(process.cwd(), '../New Model Dropbox/James King/Air - JK Work/imageGens');

const apiPort = new URL(FOOOCUS_API_URL).port || '8888';

class FooocusService {
  private apiProcess: ChildProcess | null = null;
  private isApiRunning = false;
  private apiStartingPromise: Promise<void> | null = null;

  constructor() {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  }

  /**
   * Check if the Fooocus API is running
   */
  async isApiUp(): Promise<boolean> {
    try {
      const response = await axios.get(`${FOOOCUS_API_URL}/v1/status`, { timeout: 2000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start the Fooocus API server
   */
  async startApi(): Promise<void> {
    // If API is already running, return immediately
    if (this.isApiRunning) {
      return;
    }

    // If API is in the process of starting, wait for it
    if (this.apiStartingPromise) {
      return this.apiStartingPromise;
    }

    this.apiStartingPromise = new Promise<void>((resolve, reject) => {
      this.killExistingProcesses()
        .then(() => {
          console.log('Starting Fooocus API...');
          
          // Using bash to run the server with proper environment
          this.apiProcess = spawn('bash', ['-c', `
            cd "${FOOOCUS_API_PATH}" && 
            [[ -d venv ]] && source venv/bin/activate;
            python main.py --host 127.0.0.1 --port ${apiPort} --outdir "${OUTPUT_DIR}"
          `], {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          
          if (this.apiProcess.stdout) {
            this.apiProcess.stdout.on('data', (data) => {
              console.log(`Fooocus API: ${data.toString().trim()}`);
            });
          }
          
          if (this.apiProcess.stderr) {
            this.apiProcess.stderr.on('data', (data) => {
              console.error(`Fooocus API Error: ${data.toString().trim()}`);
            });
          }
          
          this.apiProcess.on('error', (error) => {
            console.error(`Failed to start Fooocus API: ${error.message}`);
            this.isApiRunning = false;
            this.apiStartingPromise = null;
            reject(error);
          });
          
          this.apiProcess.on('close', (code) => {
            console.log(`Fooocus API process exited with code ${code}`);
            this.isApiRunning = false;
            this.apiProcess = null;
            this.apiStartingPromise = null;
          });
          
          // Wait for API to be responsive
          this.waitForApi()
            .then(() => {
              this.isApiRunning = true;
              this.apiStartingPromise = null;
              resolve();
            })
            .catch(reject);
        })
        .catch(reject);
    });
    
    return this.apiStartingPromise;
  }

  /**
   * Kill any existing Fooocus processes
   */
  private async killExistingProcesses(): Promise<void> {
    return new Promise<void>((resolve) => {
      const scriptPath = path.join(projectRoot, 'stop_api.sh');
      
      execFile('bash', [scriptPath], (error, stdout, stderr) => {
        if (error) {
          console.error(`Error stopping existing processes: ${error.message}`);
          console.error(stderr);
        } else {
          console.log(stdout);
        }
        // Resolve regardless of errors, we'll continue anyway
        resolve();
      });
    });
  }

  /**
   * Wait for the API to be responsive after starting
   */
  private async waitForApi(maxRetries = 30, interval = 2000): Promise<void> {
    let retries = 0;
    
    while (retries < maxRetries) {
      const isUp = await this.isApiUp();
      
      if (isUp) {
        console.log('Fooocus API is now running!');
        return;
      }
      
      console.log(`Waiting for Fooocus API to start (attempt ${retries + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, interval));
      retries++;
    }
    
    throw new Error('Fooocus API failed to start within the expected time');
  }

  /**
   * Stop the Fooocus API server
   */
  async stopApi(): Promise<void> {
    if (!this.apiProcess) {
      return;
    }
    
    console.log('Stopping Fooocus API...');
    
    try {
      await this.killExistingProcesses();
      
      if (this.apiProcess) {
        // Try to kill the process gracefully
        this.apiProcess.kill();
        
        // Force kill if still running after timeout
        setTimeout(() => {
          if (this.apiProcess) {
            console.log('Force terminating Fooocus API process...');
            this.apiProcess.kill('SIGKILL');
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Error stopping Fooocus API:', error);
    } finally {
      this.isApiRunning = false;
      this.apiProcess = null;
    }
  }

  /**
   * Generate an image from a text prompt
   */
  async generateImage(params: TextToImageParams): Promise<TextToImageResponse> {
    // Ensure API is running
    await this.startApi();
    
    const response = await axios.post(
      `${FOOOCUS_API_URL}/v1/generation/text-to-image`,
      params,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    return response.data;
  }

  /**
   * Check the status of an image generation job
   */
  async checkJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await axios.get(
      `${FOOOCUS_API_URL}/v1/generation/query-job`,
      { params: { job_id: jobId } }
    );
    
    return response.data;
  }
}

export const fooocusService = new FooocusService();
