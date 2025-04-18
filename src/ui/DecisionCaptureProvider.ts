/**
 * ARC Decision Capture Provider
 * 
 * Provides functionality for capturing decision records quickly
 * through a lightweight modal interface.
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as path from 'path';
import { IDecisionRecordService } from '../services/IDecisionRecordService';
import { IKnowledgeGraphService } from '../services/IKnowledgeGraphService';
import { PeekViewManager } from './PeekViewProvider';

export class DecisionCaptureProvider {
  private static instance: DecisionCaptureProvider;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly decisionRecordService: IDecisionRecordService,
    private readonly knowledgeGraphService: IKnowledgeGraphService,
    private readonly peekViewManager: PeekViewManager
  ) {
    // Register the command
    const captureCommand = vscode.commands.registerCommand('arc.captureDecision', async () => {
      await this.captureDecision();
    });
    
    // Add to subscriptions
    this.context.subscriptions.push(captureCommand);
  }

  /**
   * Get the singleton instance of DecisionCaptureProvider
   */
  public static getInstance(
    context: vscode.ExtensionContext,
    decisionRecordService: IDecisionRecordService,
    knowledgeGraphService: IKnowledgeGraphService,
    peekViewManager: PeekViewManager
  ): DecisionCaptureProvider {
    if (!DecisionCaptureProvider.instance) {
      DecisionCaptureProvider.instance = new DecisionCaptureProvider(
        context,
        decisionRecordService,
        knowledgeGraphService,
        peekViewManager
      );
    }
    return DecisionCaptureProvider.instance;
  }

  /**
   * Capture a decision record
   */
  private async captureDecision(): Promise<void> {
    try {
      // Start timing for telemetry
      const startTime = Date.now();
      
      // Get the active editor
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }
      
      // Get the file path
      const filePath = editor.document.uri.fsPath;
      
      // Get the workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }
      
      const workspaceFolder = workspaceFolders[0];
      const repoPath = workspaceFolder.uri.fsPath;
      
      // Generate a repository ID
      const repoId = crypto.createHash('sha256').update(repoPath).digest('hex').substring(0, 16);
      
      // Get the relative path
      const relativePath = path.relative(repoPath, filePath);
      
      // Generate a stable identifier for the file
      const stableIdentifier = relativePath;
      
      // Generate an element ID
      const elementId = crypto.createHash('sha256').update(`${repoId}:file:${stableIdentifier}`).digest('hex').substring(0, 16);
      
      // Show the input box for the title
      const title = await vscode.window.showInputBox({
        prompt: 'Enter decision title',
        placeHolder: 'e.g., Use SQLite for persistence',
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Title is required';
          }
          return null;
        }
      });
      
      if (!title) {
        return; // User cancelled
      }
      
      // Show the input box for the rationale
      const rationale = await vscode.window.showInputBox({
        prompt: 'Enter rationale (optional)',
        placeHolder: 'e.g., SQLite provides a lightweight, embedded database solution that meets our needs',
        ignoreFocusOut: true
      });
      
      // Generate the content
      const content = `# ${title}\n\n## Rationale\n\n${rationale || 'No rationale provided.'}\n\n## Context\n\nThis decision was made while working on \`${stableIdentifier}\`.`;
      
      // Create the decision record
      const decision = await this.decisionRecordService.createDecisionRecord(title, content, repoId);
      
      // Get the latest version of the element
      const latestVersion = await this.knowledgeGraphService.getLatestElementVersion(elementId);
      
      if (latestVersion) {
        // Link the decision to the code element
        await this.knowledgeGraphService.linkDecisionToElement(decision.decisionId, elementId);
        
        // Get the commit hash for the toast message
        const shortHash = latestVersion.commitHash.substring(0, 7);
        
        // Show success message
        vscode.window.showInformationMessage(`Decision saved & linked to commit ${shortHash}`);
      } else {
        // Show success message without commit hash
        vscode.window.showInformationMessage('Decision saved successfully');
      }
      
      // Refresh the peek view if it's open
      this.peekViewManager.refresh();
      
      // Log telemetry
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.logTelemetry('decision_capture', { 
        elementId, 
        decisionId: decision.decisionId,
        duration_ms: duration
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to capture decision: ${error instanceof Error ? error.message : String(error)}`);
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
