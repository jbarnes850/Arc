/**
 * ARC Context Toast
 * 
 * Provides non-modal toast notifications for context information
 * that appear when opening files with history.
 */

import * as vscode from 'vscode';
import { IKnowledgeGraphService } from '../services/IKnowledgeGraphService';
import { CodeElement } from '../models/types';
import * as path from 'path';
import * as crypto from 'crypto';

export class ContextToast {
  private static instance: ContextToast;
  private toastDisposable: vscode.Disposable | undefined;
  private lastToastTime: number = 0;
  private readonly TOAST_COOLDOWN_MS = 5000; // Prevent toast spam

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly knowledgeGraphService: IKnowledgeGraphService
  ) {
    // Register event handlers
    this.registerEventHandlers();
  }

  /**
   * Get the singleton instance of ContextToast
   */
  public static getInstance(
    context: vscode.ExtensionContext,
    knowledgeGraphService: IKnowledgeGraphService
  ): ContextToast {
    if (!ContextToast.instance) {
      ContextToast.instance = new ContextToast(context, knowledgeGraphService);
    }
    return ContextToast.instance;
  }

  /**
   * Register event handlers for file open events
   */
  private registerEventHandlers(): void {
    // Listen for text editor changes
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor) {
        await this.checkFileContext(editor);
      }
    }, null, this.context.subscriptions);
  }

  /**
   * Check if the file has context information and show a toast if it does
   */
  private async checkFileContext(editor: vscode.TextEditor): Promise<void> {
    try {
      // Get the file path
      const filePath = editor.document.uri.fsPath;
      
      // Skip non-file documents
      if (editor.document.uri.scheme !== 'file') {
        return;
      }

      // Get the workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
      }
      
      const workspaceFolder = workspaceFolders[0];
      const repoPath = workspaceFolder.uri.fsPath;
      
      // Generate a repository ID
      const repoId = crypto.createHash('sha256').update(repoPath).digest('hex').substring(0, 16);
      
      // Get the relative path
      const relativePath = path.relative(repoPath, filePath);
      
      // Skip files outside the workspace
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return;
      }
      
      // Generate a stable identifier for the file
      const stableIdentifier = relativePath;
      
      // Generate an element ID
      const elementId = crypto.createHash('sha256').update(`${repoId}:file:${stableIdentifier}`).digest('hex').substring(0, 16);
      
      // Check if we have context for this file
      const codeElement: CodeElement = {
        elementId,
        repoId,
        type: 'file',
        stableIdentifier
      };

      // Get commit history for this element
      const commits = await this.knowledgeGraphService.getElementCommitHistory(elementId, 5);
      
      // Get the latest version of the element
      const latestVersion = await this.knowledgeGraphService.getLatestElementVersion(elementId);
      
      // If we have a version, get linked decisions
      let decisions: any[] = [];
      if (latestVersion) {
        decisions = await this.knowledgeGraphService.getLinkedDecisions(latestVersion.versionId);
      }
      
      // If we have context, show a toast
      if ((commits && commits.length > 0) || (decisions && decisions.length > 0)) {
        // Prevent toast spam by checking the time since the last toast
        const now = Date.now();
        if (now - this.lastToastTime < this.TOAST_COOLDOWN_MS) {
          return;
        }
        
        this.lastToastTime = now;
        
        // Log telemetry
        this.logTelemetry('toast_shown', { 
          elementId, 
          commitCount: commits.length, 
          decisionCount: decisions.length 
        });
        
        // Show the toast
        await this.showContextToast(codeElement, commits.length, decisions.length);
      }
    } catch (error) {
      console.error('Error checking file context:', error);
    }
  }

  /**
   * Show a context toast for a file
   */
  private async showContextToast(element: CodeElement, commitCount: number, decisionCount: number): Promise<void> {
    // Clear any existing toast
    if (this.toastDisposable) {
      this.toastDisposable.dispose();
    }
    
    // Create the message
    let message = '';
    if (decisionCount > 0 && commitCount > 0) {
      message = `${decisionCount} decision${decisionCount !== 1 ? 's' : ''} + ${commitCount} commit${commitCount !== 1 ? 's' : ''} — Peek`;
    } else if (decisionCount > 0) {
      message = `${decisionCount} decision${decisionCount !== 1 ? 's' : ''} — Peek`;
    } else if (commitCount > 0) {
      message = `${commitCount} commit${commitCount !== 1 ? 's' : ''} — Peek`;
    } else {
      return; // No context to show
    }
    
    // Show the toast
    this.toastDisposable = vscode.window.setStatusBarMessage(message, 4000); // Auto-dismiss after 4 seconds
    
    // Also show as information message with action
    const action = await vscode.window.showInformationMessage(message, { modal: false }, 'Peek');
    
    if (action === 'Peek') {
      // Log telemetry
      this.logTelemetry('peek_open', { elementId: element.elementId });
      
      // Show the peek view
      await vscode.commands.executeCommand('arc.showPeekView', element);
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
}
