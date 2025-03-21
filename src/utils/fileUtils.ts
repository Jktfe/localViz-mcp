import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

// Output directory from environment variable
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/Users/jamesking/New Model Dropbox/James King/Air - JK Work/imageGens';

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
