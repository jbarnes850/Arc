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
        (message: { command: string; decisionId?: string }) => this.handleMessage(message),
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
  private handleMessage(message: { command: string; decisionId?: string }): void {
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
          <div class="header">
            <h1>Code Context</h1>
            <p class="element-path">${this.formatStableIdentifier(element.stableIdentifier)}</p>
          </div>
          
          <div class="context-sections">
            <div class="section">
              <h2>Commit History</h2>
              ${commits.length > 0 ? commitsHtml : '<p class="empty-state">No commit history found for this element.</p>'}
            </div>
            
            <div class="section">
              <h2>Linked Decisions</h2>
              ${decisions.length > 0 ? 
                decisionsHtml : 
                `<p class="empty-state">No decisions linked to this element yet.</p>
                 <button class="primary-button" onclick="createDecision()">
                   Document a Decision for This Code
                 </button>`
              }
              ${decisions.length > 0 ? 
                `<div class="actions">
                  <button class="action-button" onclick="createDecision()">Create New Decision</button>
                  ${this.currentVersion ? '<button class="action-button" onclick="linkDecision()">Link Existing Decision</button>' : ''}
                </div>` : ''
              }
            </div>
          </div>
          
          <div class="info-panel">
            <h3>About ARC Context</h3>
            <p>ARC captures the evolution of your codebase and preserves architectural decisions. 
               This panel shows you the history and decisions related to the code you're viewing.</p>
            <p><strong>Tip:</strong> Create decision records to document important architectural choices and link them to specific code elements.</p>
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
      return '<p class="empty-state">No commit history available.</p>';
    }

    /**
     * Get initials from author name for avatar
     * @param name Author name
     */
    const getInitials = (name: string): string => {
      if (!name) {
        return '?';
      }
      const parts = name.trim().split(' ');
      if (parts.length === 1) {
        return parts[0].charAt(0).toUpperCase();
      }
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    /**
     * Format timestamp as relative time
     * @param timestamp Timestamp to format
     */
    const formatRelativeTime = (timestamp: number): string => {
      const now = Date.now();
      const diff = now - timestamp;
      
      // Less than a minute
      if (diff < 60 * 1000) {
        return 'just now';
      }
      
      // Less than an hour
      if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      }
      
      // Less than a day
      if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      }
      
      // Less than a week
      if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days} day${days !== 1 ? 's' : ''} ago`;
      }
      
      // Default to date
      return new Date(timestamp).toLocaleDateString();
    };

    /**
     * Determine commit type based on message
     * @param message Commit message
     */
    const getCommitType = (message: string): { type: string, label: string } => {
      const lowerMessage = message.toLowerCase();
      
      if (lowerMessage.includes('add') || lowerMessage.includes('new') || lowerMessage.includes('create')) {
        return { type: 'added', label: 'Added' };
      }
      
      if (lowerMessage.includes('delet') || lowerMessage.includes('remov')) {
        return { type: 'deleted', label: 'Deleted' };
      }
      
      return { type: 'modified', label: 'Modified' };
    };

    // For simplicity in this version, we'll use dev IDs as initials
    // In a future version, we can fetch actual developer names asynchronously
    const getDevInitials = (devId: string): string => {
      // Create a simple hash of the dev ID to get a consistent color
      let hash = 0;
      for (let i = 0; i < devId.length; i++) {
        hash = devId.charCodeAt(i) + ((hash << 5) - hash);
      }
      
      // Get first two characters or generate from hash
      if (devId.length >= 2) {
        return devId.substring(0, 2).toUpperCase();
      } else {
        // Generate letters from the hash
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const first = letters[Math.abs(hash) % 26];
        const second = letters[Math.abs(hash >> 5) % 26];
        return first + second;
      }
    };

    return `
      <div class="commits-list">
        ${commits.map(commit => `
          <div class="commit-item">
            <div class="commit-avatar" title="Author: ${this.escapeHtml(commit.authorDevId)}">
              ${getDevInitials(commit.authorDevId)}
            </div>
            <div class="commit-hash">${commit.commitHash.substring(0, 7)}</div>
            <div class="commit-type ${getCommitType(commit.message).type}">${getCommitType(commit.message).label}</div>
            <div class="commit-message">${this.escapeHtml(commit.message)}</div>
            <div class="commit-date">
              <span title="${new Date(commit.timestamp).toLocaleString()}">
                ${formatRelativeTime(commit.timestamp)}
              </span>
              by ${this.escapeHtml(commit.authorDevId.split('-')[0])}
            </div>
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
