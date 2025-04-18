// Import type declarations for VS Code API
import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';

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
import { ContextToast } from './ui/ContextToast';
import { PeekViewManager } from './ui/PeekViewProvider';
import { DecisionCaptureProvider } from './ui/DecisionCaptureProvider';
import { IndexProgressProvider } from './ui/IndexProgressProvider';
import { ArchitectureStatusBarItem } from './ui/ArchitectureStatusBarItem';
import { HoverDiffProvider } from './ui/HoverDiffProvider';
import { MemoryMonitor } from './utils/MemoryMonitor';
import { Repository } from './models/types';

// Declare global variables for resource management
declare global {
  var persistenceService: IPersistenceService;
  var memoryMonitor: MemoryMonitor;
}

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

  // Create UI panels and providers
  const contextPanel = ContextPanel.getInstance(context, knowledgeGraphService);
  const architecturePanel = ArchitecturePanel.getInstance(context, diagramGenerator);
  const peekViewManager = PeekViewManager.getInstance(context, knowledgeGraphService, decisionRecordService);
  const contextToast = ContextToast.getInstance(context, knowledgeGraphService);
  const decisionCaptureProvider = DecisionCaptureProvider.getInstance(context, decisionRecordService, knowledgeGraphService, peekViewManager);
  const indexProgressProvider = IndexProgressProvider.getInstance(context);
  const architectureStatusBarItem = ArchitectureStatusBarItem.getInstance(context);
  const hoverDiffProvider = HoverDiffProvider.getInstance(context, knowledgeGraphService, decisionRecordService);
  const memoryMonitor = MemoryMonitor.getInstance(context);

  // Store services in global variables for cleanup and access
  global.persistenceService = persistenceService;
  global.memoryMonitor = memoryMonitor;
  global.indexProgressProvider = indexProgressProvider;

  // Start memory monitoring
  memoryMonitor.startMonitoring();

  // Show the status bar items
  indexProgressProvider.show();
  architectureStatusBarItem.show();

  // Register commands

  // Command: Get Repositories
  const getRepositoriesCommand = vscode.commands.registerCommand('arc.getRepositories', async () => {
    try {
      // Get all repositories from the database
      const repositories: Repository[] = [];
      const repoIds = await persistenceService.getRepositoryIds();

      for (const repoId of repoIds) {
        const repo = await persistenceService.getRepository(repoId);
        if (repo) {
          repositories.push(repo);
        }
      }

      return repositories;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get repositories: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  });

  // Command: Get Code Elements
  const getCodeElementsCommand = vscode.commands.registerCommand('arc.getCodeElements', async (repoId: string) => {
    try {
      return await persistenceService.getAllCodeElements(repoId);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get code elements: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  });

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

      // Start the indexing progress
      indexProgressProvider.startIndexing(repoId, repoPath);

      try {
        // Initialize the parser for TypeScript
        await codeParserService.initializeParser('typescript');

        // Index the repository
        indexProgressProvider.updateProgress(0);
        await gitService.indexCommitHistory(repoPath, repoId);

        // Count lines of code
        const loc = await countLinesOfCode(repoPath);

        // Complete the indexing
        indexProgressProvider.completeIndexing(true, loc);

        // Show the architecture diagram
        architecturePanel.show();
        await architecturePanel.updateDiagram(repoId, repoName);
      } catch (error) {
        // Handle error
        indexProgressProvider.completeIndexing(false, 0);
        throw error;
      }

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
      // Use the new decision capture provider
      await vscode.commands.executeCommand('arc.captureDecision');
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

  // Command: Show Commit Diff
  const showCommitDiffCommand = vscode.commands.registerCommand('arc.showCommitDiff', async (commitHash: string) => {
    try {
      // Get the workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      const workspaceFolder = workspaceFolders[0];
      const repoPath = workspaceFolder.uri.fsPath;

      // Get the commit details
      const commit = await persistenceService.getCommit(commitHash);
      if (!commit) {
        vscode.window.showErrorMessage(`Commit ${commitHash} not found`);
        return;
      }

      // Show the diff using Git
      const shortHash = commitHash.substring(0, 7);
      const parentHash = commit.parentHash || `${commitHash}^`;

      // Use the Git extension API to show the diff
      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      if (gitExtension) {
        const api = gitExtension.getAPI(1);
        if (api) {
          const repo = api.repositories.find(r => r.rootUri.fsPath === repoPath);
          if (repo) {
            // Show the diff
            await vscode.commands.executeCommand('git.openDiff', {
              ref1: parentHash,
              ref2: commitHash,
              repository: repo
            });

            // Log telemetry
            const config = vscode.workspace.getConfiguration('arc');
            const telemetryEnabled = config.get<boolean>('telemetry', true);

            if (telemetryEnabled) {
              console.log(`Telemetry: commit_diff_shown`, { commitHash });
            }

            return;
          }
        }
      }

      // Fallback if Git extension is not available
      vscode.window.showInformationMessage(`Showing diff for commit ${shortHash}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show commit diff: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Command: Show Memory Status
  const showMemoryStatusCommand = vscode.commands.registerCommand('arc.showMemoryStatus', () => {
    memoryMonitor.showMemoryStatus();
  });

  // Add commands to subscriptions
  context.subscriptions.push(
    indexRepositoryCommand,
    createDecisionRecordCommand,
    linkDecisionToCodeCommand,
    showContextPanelCommand,
    showWelcomeCommand,
    showArchitecturePanelCommand,
    getRepositoriesCommand,
    getCodeElementsCommand,
    showCommitDiffCommand,
    showMemoryStatusCommand
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

/**
 * Count the lines of code in a repository
 */
async function countLinesOfCode(repoPath: string): Promise<number> {
  try {
    // Use a simple algorithm to count lines of code
    let totalLines = 0;

    // Function to recursively count lines in a directory
    const countLinesInDir = async (dirPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip node_modules and .git directories
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            await countLinesInDir(fullPath);
          }
        } else {
          // Only count source code files
          const ext = path.extname(entry.name).toLowerCase();
          if (['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rb', '.php'].includes(ext)) {
            // Read the file and count lines
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n').length;
            totalLines += lines;
          }
        }
      }
    };

    // Start counting
    await countLinesInDir(repoPath);

    return totalLines;
  } catch (error) {
    console.error('Error counting lines of code:', error);
    return 0;
  }
}

// Global variables for resource management
let databaseCleanupPromise: Promise<void> | null = null;
let isDeactivating = false;

// This method is called when your extension is deactivated
export function deactivate(): Promise<void> {
  console.log('ARC extension is now deactivating...');
  isDeactivating = true;

  // If we already have a cleanup promise, return it
  if (databaseCleanupPromise) {
    return databaseCleanupPromise;
  }

  // Create a new cleanup promise
  databaseCleanupPromise = new Promise<void>(async (resolve) => {
    try {
      // Perform cleanup tasks
      console.log('Cleaning up resources...');

      // Stop memory monitoring
      if (global.memoryMonitor) {
        global.memoryMonitor.dispose();
        delete global.memoryMonitor;
      }

      // Close database connections
      if (global.persistenceService) {
        try {
          // Call a method to ensure the connection is closed
          await global.persistenceService.closeConnection();
          console.log('Database connection closed successfully');
        } catch (error) {
          console.error('Error closing database connection:', error);
        }
        delete global.persistenceService;
      }

      // Run garbage collection if available
      try {
        // @ts-ignore - gc might be available in some Node.js environments
        if (typeof global.gc === 'function') {
          console.log('Running final garbage collection...');
          // @ts-ignore
          global.gc();
        }
      } catch (error) {
        console.error('Error running garbage collection:', error);
      }

      console.log('ARC extension is now deactivated');
      resolve();
    } catch (error) {
      console.error('Error during deactivation:', error);
      resolve(); // Resolve anyway to prevent hanging
    }
  });

  return databaseCleanupPromise;
}
