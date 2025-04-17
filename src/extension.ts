// Import type declarations for VS Code API
import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';

import { SQLitePersistenceService } from './persistence/SQLitePersistenceService';
import { IPersistenceService } from './persistence/IPersistenceService';
import { GitHubIntegrationService } from './integration/GitHubIntegrationService';
import { IGitHubIntegrationService } from './integration/IGitHubIntegrationService';
import { CodeParserService } from './indexing/CodeParserService';
import { ICodeParserService } from './indexing/ICodeParserService';
import { KnowledgeGraphService } from './services/KnowledgeGraphService';
import { IKnowledgeGraphService } from './services/IKnowledgeGraphService';
import { DecisionRecordService } from './services/DecisionRecordService';
import { IDecisionRecordService } from './services/IDecisionRecordService';
import { ArchitectureDiagramGenerator } from './ui/ArchitectureDiagramGenerator';
import { IArchitectureDiagramGenerator } from './ui/IArchitectureDiagramGenerator';
import { ContextPanel } from './ui/ContextPanel';
import { ArchitecturePanel } from './ui/ArchitecturePanel';
import { Repository } from './models/types';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  console.log('ARC extension is now active');

  // Check if this is the first run
  const isFirstRun = context.globalState.get('arc.firstRun', true);
  
  if (isFirstRun) {
    // Mark as no longer first run
    context.globalState.update('arc.firstRun', false);
    
    // Show the welcome walkthrough
    // Use a simple Promise to delay execution without relying on Node.js-specific functions
    Promise.resolve().then(() => {
      vscode.commands.executeCommand('workbench.action.openWalkthrough', 'arc.arcWelcome', false);
    });
  }

  // Initialize services
  const persistenceService: IPersistenceService = new SQLitePersistenceService(context);
  
  // Initialize the database
  persistenceService.initializeDatabase()
    .then(() => {
      console.log('ARC database initialized successfully');
    })
    .catch(error => {
      console.error('Failed to initialize ARC database:', error);
      vscode.window.showErrorMessage('Failed to initialize ARC database. See console for details.');
    });
  
  // Create services
  const codeParserService: ICodeParserService = new CodeParserService();
  const gitService: IGitHubIntegrationService = new GitHubIntegrationService(persistenceService);
  
  // Read user settings for feature flags
  const config = vscode.workspace.getConfiguration('arc');
  const enableFileCache = config.get<boolean>('enableFileCache', true);
  
  const knowledgeGraphService: IKnowledgeGraphService = new KnowledgeGraphService(
    persistenceService,
    codeParserService,
    gitService,
    enableFileCache
  );
  const decisionRecordService: IDecisionRecordService = new DecisionRecordService(persistenceService);
  const diagramGenerator: IArchitectureDiagramGenerator = new ArchitectureDiagramGenerator(knowledgeGraphService);
  
  // Create UI panels
  const contextPanel = ContextPanel.getInstance(context, knowledgeGraphService);
  const architecturePanel = ArchitecturePanel.getInstance(context, diagramGenerator);
  
  // Register commands
  
  // Command: Index Repository
  const indexRepositoryCommand = vscode.commands.registerCommand('arc.indexRepository', async () => {
    try {
      // Get the workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }
      
      const workspaceFolder = workspaceFolders[0];
      const repoPath = workspaceFolder.uri.fsPath;
      const repoName = workspaceFolder.name;
      
      // Request explicit authorization with clear information
      const authorization = await vscode.window.showInformationMessage(
        `ARC needs to index your repository "${repoName}" to build a temporal knowledge graph. This will:

• Parse your code structure using tree-sitter
• Process your Git commit history
• Store data locally in SQLite (no data leaves your machine)

This is a one-time process that takes a few moments.`,
        { modal: true },
        'Authorize Indexing'
      );
      
      if (authorization !== 'Authorize Indexing') {
        return; // User declined
      }
      
      // Generate a repository ID
      const repoId = crypto.createHash('sha256').update(repoPath).digest('hex').substring(0, 16);
      
      // Save the repository
      const repository: Repository = {
        repoId,
        path: repoPath,
        name: repoName
      };
      
      await persistenceService.saveRepository(repository);
      
      // Show progress while indexing
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Indexing repository: ${repoName}`,
        cancellable: true
      }, async (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => {
        // Handle user cancellation
        token.onCancellationRequested(() => {
          vscode.window.showWarningMessage('Indexing cancelled by user');
          throw new Error('Indexing cancelled');
        });
        
        // Initialize the parser for TypeScript
        await codeParserService.initializeParser('typescript');
        
        // Index the repository
        progress.report({ message: 'Extracting commit history...' });
        await gitService.indexCommitHistory(repoPath, repoId);
        
        // Show the architecture diagram
        progress.report({ message: 'Generating architecture diagram...' });
        architecturePanel.show();
        await architecturePanel.updateDiagram(repoId, repoName);
        
        return 'Repository indexed successfully';
      });
      
      // Get counts for the magic moment toast
      const elementCount = await persistenceService.getCodeElementCount(repoId);
      const commitCount = await persistenceService.getCommitCount(repoId);
      const decisionCount = await persistenceService.getDecisionCount(repoId);
      
      // Show the magic moment toast with actual counts
      const magicMomentAction = await vscode.window.showInformationMessage(
        `Indexing complete. ${elementCount} elements tracked. ${commitCount} commits analyzed. ${decisionCount} decisions linked (yet). Let's fix that.`,
        'Create Decision'
      );
      
      if (magicMomentAction === 'Create Decision') {
        vscode.commands.executeCommand('arc.createDecisionRecord');
        return;
      }
      
      // Guide the user to the next step with a clear call-to-action
      const nextAction = await vscode.window.showInformationMessage(
        `Repository indexed successfully! ARC has generated an architecture diagram for your system.`,
        'Explore Architecture', 
        'Create Decision Record'
      );
      
      if (nextAction === 'Create Decision Record') {
        vscode.commands.executeCommand('arc.createDecisionRecord');
      }
      // Architecture panel is already open if they choose "Explore Architecture"
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to index repository: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  // Command: Create Decision Record
  const createDecisionRecordCommand = vscode.commands.registerCommand('arc.createDecisionRecord', async () => {
    try {
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
      
      // Prompt for decision title
      const title = await vscode.window.showInputBox({
        prompt: 'Enter decision title',
        placeHolder: 'e.g., Use SQLite for persistence'
      });
      
      if (!title) {
        return; // User cancelled
      }
      
      // Create a new untitled document for the decision content
      const document = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: `# ${title}\n\n## Context\n\n## Decision\n\n## Consequences\n`
      });
      
      // Show the document to the user
      await vscode.window.showTextDocument(document);
      
      // Wait for the user to edit and save the document
      const saveDecision = async () => {
        const content = document.getText();
        
        // Create the decision record
        const decision = await decisionRecordService.createDecisionRecord(title, content, repoId);
        
        vscode.window.showInformationMessage(`Decision record "${title}" created successfully`);
        
        // Prompt to link to current code
        const shouldLink = await vscode.window.showQuickPick(['Yes', 'No'], {
          placeHolder: 'Link this decision to the current code element?'
        });
        
        if (shouldLink === 'Yes') {
          vscode.commands.executeCommand('arc.linkDecisionToCode', decision.decisionId);
        }
      };
      
      // Register a one-time save handler
      const disposable = vscode.workspace.onDidSaveTextDocument(async (savedDoc: vscode.TextDocument) => {
        if (savedDoc === document) {
          await saveDecision();
          disposable.dispose();
        }
      });
      
      context.subscriptions.push(disposable);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create decision record: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  // Command: Link Decision to Code
  const linkDecisionToCodeCommand = vscode.commands.registerCommand('arc.linkDecisionToCode', async (decisionId?: string) => {
    try {
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
      
      // If no decision ID was provided, prompt the user to select one
      if (!decisionId) {
        // In a real implementation, we would query the database for all decisions
        // and let the user select one. For simplicity, we'll show an error message.
        vscode.window.showErrorMessage('Linking to existing decisions is not implemented in this version');
        return;
      }
      
      // Get the latest version of the element
      const version = await knowledgeGraphService.getLatestElementVersion(elementId);
      if (!version) {
        vscode.window.showErrorMessage('No version found for this file. Please index the repository first.');
        return;
      }
      
      // Link the decision to the code version
      await decisionRecordService.linkDecisionToCodeVersion(decisionId, version.versionId);
      
      vscode.window.showInformationMessage('Decision linked to code successfully');
      
      // Update the context panel
      contextPanel.updateContext({
        elementId,
        repoId,
        type: 'file',
        stableIdentifier
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to link decision to code: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  // Command: Show Context Panel
  const showContextPanelCommand = vscode.commands.registerCommand('arc.showContextPanel', async () => {
    try {
      // Get the active editor
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        contextPanel.show();
        return;
      }
      
      // Get the file path
      const filePath = editor.document.uri.fsPath;
      
      // Get the workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        contextPanel.show();
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
      
      // Update the context panel
      contextPanel.updateContext({
        elementId,
        repoId,
        type: 'file',
        stableIdentifier
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show context: ${error instanceof Error ? error.message : String(error)}`);
      contextPanel.show();
    }
  });
  
  // Command: Show Welcome
  const showWelcomeCommand = vscode.commands.registerCommand('arc.showWelcome', () => {
    // This command is primarily used as a completion event for the walkthrough
    // Show a welcome message with next steps
    vscode.window.showInformationMessage(
      'Welcome to ARC! Start by indexing your repository to build a temporal knowledge graph.',
      'Index Repository'
    ).then((selection: string | undefined) => {
      if (selection === 'Index Repository') {
        vscode.commands.executeCommand('arc.indexRepository');
      }
    });
  });

  // Command: Show Architecture Panel
  const showArchitecturePanelCommand = vscode.commands.registerCommand('arc.showArchitecturePanel', () => {
    architecturePanel.show();
  });

  // Add commands to subscriptions
  context.subscriptions.push(
    indexRepositoryCommand,
    createDecisionRecordCommand,
    linkDecisionToCodeCommand,
    showContextPanelCommand,
    showWelcomeCommand,
    showArchitecturePanelCommand
  );
  
  // Register tree data providers for the views
  vscode.window.registerTreeDataProvider('arcContextView', {
    getTreeItem: () => new vscode.TreeItem('No context available'),
    getChildren: () => Promise.resolve([])
  });
  
  vscode.window.registerTreeDataProvider('arcArchitectureView', {
    getTreeItem: () => new vscode.TreeItem('No architecture available'),
    getChildren: () => Promise.resolve([])
  });
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log('ARC extension is now deactivated');
  // Cleanup will be implemented here
}
