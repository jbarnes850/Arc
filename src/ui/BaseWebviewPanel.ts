import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Base class for webview panels
 */
export abstract class BaseWebviewPanel {
  protected panel: vscode.WebviewPanel | undefined;
  protected extensionUri: vscode.Uri;

  constructor(protected context: vscode.ExtensionContext) {
    this.extensionUri = context.extensionUri;
  }

  /**
   * Create and show the webview panel
   * @param viewType Unique identifier for the webview
   * @param title Title of the panel
   * @param viewColumn Column to show the panel in
   */
  protected createPanel(viewType: string, title: string, viewColumn: vscode.ViewColumn): void {
    // If the panel already exists, reveal it
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    // Create a new panel
    this.panel = vscode.window.createWebviewPanel(
      viewType,
      title,
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri]
      }
    );

    // Set the webview's initial html content
    this.panel.webview.html = this.getInitialHtml();

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  /**
   * Get the initial HTML content for the webview
   */
  protected abstract getInitialHtml(): string;

  /**
   * Get a URI for a resource in the extension
   * @param webview Webview to get the URI for
   * @param ...pathSegments Path segments to the resource
   */
  protected getResourceUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
    return webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, ...pathSegments)
    );
  }

  /**
   * Get common HTML head content
   */
  protected getCommonHeadHtml(webview: vscode.Webview): string {
    // Use the VS Code API script
    const vscodeApiScript = `<script>
      const vscode = acquireVsCodeApi();
    </script>`;

    // Use a common CSS file
    const styleUri = this.getResourceUri(webview, 'resources', 'styles.css');
    const stylesheetTag = `<link rel="stylesheet" href="${styleUri}">`;

    return `
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${vscodeApiScript}
      ${stylesheetTag}
    `;
  }
}
