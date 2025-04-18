/**
 * ARC Peek View Provider
 *
 * Provides integration with VS Code's peek feature to show context information
 * inline within the editor.
 */

import * as vscode from 'vscode';
import { IKnowledgeGraphService } from '../services/IKnowledgeGraphService';
import { IDecisionRecordService } from '../services/IDecisionRecordService';
import { CodeElement, Commit, DecisionRecord, CodeElementVersion } from '../models/types';
import * as path from 'path';

/**
 * CodeLens provider for showing context information
 */
export class ContextCodeLensProvider implements vscode.CodeLensProvider {
  private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

  constructor(
    private readonly knowledgeGraphService: IKnowledgeGraphService,
    private readonly codeElement: CodeElement
  ) {}

  /**
   * Refresh code lenses
   */
  public refresh(): void {
    this.onDidChangeCodeLensesEmitter.fire();
  }

  /**
   * Provide code lenses for a document
   */
  public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
    // Only provide code lenses for the specific file
    if (document.uri.fsPath !== this.codeElement.stableIdentifier) {
      return [];
    }

    // Create a code lens at the top of the file
    const position = new vscode.Position(0, 0);
    const range = new vscode.Range(position, position);

    const codeLens = new vscode.CodeLens(range, {
      title: 'ARC Context',
      command: 'arc.showPeekView',
      arguments: [this.codeElement]
    });

    return [codeLens];
  }
}

/**
 * Peek view content provider
 */
export class PeekViewContentProvider implements vscode.TextDocumentContentProvider {
  private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  private static readonly SCHEME = 'arc-peek';
  private contentCache = new Map<string, string>();

  constructor(
    private readonly knowledgeGraphService: IKnowledgeGraphService,
    private readonly decisionRecordService: IDecisionRecordService
  ) {}

  /**
   * Get the URI for a peek view
   */
  public static getUri(elementId: string, tab: string): vscode.Uri {
    return vscode.Uri.parse(`${PeekViewContentProvider.SCHEME}:${tab}/${elementId}.md`);
  }

  /**
   * Refresh the content for a URI
   */
  public refresh(uri: vscode.Uri): void {
    this.contentCache.delete(uri.toString());
    this.onDidChangeEmitter.fire(uri);
  }

  /**
   * Provide the content for a URI
   */
  public async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
    // Check cache first
    const cacheKey = uri.toString();
    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey)!;
    }

    // Parse the URI to get the element ID and tab
    const elementId = path.basename(uri.path, '.md');
    const tab = uri.authority;

    let content = '';

    try {
      if (tab === 'decisions') {
        content = await this.generateDecisionsContent(elementId);
      } else if (tab === 'timeline') {
        content = await this.generateTimelineContent(elementId);
      } else {
        content = '# Unknown tab';
      }
    } catch (error) {
      content = `# Error\n\nFailed to load content: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Cache the content
    this.contentCache.set(cacheKey, content);

    return content;
  }

  /**
   * Generate content for the decisions tab
   */
  private async generateDecisionsContent(elementId: string): Promise<string> {
    // Get the latest version of the element
    const latestVersion = await this.knowledgeGraphService.getLatestElementVersion(elementId);

    if (!latestVersion) {
      return '# No Decisions\n\nNo decisions found for this element.';
    }

    // Get linked decisions
    const decisions = await this.knowledgeGraphService.getLinkedDecisions(latestVersion.versionId);

    if (!decisions || decisions.length === 0) {
      return '# No Decisions\n\nNo decisions found for this element.';
    }

    // Generate markdown content
    let content = '# Decisions\n\n';

    for (const decision of decisions) {
      const date = new Date(decision.createdAt).toLocaleDateString();
      content += `## ${decision.title}\n\n`;
      content += `*Created on ${date}*\n\n`;
      content += `${decision.content}\n\n`;
      content += '---\n\n';
    }

    return content;
  }

  /**
   * Generate content for the timeline tab
   */
  private async generateTimelineContent(elementId: string): Promise<string> {
    // Get commit history for this element
    const commits = await this.knowledgeGraphService.getElementCommitHistory(elementId, 5);

    if (!commits || commits.length === 0) {
      return '# No Timeline\n\nNo commit history found for this element.';
    }

    // Generate markdown content
    let content = '# Timeline\n\n';

    for (const commit of commits) {
      const date = new Date(commit.timestamp).toLocaleDateString();
      const time = new Date(commit.timestamp).toLocaleTimeString();
      const shortHash = commit.commitHash.substring(0, 7);

      content += `## ${shortHash} - ${commit.message}\n\n`;
      content += `*${date} ${time} by ${commit.authorDevId}*\n\n`;
      content += `[View Diff](command:arc.showCommitDiff?${encodeURIComponent(JSON.stringify([commit.commitHash]))})\n\n`;
      content += '---\n\n';
    }

    return content;
  }
}

/**
 * Main peek view manager
 */
export class PeekViewManager {
  private static instance: PeekViewManager;
  private contentProvider: PeekViewContentProvider;
  private codeLensProviders = new Map<string, ContextCodeLensProvider>();
  private registeredCodeLensProviders = new Map<string, vscode.Disposable>();
  private activeElement: CodeElement | null = null;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly knowledgeGraphService: IKnowledgeGraphService,
    private readonly decisionRecordService: IDecisionRecordService
  ) {
    // Create the content provider
    this.contentProvider = new PeekViewContentProvider(knowledgeGraphService, decisionRecordService);

    // Register the content provider
    const contentProviderRegistration = vscode.workspace.registerTextDocumentContentProvider(
      'arc-peek',
      this.contentProvider
    );

    // Register the show peek view command
    const showPeekViewCommand = vscode.commands.registerCommand('arc.showPeekView', async (element: CodeElement) => {
      await this.showPeekView(element);
    });

    // Register the show commit diff command
    const showCommitDiffCommand = vscode.commands.registerCommand('arc.showCommitDiff', async (commitHash: string) => {
      await this.showCommitDiff(commitHash);
    });

    // Add to subscriptions
    this.context.subscriptions.push(
      contentProviderRegistration,
      showPeekViewCommand,
      showCommitDiffCommand
    );
  }

  /**
   * Get the singleton instance of PeekViewManager
   */
  public static getInstance(
    context: vscode.ExtensionContext,
    knowledgeGraphService: IKnowledgeGraphService,
    decisionRecordService: IDecisionRecordService
  ): PeekViewManager {
    if (!PeekViewManager.instance) {
      PeekViewManager.instance = new PeekViewManager(context, knowledgeGraphService, decisionRecordService);
    }
    return PeekViewManager.instance;
  }

  /**
   * Show the peek view for a code element
   */
  public async showPeekView(element: CodeElement): Promise<void> {
    try {
      // Set the active element
      this.activeElement = element;

      // Register a code lens provider for this element if not already registered
      if (!this.codeLensProviders.has(element.elementId)) {
        const provider = new ContextCodeLensProvider(this.knowledgeGraphService, element);
        this.codeLensProviders.set(element.elementId, provider);

        // Register the provider
        const registration = vscode.languages.registerCodeLensProvider(
          { pattern: `**/${element.stableIdentifier}` },
          provider
        );

        this.registeredCodeLensProviders.set(element.elementId, registration);
        this.context.subscriptions.push(registration);
      }

      // Log telemetry
      this.logTelemetry('peek_open', { elementId: element.elementId });

      // Show the decisions tab first
      const decisionsUri = PeekViewContentProvider.getUri(element.elementId, 'decisions');

      // Open the peek view
      await vscode.commands.executeCommand('vscode.openWith', decisionsUri, 'default');

      // Also prepare the timeline tab
      const timelineUri = PeekViewContentProvider.getUri(element.elementId, 'timeline');
      this.contentProvider.provideTextDocumentContent(timelineUri, new vscode.CancellationTokenSource().token);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show peek view: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Show a commit diff
   */
  private async showCommitDiff(commitHash: string): Promise<void> {
    try {
      // In a real implementation, we would use the Git extension API to show the diff
      // For now, just show a message
      vscode.window.showInformationMessage(`Showing diff for commit ${commitHash}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show commit diff: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Refresh the peek view
   */
  public refresh(): void {
    if (this.activeElement) {
      // Refresh the code lens provider
      const provider = this.codeLensProviders.get(this.activeElement.elementId);
      if (provider) {
        provider.refresh();
      }

      // Refresh the content provider
      const decisionsUri = PeekViewContentProvider.getUri(this.activeElement.elementId, 'decisions');
      const timelineUri = PeekViewContentProvider.getUri(this.activeElement.elementId, 'timeline');

      this.contentProvider.refresh(decisionsUri);
      this.contentProvider.refresh(timelineUri);
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
