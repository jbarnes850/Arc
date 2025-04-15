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
      // Generate the diagram
      const diagramHtml = await this.diagramGenerator.generateDiagram(repoId);
      
      // Update the webview content
      if (this.panel) {
        this.panel.webview.html = this.getHtmlForDiagram(repoName, diagramHtml);
      }
    } catch (error) {
      if (this.panel) {
        this.panel.webview.html = this.getErrorHtml(
          `Failed to generate diagram: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
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

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        ${this.getCommonHeadHtml(this.panel.webview)}
        <title>ARC Architecture</title>
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
        </script>
      </body>
      </html>
    `;
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
