/**
 * ARC Index Progress Provider
 * 
 * Provides status bar progress updates during repository indexing.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class IndexProgressProvider {
  private static instance: IndexProgressProvider;
  private statusBarItem: vscode.StatusBarItem;
  private progressInterval: NodeJS.Timeout | undefined;
  private startTime: number = 0;
  private indexedFiles: number = 0;
  private totalFiles: number = 0;
  private repoId: string = '';
  private repoPath: string = '';

  private constructor(private readonly context: vscode.ExtensionContext) {
    // Create the status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.text = 'ARC: Ready';
    this.statusBarItem.tooltip = 'ARC Knowledge Graph';
    this.statusBarItem.command = 'arc.showArchitecturePanel';
    
    // Add to subscriptions
    this.context.subscriptions.push(this.statusBarItem);
  }

  /**
   * Get the singleton instance of IndexProgressProvider
   */
  public static getInstance(context: vscode.ExtensionContext): IndexProgressProvider {
    if (!IndexProgressProvider.instance) {
      IndexProgressProvider.instance = new IndexProgressProvider(context);
    }
    return IndexProgressProvider.instance;
  }

  /**
   * Start tracking indexing progress
   */
  public startIndexing(repoId: string, repoPath: string): void {
    // Set properties
    this.repoId = repoId;
    this.repoPath = repoPath;
    this.startTime = Date.now();
    this.indexedFiles = 0;
    
    // Count total files
    this.countFiles(repoPath).then(count => {
      this.totalFiles = count;
      
      // Show the status bar item
      this.statusBarItem.text = 'ARC: Indexing...';
      this.statusBarItem.show();
      
      // Start the progress interval
      this.progressInterval = setInterval(() => {
        this.updateProgress();
      }, 2000); // Update every 2 seconds
    });
  }

  /**
   * Update the indexing progress
   */
  public updateProgress(filesIndexed?: number): void {
    if (filesIndexed !== undefined) {
      this.indexedFiles = filesIndexed;
    } else {
      // Simulate progress for now
      // In a real implementation, we would get the actual progress from the indexing service
      this.indexedFiles = Math.min(this.indexedFiles + Math.floor(this.totalFiles * 0.1), this.totalFiles);
    }
    
    // Calculate progress percentage
    const progress = this.totalFiles > 0 ? Math.floor((this.indexedFiles / this.totalFiles) * 100) : 0;
    
    // Calculate elapsed time
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    
    // Update the status bar item
    this.statusBarItem.text = `ARC: Indexing ${progress}% (${this.indexedFiles}/${this.totalFiles})`;
    this.statusBarItem.tooltip = `Elapsed time: ${elapsed}s`;
  }

  /**
   * Complete the indexing process
   */
  public completeIndexing(success: boolean, loc: number): void {
    // Clear the progress interval
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = undefined;
    }
    
    // Calculate elapsed time
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    
    if (success) {
      // Update the status bar item
      this.statusBarItem.text = 'ARC: Ready';
      this.statusBarItem.tooltip = `Indexed ${loc} lines in ${elapsed}s`;
      
      // Show success toast
      vscode.window.showInformationMessage(
        `Indexed ${loc} lines in ${elapsed}s — View overview`,
        'View overview'
      ).then(selection => {
        if (selection === 'View overview') {
          vscode.commands.executeCommand('arc.showArchitecturePanel');
        }
      });
      
      // Log telemetry
      this.logTelemetry('index_complete', {
        repo_id: this.repoId,
        loc,
        duration_ms: elapsed * 1000
      });
    } else {
      // Update the status bar item
      this.statusBarItem.text = 'ARC: Error';
      this.statusBarItem.tooltip = 'Indexing failed';
      
      // Show error toast
      vscode.window.showErrorMessage('Failed to index repository. See output for details.');
    }
  }

  /**
   * Count the number of files in a directory recursively
   */
  private async countFiles(dirPath: string): Promise<number> {
    try {
      let count = 0;
      
      // Read the directory
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip node_modules and .git directories
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            count += await this.countFiles(fullPath);
          }
        } else {
          // Only count source code files
          const ext = path.extname(entry.name).toLowerCase();
          if (['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rb', '.php'].includes(ext)) {
            count++;
          }
        }
      }
      
      return count;
    } catch (error) {
      console.error('Error counting files:', error);
      return 0;
    }
  }

  /**
   * Show the status bar item
   */
  public show(): void {
    this.statusBarItem.show();
  }

  /**
   * Hide the status bar item
   */
  public hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Log telemetry events
   */
  private logTelemetry(eventName: string, properties: any): void {
    // Check if telemetry is enabled
    const config = vscode.workspace.getConfiguration('arc');
    const telemetryEnabled = config.get<boolean>('telemetry', true);
    
    if (telemetryEnabled) {
      // In a real implementation, we would send telemetry to a service
      console.log(`Telemetry: ${eventName}`, properties);
    }
  }
}
