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
   * Get HTML content for displaying the architecture diagram
   * @param repoName Repository name
   * @param diagramHtml HTML for the diagram
   */
  private getHtmlForDiagram(repoName: string, diagramHtml: string): string {
    if (!this.panel) {
      return '';
    }

    // Load Mermaid.js from a CDN
    // In a real implementation, we would bundle Mermaid.js with the extension
    const mermaidScript = `<script src="https://cdn.jsdelivr.net/npm/mermaid@9/dist/mermaid.min.js"></script>`;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        ${this.getCommonHeadHtml(this.panel.webview)}
        ${mermaidScript}
        <title>ARC Architecture</title>
        <style>
          .diagram-container {
            background-color: #f5f5f5;
            padding: 20px;
            border-radius: 5px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Architecture Diagram: ${repoName}</h1>
          <p>This diagram shows the high-level structure of the codebase.</p>
          
          <div class="diagram-container">
            ${diagramHtml}
          </div>
          
          <div class="legend">
            <h3>Legend</h3>
            <ul>
              <li><span class="file-node">[[File]]</span> - Source file</li>
              <li><span class="class-node">{{Class}}</span> - Class definition</li>
              <li><span class="solid-edge">→</span> - Contains relationship</li>
              <li><span class="dashed-edge">⇢</span> - Other relationship</li>
            </ul>
          </div>
        </div>
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
