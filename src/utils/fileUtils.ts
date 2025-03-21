import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

// Output directory from environment variable
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(projectRoot, 'outputs');

/**
 * Ensures the output directory exists, creating it if necessary
 */
export function ensureOutputDirExists(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }
}

/**
 * Get path to local resources
 */
export function getResourcePath(relativePath: string): string {
  return path.join(projectRoot, relativePath);
}

/**
 * Get full path to the output directory for generated images
 */
export function getOutputDir(): string {
  return OUTPUT_DIR;
}

/**
 * Check if a file exists at the provided path
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Create directory if it doesn't exist
 */
export function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get a list of image files in the output directory
 * @param limit Maximum number of files to return
 * @param sortBy Sort order ('newest' or 'oldest')
 * @returns Array of image file objects with path and stats
 */
export function getRecentImages(limit = 20, sortBy = 'newest'): Array<{path: string, url: string, stats: fs.Stats}> {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return [];
    }
    
    // Read all files in the output directory
    const files = fs.readdirSync(OUTPUT_DIR);
    
    // Filter for image files only (png, jpg, jpeg, webp)
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
    });
    
    // Get stats for each file for sorting by date
    const imageFilesWithStats = imageFiles.map(file => {
      const filePath = path.join(OUTPUT_DIR, file);
      const stats = fs.statSync(filePath);
      // Create a URL that can be accessed by the client
      const url = `file://${filePath}`;
      return { path: filePath, url, stats };
    });
    
    // Sort by modification time (newest or oldest first)
    imageFilesWithStats.sort((a, b) => {
      if (sortBy === 'newest') {
        return b.stats.mtimeMs - a.stats.mtimeMs;
      }
      return a.stats.mtimeMs - b.stats.mtimeMs;
    });
    
    // Limit the number of results
    return imageFilesWithStats.slice(0, limit);
  } catch (error) {
    console.error('Error getting recent images:', error);
    return [];
  }
}

/**
 * Create a JSON file with generation metadata
 * @param filename Base filename for the image
 * @param metadata Generation metadata
 */
export function saveImageMetadata(filename: string, metadata: any): void {
  try {
    const metaFilePath = path.join(OUTPUT_DIR, `${path.basename(filename, path.extname(filename))}.json`);
    fs.writeFileSync(metaFilePath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('Error saving image metadata:', error);
  }
}

/**
 * Get metadata for a specific image
 * @param imagePath Path to the image file
 * @returns Metadata object or null if not found
 */
export function getImageMetadata(imagePath: string): any {
  try {
    const metaFilePath = path.join(
      path.dirname(imagePath),
      `${path.basename(imagePath, path.extname(imagePath))}.json`
    );
    
    if (fs.existsSync(metaFilePath)) {
      const data = fs.readFileSync(metaFilePath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Error reading image metadata:', error);
    return null;
  }
}

/**
 * Open the output directory in the default file explorer
 * @returns Success message or error
 */
export function openOutputDirectory(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Make sure the directory exists
    ensureOutputDirExists();
    
    // Determine the command based on the platform
    let command: string;
    let args: string[] = [];
    
    switch (process.platform) {
      case 'darwin': // macOS
        command = 'open';
        args = [OUTPUT_DIR];
        break;
      case 'win32': // Windows
        command = 'explorer';
        args = [OUTPUT_DIR.replace(/\//g, '\\')]; // Convert to Windows path format
        break;
      case 'linux': // Linux
        command = 'xdg-open';
        args = [OUTPUT_DIR];
        break;
      default:
        return reject(`Platform ${process.platform} not supported for opening directories`);
    }
    
    // Execute the command
    const { spawn } = require('child_process');
    const process = spawn(command, args);
    
    process.on('error', (error: Error) => {
      console.error('Error opening output directory:', error);
      reject(`Failed to open directory: ${error.message}`);
    });
    
    process.on('close', (code: number) => {
      if (code === 0) {
        resolve(`Successfully opened output directory: ${OUTPUT_DIR}`);
      } else {
        reject(`Failed to open directory, exit code: ${code}`);
      }
    });
  });
}
