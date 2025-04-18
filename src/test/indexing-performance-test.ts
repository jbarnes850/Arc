/**
 * ARC Indexing Performance Test
 * 
 * This test script exercises the indexing functionality and logs performance metrics.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { SQLitePersistenceService } from '../persistence/SQLitePersistenceService';
import { GitHubIntegrationService } from '../integration/GitHubIntegrationService';
import { CodeParserService } from '../indexing/CodeParserService';
import { Repository } from '../models/types';

// Create a mock progress provider
class MockProgressProvider {
  private startTime: number = Date.now();
  private currentStage: string = 'Initializing';

  public startIndexing(repoId: string, repoPath: string): void {
    this.startTime = Date.now();
    console.log(`Starting indexing for repository ${repoId} at ${repoPath}`);
  }

  public updateProgress(progress: number): void {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    console.log(`Progress: ${progress}% (${this.formatTime(elapsed)} elapsed)`);
  }

  public updateStage(stage: string): void {
    this.currentStage = stage;
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    console.log(`Stage: ${stage} (${this.formatTime(elapsed)} elapsed)`);
  }

  public completeIndexing(success: boolean, loc: number): void {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    if (success) {
      console.log(`Indexing completed successfully. ${loc} lines indexed in ${this.formatTime(elapsed)}`);
    } else {
      console.log(`Indexing failed after ${this.formatTime(elapsed)}`);
    }
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }
}

// Create a mock memory monitor
class MockMemoryMonitor {
  public checkMemoryUsage(): { heapUsedMB: number, rssUsedMB: number } {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const rssUsedMB = Math.round(memoryUsage.rss / 1024 / 1024);
    const externalMB = Math.round(memoryUsage.external / 1024 / 1024);
    
    console.log(`Memory usage - Heap: ${heapUsedMB} MB, RSS: ${rssUsedMB} MB, External: ${externalMB} MB`);
    
    return { heapUsedMB, rssUsedMB };
  }
}

/**
 * Count the lines of code in a repository
 */
async function countLinesOfCode(repoPath: string): Promise<number> {
  try {
    // Use a simple algorithm to count lines of code
    let totalLines = 0;

    // Function to recursively count lines in a directory
    const countLinesInDir = async (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip node_modules and .git directories
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            await countLinesInDir(fullPath);
          }
        } else {
          // Only count source code files
          const ext = path.extname(entry.name).toLowerCase();
          if (['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rb', '.php'].includes(ext)) {
            // Read the file and count lines
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n').length;
            totalLines += lines;
          }
        }
      }
    };

    // Start counting
    await countLinesInDir(repoPath);

    return totalLines;
  } catch (error) {
    console.error('Error counting lines of code:', error);
    return 0;
  }
}

/**
 * Run the indexing performance test
 */
async function runIndexingTest() {
  console.log('Starting ARC Indexing Performance Test');
  
  try {
    // Set up global objects for services to use
    (global as any).indexProgressProvider = new MockProgressProvider();
    (global as any).memoryMonitor = new MockMemoryMonitor();
    
    // Log initial memory usage
    (global as any).memoryMonitor.checkMemoryUsage();
    
    // Create a temporary database file
    const dbPath = path.join(__dirname, '..', '..', 'test', 'temp-test.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    
    // Initialize services
    console.log('Initializing services...');
    const persistenceService = new SQLitePersistenceService(dbPath);
    (global as any).persistenceService = persistenceService;
    
    // Initialize the database
    console.log('Initializing database...');
    await persistenceService.initializeDatabase();
    
    // Create services
    const codeParserService = new CodeParserService();
    const gitService = new GitHubIntegrationService(persistenceService);
    
    // Get the test repository path
    const repoPath = path.join(__dirname, '..', '..', 'test', 'testRepo');
    console.log(`Using test repository at: ${repoPath}`);
    
    // Generate a repository ID
    const repoId = crypto.createHash('sha256').update(repoPath).digest('hex').substring(0, 16);
    
    // Save the repository
    const repository: Repository = {
      repoId,
      path: repoPath,
      name: 'Test Repository'
    };
    
    await persistenceService.saveRepository(repository);
    
    // Start the indexing progress
    (global as any).indexProgressProvider.startIndexing(repoId, repoPath);
    
    // Log memory usage before indexing
    console.log('Memory usage before indexing:');
    (global as any).memoryMonitor.checkMemoryUsage();
    
    try {
      // Initialize the parser for TypeScript
      await codeParserService.initializeParser('typescript');
      
      // Index the repository
      console.log('Starting repository indexing...');
      const startTime = Date.now();
      
      await gitService.indexCommitHistory(repoPath, repoId);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      console.log(`Repository indexing completed in ${duration.toFixed(2)} seconds`);
      
      // Log memory usage after indexing
      console.log('Memory usage after indexing:');
      (global as any).memoryMonitor.checkMemoryUsage();
      
      // Count lines of code
      const loc = await countLinesOfCode(repoPath);
      
      // Complete the indexing
      (global as any).indexProgressProvider.completeIndexing(true, loc);
      
      // Get counts
      const elementCount = await persistenceService.getCodeElementCount(repoId);
      const commitCount = await persistenceService.getCommitCount(repoId);
      const decisionCount = await persistenceService.getDecisionCount(repoId);
      
      console.log(`Repository statistics:
- Code elements: ${elementCount}
- Commits: ${commitCount}
- Decisions: ${decisionCount}
- Lines of code: ${loc}
`);
      
      // Close the database connection
      await persistenceService.closeConnection();
      
      // Clean up the temporary database file
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      
      console.log('Test completed successfully');
    } catch (error) {
      console.error('Error during indexing:', error);
      (global as any).indexProgressProvider.completeIndexing(false, 0);
      
      // Close the database connection
      await persistenceService.closeConnection();
      
      // Clean up the temporary database file
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
runIndexingTest().catch(error => {
  console.error('Unhandled error in test:', error);
});
