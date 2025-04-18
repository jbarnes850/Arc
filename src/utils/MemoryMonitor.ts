/**
 * Memory Monitor
 *
 * Monitors memory usage of the extension and provides utilities for memory optimization.
 */

import * as vscode from 'vscode';

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private memoryUsageInterval: NodeJS.Timeout | undefined;
  private memoryWarningThreshold: number = 180; // MB
  private memoryLimitThreshold: number = 200; // MB
  private lastWarningTime: number = 0;
  private warningCooldown: number = 60000; // 1 minute cooldown between warnings
  private isMonitoring: boolean = false;
  private disposables: vscode.Disposable[] = [];

  private constructor(private readonly context: vscode.ExtensionContext) {
    // Register the memory status command
    const memoryStatusCommand = vscode.commands.registerCommand('arc.showMemoryStatus', () => {
      this.showMemoryStatus();
    });

    // Add to disposables
    this.disposables.push(memoryStatusCommand);
    this.context.subscriptions.push(...this.disposables);
  }

  /**
   * Get the singleton instance of MemoryMonitor
   */
  public static getInstance(context: vscode.ExtensionContext): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor(context);
    }
    return MemoryMonitor.instance;
  }

  /**
   * Start monitoring memory usage
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Check memory usage every 30 seconds
    this.memoryUsageInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000);

    // Initial check
    this.checkMemoryUsage();

    console.log('Memory monitoring started');
  }

  /**
   * Stop monitoring memory usage
   */
  public stopMonitoring(): void {
    if (this.memoryUsageInterval) {
      clearInterval(this.memoryUsageInterval);
      this.memoryUsageInterval = undefined;
    }

    this.isMonitoring = false;
    console.log('Memory monitoring stopped');
  }

  /**
   * Check current memory usage
   */
  public checkMemoryUsage(): { heapUsedMB: number, rssUsedMB: number } {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const rssUsedMB = Math.round(memoryUsage.rss / 1024 / 1024);

      // Log memory usage
      console.log(`Memory usage - Heap: ${heapUsedMB} MB, RSS: ${rssUsedMB} MB`);

      // Check if memory usage is above warning threshold
      if (rssUsedMB > this.memoryWarningThreshold) {
        const now = Date.now();

        // Only show warning if cooldown has passed
        if (now - this.lastWarningTime > this.warningCooldown) {
          this.lastWarningTime = now;

          // Show warning
          vscode.window.showWarningMessage(
            `ARC memory usage is high (${rssUsedMB} MB). Consider restarting VS Code if performance degrades.`,
            'Show Details'
          ).then(selection => {
            if (selection === 'Show Details') {
              this.showMemoryStatus();
            }
          });

          // Log telemetry
          this.logTelemetry('memory_warning', {
            heapUsedMB,
            rssUsedMB
          });
        }
      }

      // Check if memory usage is above limit threshold
      if (rssUsedMB > this.memoryLimitThreshold) {
        // Run garbage collection if available
        this.runGarbageCollection();

        // Log telemetry
        this.logTelemetry('memory_limit_exceeded', {
          heapUsedMB,
          rssUsedMB
        });
      }

      return { heapUsedMB, rssUsedMB };
    } catch (error) {
      console.error('Error checking memory usage:', error);
      return { heapUsedMB: 0, rssUsedMB: 0 };
    }
  }

  /**
   * Show memory status in an information message
   */
  public showMemoryStatus(): void {
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const rssUsedMB = Math.round(memoryUsage.rss / 1024 / 1024);
      const externalMB = Math.round(memoryUsage.external / 1024 / 1024);

      vscode.window.showInformationMessage(
        `ARC Memory Usage:\n` +
        `Heap Used: ${heapUsedMB} MB / ${heapTotalMB} MB\n` +
        `RSS: ${rssUsedMB} MB\n` +
        `External: ${externalMB} MB`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get memory status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Run garbage collection if available
   */
  private runGarbageCollection(): void {
    try {
      // Try to run garbage collection if available
      // @ts-ignore - gc might be available in some Node.js environments
      if (typeof global.gc === 'function') {
        console.log('Running garbage collection...');
        // @ts-ignore
        global.gc();
        console.log('Garbage collection completed');
      }
    } catch (error) {
      console.error('Error running garbage collection:', error);
    }
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

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.stopMonitoring();

    // Dispose of all disposables
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
