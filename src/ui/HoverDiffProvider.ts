/**
 * ARC Hover Diff Provider
 *
 * Provides hover functionality to show diffs quickly.
 */

import * as vscode from 'vscode';
import { IKnowledgeGraphService } from '../services/IKnowledgeGraphService';
import { IDecisionRecordService } from '../services/IDecisionRecordService';
import { CodeElement, Commit, DecisionRecord, Repository } from '../models/types';

export class HoverDiffProvider implements vscode.HoverProvider {
  private static instance: HoverDiffProvider;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly knowledgeGraphService: IKnowledgeGraphService,
    private readonly decisionRecordService: IDecisionRecordService
  ) {
    // Register the hover provider for all languages
    const hoverRegistration = vscode.languages.registerHoverProvider(
      { scheme: 'file' },
      this
    );

    // Add to subscriptions
    this.context.subscriptions.push(hoverRegistration);
  }

  /**
   * Get the singleton instance of HoverDiffProvider
   */
  public static getInstance(
    context: vscode.ExtensionContext,
    knowledgeGraphService: IKnowledgeGraphService,
    decisionRecordService: IDecisionRecordService
  ): HoverDiffProvider {
    if (!HoverDiffProvider.instance) {
      HoverDiffProvider.instance = new HoverDiffProvider(
        context,
        knowledgeGraphService,
        decisionRecordService
      );
    }
    return HoverDiffProvider.instance;
  }

  /**
   * Provide hover information
   */
  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    try {
      // Start timing for performance measurement
      const startTime = Date.now();

      // Get the file path
      const filePath = document.uri.fsPath;

      // Get the workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
      }

      const workspaceFolder = workspaceFolders[0];
      const repoPath = workspaceFolder.uri.fsPath;

      // Get the relative path
      const relativePath = filePath.replace(repoPath + '/', '');

      // Get the code element for this file
      const codeElement = await this.getCodeElement(relativePath);
      if (!codeElement) {
        return null;
      }

      // Get the commit history for this element
      const commits = await this.knowledgeGraphService.getElementCommitHistory(codeElement.elementId, 3);
      if (!commits || commits.length === 0) {
        return null;
      }

      // Get the latest version of the element
      const latestVersion = await this.knowledgeGraphService.getLatestElementVersion(codeElement.elementId);
      if (!latestVersion) {
        return null;
      }

      // Get linked decisions
      const decisions = await this.knowledgeGraphService.getLinkedDecisions(latestVersion.versionId);

      // Create the hover content
      const hoverContent = await this.createHoverContent(codeElement, commits, decisions);

      // Log telemetry
      this.logTelemetry('hover_diff_shown', {
        elementId: codeElement.elementId,
        duration_ms: Date.now() - startTime
      });

      return new vscode.Hover(hoverContent);
    } catch (error) {
      console.error('Error providing hover:', error);
      return null;
    }
  }

  /**
   * Create hover content
   */
  private async createHoverContent(
    element: CodeElement,
    commits: Commit[],
    decisions: DecisionRecord[]
  ): Promise<vscode.MarkdownString[]> {
    const content: vscode.MarkdownString[] = [];

    // Add header
    const header = new vscode.MarkdownString();
    header.appendMarkdown(`## ARC Context\n\n`);

    if (decisions.length > 0) {
      header.appendMarkdown(`**${decisions.length}** decision${decisions.length !== 1 ? 's' : ''} + `);
    }

    header.appendMarkdown(`**${commits.length}** commit${commits.length !== 1 ? 's' : ''}\n\n`);
    header.appendMarkdown(`[Open in Peek View](command:arc.showPeekView?${encodeURIComponent(JSON.stringify([element]))})\n\n`);
    header.isTrusted = true;
    content.push(header);

    // Add decisions section if there are decisions
    if (decisions.length > 0) {
      const decisionsContent = new vscode.MarkdownString();
      decisionsContent.appendMarkdown(`### Decisions\n\n`);

      for (const decision of decisions) {
        const date = new Date(decision.createdAt).toLocaleDateString();
        decisionsContent.appendMarkdown(`- **${decision.title}** (${date})\n`);
      }

      decisionsContent.appendMarkdown(`\n[View All Decisions](command:arc.showPeekView?${encodeURIComponent(JSON.stringify([element]))})\n\n`);
      decisionsContent.isTrusted = true;
      content.push(decisionsContent);
    }

    // Add commits section
    const commitsContent = new vscode.MarkdownString();
    commitsContent.appendMarkdown(`### Recent Commits\n\n`);

    for (const commit of commits) {
      const date = new Date(commit.timestamp).toLocaleDateString();
      const shortHash = commit.commitHash.substring(0, 7);

      commitsContent.appendMarkdown(`- **${shortHash}** (${date}): ${commit.message}\n`);
      commitsContent.appendMarkdown(`  [View Diff](command:arc.showCommitDiff?${encodeURIComponent(JSON.stringify([commit.commitHash]))})\n`);
    }

    commitsContent.isTrusted = true;
    content.push(commitsContent);

    return content;
  }

  /**
   * Get the code element for a file path
   */
  private async getCodeElement(filePath: string): Promise<CodeElement | null> {
    try {
      // Get the workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
      }

      const workspaceFolder = workspaceFolders[0];
      const repoPath = workspaceFolder.uri.fsPath;

      // Get all repositories
      const repositories = await vscode.commands.executeCommand<Repository[]>('arc.getRepositories');
      if (!repositories || repositories.length === 0) {
        return null;
      }

      // Find the repository for this workspace
      const repository = repositories.find(repo => repo.path === repoPath);
      if (!repository) {
        return null;
      }

      // Get all code elements for this repository
      const elements = await vscode.commands.executeCommand<CodeElement[]>('arc.getCodeElements', repository.repoId);
      if (!elements || elements.length === 0) {
        return null;
      }

      // Find the code element for this file
      return elements.find(element => element.type === 'file' && element.stableIdentifier === filePath) || null;
    } catch (error) {
      console.error('Error getting code element:', error);
      return null;
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
