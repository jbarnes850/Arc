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
  private currentStage: string = 'Initializing';

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
  public updateProgress(progress?: number): void {
    if (progress !== undefined) {
      // Use the provided progress percentage directly
      this.indexedFiles = Math.floor((progress / 100) * this.totalFiles);
    } else {
      // Simulate progress for now
      // In a real implementation, we would get the actual progress from the indexing service
      this.indexedFiles = Math.min(this.indexedFiles + Math.floor(this.totalFiles * 0.1), this.totalFiles);
      progress = this.totalFiles > 0 ? Math.floor((this.indexedFiles / this.totalFiles) * 100) : 0;
    }

    // Calculate elapsed time
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const elapsedStr = this.formatTime(elapsed);

    // Update the status bar item
    this.statusBarItem.text = `ARC: Indexing ${progress}%`;
    this.statusBarItem.tooltip = `Stage: ${this.currentStage}\nElapsed time: ${elapsedStr}`;
  }

  /**
   * Update the current stage of indexing
   */
  public updateStage(stage: string): void {
    this.currentStage = stage;

    // Calculate elapsed time
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const elapsedStr = this.formatTime(elapsed);

    // Update tooltip with new stage
    this.statusBarItem.tooltip = `Stage: ${this.currentStage}\nElapsed time: ${elapsedStr}`;

    // Log stage change
    console.log(`Indexing stage: ${stage} (${elapsedStr} elapsed)`);
  }

  /**
   * Format time in seconds to a human-readable string
   */
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
    const elapsedStr = this.formatTime(elapsed);

    if (success) {
      // Update the final stage
      this.updateStage('Indexing complete');

      // Update the status bar item
      this.statusBarItem.text = 'ARC: Ready';
      this.statusBarItem.tooltip = `Indexed ${loc} lines in ${elapsedStr}`;

      // Show success toast with more detailed information
      vscode.window.showInformationMessage(
        `Indexed ${loc} lines in ${elapsedStr} — View overview`,
        'View overview'
      ).then(selection => {
        if (selection === 'View overview') {
          vscode.commands.executeCommand('arc.showArchitecturePanel');
        }
      });

      // Log telemetry with more detailed information
      this.logTelemetry('index_complete', {
        repo_id: this.repoId,
        loc,
        duration_ms: elapsed * 1000,
        final_stage: this.currentStage
      });
    } else {
      // Update the final stage
      this.updateStage('Indexing failed');

      // Update the status bar item
      this.statusBarItem.text = 'ARC: Error';
      this.statusBarItem.tooltip = `Indexing failed after ${elapsedStr}`;

      // Show error toast with more information
      vscode.window.showErrorMessage(
        `Failed to index repository after ${elapsedStr}. See output for details.`,
        'Try Again'
      ).then(selection => {
        if (selection === 'Try Again') {
          vscode.commands.executeCommand('arc.indexRepository');
        }
      });

      // Log telemetry for failure
      this.logTelemetry('index_failed', {
        repo_id: this.repoId,
        duration_ms: elapsed * 1000,
        final_stage: this.currentStage
      });
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
