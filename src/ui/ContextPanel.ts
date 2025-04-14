import * as vscode from 'vscode';
import { BaseWebviewPanel } from './BaseWebviewPanel';
import { IKnowledgeGraphService } from '../services/IKnowledgeGraphService';
import { Commit, DecisionRecord, CodeElement, CodeElementVersion } from '../models/types';

/**
 * Panel for displaying context (commit history and linked decisions)
 */
export class ContextPanel extends BaseWebviewPanel {
  private static readonly viewType = 'arcContextView';
  private static instance: ContextPanel | undefined;
  private currentVersion: CodeElementVersion | undefined;

  /**
   * Get the singleton instance of the context panel
   */
  public static getInstance(
    context: vscode.ExtensionContext,
    knowledgeGraphService: IKnowledgeGraphService
  ): ContextPanel {
    if (!ContextPanel.instance) {
      ContextPanel.instance = new ContextPanel(context, knowledgeGraphService);
    }
    return ContextPanel.instance;
  }

  private constructor(
    context: vscode.ExtensionContext,
    private knowledgeGraphService: IKnowledgeGraphService
  ) {
    super(context);
  }

  /**
   * Show the context panel
   */
  public show(): void {
    this.createPanel(
      ContextPanel.viewType,
      'ARC: Context',
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
   * Update the context panel with information about a code element
   * @param element Code element to show context for
   */
  public async updateContext(element: CodeElement): Promise<void> {
    if (!this.panel) {
      this.show();
    }

    // Get the latest version of the element
    this.currentVersion = await this.knowledgeGraphService.getLatestElementVersion(element.elementId) || undefined;

    // Get commit history for the element
    const commits = await this.knowledgeGraphService.getElementCommitHistory(element.elementId, 10);

    // Get linked decisions if we have a current version
    let decisions: DecisionRecord[] = [];
    if (this.currentVersion) {
      decisions = await this.knowledgeGraphService.getLinkedDecisions(this.currentVersion.versionId);
    }

    // Update the webview content
    if (this.panel) {
      this.panel.webview.html = this.getHtmlForContext(element, commits, decisions);
    }
  }

  /**
   * Handle messages from the webview
   * @param message Message from the webview
   */
  private handleMessage(message: any): void {
    switch (message.command) {
      case 'openDecision':
        // Open the decision record in a new editor
        vscode.commands.executeCommand('arc.openDecisionRecord', message.decisionId);
        break;
      case 'linkDecision':
        // Link the current element to a decision
        if (this.currentVersion) {
          vscode.commands.executeCommand('arc.linkDecisionToCode', this.currentVersion.versionId);
        }
        break;
      case 'createDecision':
        // Create a new decision record
        vscode.commands.executeCommand('arc.createDecisionRecord');
        break;
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
        <title>ARC Context</title>
      </head>
      <body>
        <div class="container">
          <h1>ARC Context</h1>
          <p>Select a code element in the editor to view its context.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get HTML content for displaying context
   * @param element Code element
   * @param commits Commit history
   * @param decisions Linked decisions
   */
  private getHtmlForContext(
    element: CodeElement,
    commits: Commit[],
    decisions: DecisionRecord[]
  ): string {
    if (!this.panel) {
      return '';
    }

    const commitsHtml = this.getCommitsHtml(commits);
    const decisionsHtml = this.getDecisionsHtml(decisions);

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        ${this.getCommonHeadHtml(this.panel.webview)}
        <title>ARC Context</title>
      </head>
      <body>
        <div class="container">
          <h1>Context for ${this.formatStableIdentifier(element.stableIdentifier)}</h1>
          
          <div class="section">
            <h2>Commit History</h2>
            ${commitsHtml}
          </div>
          
          <div class="section">
            <h2>Linked Decisions</h2>
            ${decisionsHtml}
            <div class="actions">
              <button class="action-button" onclick="createDecision()">Create Decision</button>
              ${this.currentVersion ? '<button class="action-button" onclick="linkDecision()">Link Existing Decision</button>' : ''}
            </div>
          </div>
        </div>
        
        <script>
          function openDecision(decisionId) {
            vscode.postMessage({
              command: 'openDecision',
              decisionId: decisionId
            });
          }
          
          function linkDecision() {
            vscode.postMessage({
              command: 'linkDecision'
            });
          }
          
          function createDecision() {
            vscode.postMessage({
              command: 'createDecision'
            });
          }
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Get HTML for displaying commit history
   * @param commits Commits to display
   */
  private getCommitsHtml(commits: Commit[]): string {
    if (commits.length === 0) {
      return '<p>No commit history available.</p>';
    }

    return `
      <div class="commits-list">
        ${commits.map(commit => `
          <div class="commit-item">
            <div class="commit-hash">${commit.commitHash.substring(0, 7)}</div>
            <div class="commit-message">${this.escapeHtml(commit.message)}</div>
            <div class="commit-date">${new Date(commit.timestamp).toLocaleString()}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Get HTML for displaying linked decisions
   * @param decisions Decisions to display
   */
  private getDecisionsHtml(decisions: DecisionRecord[]): string {
    if (decisions.length === 0) {
      return '<p>No decisions linked to this code element.</p>';
    }

    return `
      <div class="decisions-list">
        ${decisions.map(decision => `
          <div class="decision-item" onclick="openDecision('${decision.decisionId}')">
            <div class="decision-title">${this.escapeHtml(decision.title)}</div>
            <div class="decision-date">${new Date(decision.createdAt).toLocaleString()}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Format a stable identifier for display
   * @param identifier Stable identifier
   */
  private formatStableIdentifier(identifier: string): string {
    // Split the identifier into parts
    const parts = identifier.split(':');
    
    if (parts.length === 1) {
      // Just a file path
      return `File: ${parts[0]}`;
    }
    
    if (parts.length >= 3 && parts[1] === 'class') {
      return `Class: ${parts[2]} (${parts[0]})`;
    }
    
    if (parts.length >= 3 && parts[1] === 'function') {
      return `Function: ${parts[2]} (${parts[0]})`;
    }
    
    if (parts.length >= 5 && parts[1] === 'class' && parts[3] === 'method') {
      return `Method: ${parts[2]}.${parts[4]} (${parts[0]})`;
    }
    
    return identifier;
  }

  /**
   * Escape HTML special characters
   * @param text Text to escape
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
