import * as vscode from 'vscode';
import { BaseWebviewPanel } from './BaseWebviewPanel';
import { IArchitectureDiagramGenerator } from './IArchitectureDiagramGenerator';

/**
 * Panel for displaying the architecture diagram
 */
export class ArchitecturePanel extends BaseWebviewPanel {
  private static readonly viewType = 'arcArchitectureView';
  private static instance: ArchitecturePanel | undefined;
  private currentRepoId: string | undefined;

  /**
   * Get the singleton instance of the architecture panel
   */
  public static getInstance(
    context: vscode.ExtensionContext,
    diagramGenerator: IArchitectureDiagramGenerator
  ): ArchitecturePanel {
    if (!ArchitecturePanel.instance) {
      ArchitecturePanel.instance = new ArchitecturePanel(context, diagramGenerator);
    }
    return ArchitecturePanel.instance;
  }

  private constructor(
    context: vscode.ExtensionContext,
    private diagramGenerator: IArchitectureDiagramGenerator
  ) {
    super(context);
  }

  /**
   * Show the architecture panel
   */
  public show(): void {
    this.createPanel(
      ArchitecturePanel.viewType,
      'ARC: Architecture',
      vscode.ViewColumn.Beside
    );

    // Set up message handling
    if (this.panel) {
      this.panel.webview.onDidReceiveMessage(
        message => this.handleMessage(message),
        undefined,
        this.context.subscriptions
      );
    }
  }

  /**
   * Handle messages from the webview
   * @param message Message from the webview
   */
  private handleMessage(message: any): void {
    switch (message.command) {
      case 'createDecision':
        vscode.commands.executeCommand('arc.createDecisionRecord');
        break;
      case 'viewContext':
        vscode.commands.executeCommand('arc.showContextPanel');
        break;
      case 'timelinePreviewOptin':
        // Log telemetry for timeline preview opt-in
        this.logTelemetry('timeline_preview_optin', { enabled: message.enabled });
        break;
      case 'refresh':
        if (this.currentRepoId) {
          this.updateDiagram(this.currentRepoId, 'Repository');
        }
        break;
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
   * Update the architecture diagram for a repository
   * @param repoId Repository ID
   * @param repoName Repository name
   */
  public async updateDiagram(repoId: string, repoName: string): Promise<void> {
    if (!this.panel) {
      this.show();
    }

    this.currentRepoId = repoId;

    try {
      // Start timing for performance measurement
      const startTime = Date.now();

      // Show loading state first
      if (this.panel) {
        this.panel.webview.html = this.getLoadingHtml(repoName);
      }

      // Generate the diagram asynchronously
      setTimeout(async () => {
        try {
          // Generate the diagram
          const diagramHtml = await this.diagramGenerator.generateDiagram(repoId);

          // Update the webview content
          if (this.panel) {
            this.panel.webview.html = this.getHtmlForDiagram(repoName, diagramHtml);
          }

          // Log telemetry for total load time
          const totalTime = Date.now() - startTime;
          this.logTelemetry('architecture_load_complete', {
            repoId,
            totalTime,
            success: true
          });
        } catch (error) {
          if (this.panel) {
            this.panel.webview.html = this.getErrorHtml(
              `Failed to generate diagram: ${error instanceof Error ? error.message : String(error)}`
            );
          }

          // Log telemetry for error
          this.logTelemetry('architecture_load_complete', {
            repoId,
            totalTime: Date.now() - startTime,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }, 10); // Small delay to allow the loading state to render
    } catch (error) {
      if (this.panel) {
        this.panel.webview.html = this.getErrorHtml(
          `Failed to generate diagram: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Get HTML content for the loading state
   * @param repoName Repository name
   */
  private getLoadingHtml(repoName: string): string {
    if (!this.panel) {
      return '';
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        ${this.getCommonHeadHtml(this.panel.webview)}
        <title>ARC Architecture</title>
        <style>
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 300px;
          }
          .loading-spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 4px solid #3498db;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Architecture: ${repoName}</h1>
            <p class="subtitle">Generating architecture diagram...</p>
          </div>

          <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>Analyzing code structure and relationships...</p>
            <p><small>This will only take a moment</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get the initial HTML content for the webview
   */
  protected getInitialHtml(): string {
    if (!this.panel) {
      return '';
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        ${this.getCommonHeadHtml(this.panel.webview)}
        <title>ARC Architecture</title>
      </head>
      <body>
        <div class="container">
          <h1>ARC Architecture</h1>
          <p>Select a repository to view its architecture diagram.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get the HTML for the architecture diagram
   * @param repoName Repository name
   * @param diagramHtml HTML for the diagram
   */
  protected getHtmlForDiagram(repoName: string, diagramHtml: string): string {
    if (!this.panel) {
      return '';
    }

    // Start timing for performance measurement
    const startTime = Date.now();

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        ${this.getCommonHeadHtml(this.panel.webview)}
        <title>ARC Architecture</title>
        <style>
          .diagram-legend {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background-color: #f9f9f9;
          }
          .legend-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .legend-items {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
          }
          .legend-item {
            display: flex;
            align-items: center;
            font-size: 12px;
          }
          .legend-icon {
            margin-right: 4px;
          }
          .toggle-container {
            display: flex;
            align-items: center;
            margin-top: 20px;
            padding: 10px;
            border: 1px dashed #ccc;
            border-radius: 4px;
            background-color: #f0f0f0;
          }
          .toggle-label {
            margin-left: 8px;
            font-size: 14px;
          }
          .experimental-badge {
            font-size: 10px;
            background-color: #ff9800;
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
            margin-left: 8px;
          }
          .loading-indicator {
            display: none;
            margin-top: 20px;
            text-align: center;
            font-style: italic;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Architecture: ${repoName}</h1>
            <p class="subtitle">This diagram is automatically generated from your codebase structure and relationships.</p>
          </div>

          <div class="diagram-container">
            ${diagramHtml}
          </div>

          <div class="diagram-legend">
            <div class="legend-title">Legend</div>
            <div class="legend-items">
              <div class="legend-item"><span class="legend-icon">📄</span> File</div>
              <div class="legend-item"><span class="legend-icon">🧩</span> Class</div>
              <div class="legend-item"><span class="legend-icon">⚙️</span> Function</div>
              <div class="legend-item"><span class="legend-icon">📦</span> Module</div>
              <div class="legend-item"><span class="legend-icon">✏️</span> Has Decision Records</div>
            </div>
            <div class="legend-items" style="margin-top: 8px;">
              <div class="legend-item">→ Contains</div>
              <div class="legend-item">⇒ Extends</div>
              <div class="legend-item">--→ Uses</div>
            </div>
          </div>

          <div class="toggle-container">
            <input type="checkbox" id="timeline-toggle" />
            <label for="timeline-toggle" class="toggle-label">
              Enable timeline preview
              <span class="experimental-badge">experimental</span>
            </label>
            <div id="loading-indicator" class="loading-indicator">Loading timeline data...</div>
          </div>

          <div class="next-steps">
            <h2>What's Next?</h2>
            <div class="card-container">
              <div class="card" onclick="vscode.postMessage({command: 'createDecision'})">
                <h3>📝 Document a Decision</h3>
                <p>Capture architectural decisions and link them to specific code elements.</p>
                <button>Create Decision Record</button>
              </div>
              <div class="card" onclick="vscode.postMessage({command: 'viewContext'})">
                <h3>🔍 View Code Context</h3>
                <p>Open a file to see its commit history and linked decisions.</p>
                <button>Open Context Panel</button>
              </div>
            </div>
          </div>
        </div>

        <script>
          // Handle button clicks
          document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
              const card = e.target.closest('.card');
              if (card) {
                const command = card.getAttribute('onclick').match(/command: '(.+?)'/)[1];
                vscode.postMessage({command});
              }
            }
          });

          // Handle timeline toggle
          const timelineToggle = document.getElementById('timeline-toggle');
          const loadingIndicator = document.getElementById('loading-indicator');

          timelineToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            vscode.postMessage({command: 'timelinePreviewOptin', enabled});

            if (enabled) {
              loadingIndicator.style.display = 'block';
              // In a real implementation, we would load the timeline data here
              setTimeout(() => {
                loadingIndicator.style.display = 'none';
                // For now, just show a message
                alert('Timeline preview will be available in a future update.');
                timelineToggle.checked = false;
              }, 1500);
            }
          });

          // Log performance metrics
          window.addEventListener('load', () => {
            const loadTime = Date.now() - ${startTime};
            vscode.postMessage({command: 'logPerformance', loadTime});
          });
        </script>
      </body>
      </html>
    `;

    // Log telemetry for diagram load time
    this.logTelemetry('diagram_load', {
      repoId: this.currentRepoId,
      generationTime: Date.now() - startTime
    });

    return html;
  }

  /**
   * Get HTML content for displaying an error
   * @param errorMessage Error message
   */
  private getErrorHtml(errorMessage: string): string {
    if (!this.panel) {
      return '';
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        ${this.getCommonHeadHtml(this.panel.webview)}
        <title>ARC Architecture</title>
      </head>
      <body>
        <div class="container">
          <h1>Error</h1>
          <div class="error-message">
            ${errorMessage}
          </div>
          <button onclick="refresh()">Retry</button>
        </div>
        <script>
          function refresh() {
            vscode.postMessage({ command: 'refresh' });
          }
        </script>
      </body>
      </html>
    `;
  }
}
