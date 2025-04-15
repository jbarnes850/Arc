/**
 * Utility functions for the test repository.
 * This file contains standalone utility functions to test the code parsing functionality.
 */

// Use type-only imports for Node.js modules to avoid runtime dependencies
// in a browser environment
type FileSystem = {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
  writeFileSync(path: string, data: string, encoding: string): void;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
};

type Path = {
  dirname(path: string): string;
};

// Mock implementations for browser environment
const fs: FileSystem = {
  existsSync: (path: string) => false,
  readFileSync: (path: string, encoding: string) => '',
  writeFileSync: (path: string, data: string, encoding: string) => {},
  mkdirSync: (path: string, options?: { recursive?: boolean }) => {}
};

const path: Path = {
  dirname: (path: string) => path.split('/').slice(0, -1).join('/')
};

// Try to use Node.js modules if available
try {
  // This will only work in Node.js environment
  // Use dynamic import with type assertion to avoid TypeScript errors
  const nodeFs = (Function('return require("fs")')()) as typeof fs;
  const nodePath = (Function('return require("path")')()) as typeof path;
  
  if (nodeFs && nodePath) {
    Object.assign(fs, nodeFs);
    Object.assign(path, nodePath);
  }
} catch (error) {
  // Running in browser environment, use mock implementations
  console.log('Using mock fs/path implementations for browser environment');
}

import { User, Repository, IUser, IRepository } from './data_model';

/**
 * Load a JSON file and parse its contents
 * @param filePath Path to the JSON file
 * @returns Parsed JSON data
 * @throws Error if the file does not exist or is not valid JSON
 */
export function loadJsonFile(filePath: string): Record<string, any> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

/**
 * Save data to a JSON file
 * @param filePath Path where the JSON file should be saved
 * @param data Data to save
 * @throws Error if the data cannot be serialized to JSON
 */
export function saveJsonFile(filePath: string, data: Record<string, any>): void {
  const directory = path.dirname(filePath);
  if (directory && !fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Format a Unix timestamp as a human-readable date string
 * @param timestamp Unix timestamp (seconds since epoch)
 * @returns Formatted date string (YYYY-MM-DD HH:MM:SS)
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Parse a date string into a Unix timestamp
 * @param dateString Date string in format YYYY-MM-DD HH:MM:SS
 * @returns Unix timestamp (seconds since epoch)
 * @throws Error if the date string is not in the expected format
 */
export function parseTimestamp(dateString: string): number {
  const date = new Date(dateString.replace(' ', 'T') + 'Z');
  return Math.floor(date.getTime() / 1000);
}

/**
 * Load a repository from a JSON file
 * @param filePath Path to the repository JSON file
 * @returns Repository object, or null if the file does not exist
 */
export function loadRepository(filePath: string): Repository | null {
  try {
    const data = loadJsonFile(filePath);
    
    // Load users first
    const users: Record<string, User> = {};
    (data.users || []).forEach((userData: Record<string, any>) => {
      const user = User.fromDict(userData);
      if (user.id) {
        users[user.id] = user;
      }
    });
    
    // Then load the repository
    return Repository.fromDict(data.repository || {}, users);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('File not found')) {
      return null;
    }
    throw error;
  }
}

/**
 * Save a repository to a JSON file
 * @param filePath Path where the repository JSON file should be saved
 * @param repository Repository object to save
 */
export function saveRepository(filePath: string, repository: Repository): void {
  // Collect all users (owner and commit authors)
  const users: Record<string, User> = {};
  if (repository.owner?.id) {
    users[repository.owner.id] = repository.owner;
  }
  
  repository.commits.forEach(commit => {
    if (commit.author?.id) {
      users[commit.author.id] = commit.author;
    }
  });
  
  // Create the data structure
  const data = {
    repository: repository.toDict(),
    users: Object.values(users).map(user => user.toDict())
  };
  
  saveJsonFile(filePath, data);
}

/**
 * Simple logger class for the test repository
 */
export class Logger {
  /**
   * Log an informational message
   * @param message Message to log
   */
  static info(message: string): void {
    console.log(`[INFO] ${message}`);
  }
  
  /**
   * Log a warning message
   * @param message Message to log
   */
  static warning(message: string): void {
    console.warn(`[WARNING] ${message}`);
  }
  
  /**
   * Log an error message
   * @param message Message to log
   */
  static error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }
}

/**
 * Generate a unique identifier
 * @returns A unique string ID
 */
export function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Deep clone an object
 * @param obj Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if two objects are deeply equal
 * @param obj1 First object
 * @param obj2 Second object
 * @returns True if objects are deeply equal
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}
