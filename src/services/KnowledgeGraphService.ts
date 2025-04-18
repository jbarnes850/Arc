import * as crypto from 'crypto';
import * as fs from 'fs';
import { IKnowledgeGraphService } from './IKnowledgeGraphService';
import { IPersistenceService } from '../persistence/IPersistenceService';
import { ICodeParserService } from '../indexing/ICodeParserService';
import { IGitHubIntegrationService } from '../integration/IGitHubIntegrationService';
import { Commit, CodeElement, CodeElementVersion, DecisionRecord } from '../models/types';

/**
 * Implementation of IKnowledgeGraphService that connects Git history with code structure
 */
export class KnowledgeGraphService implements IKnowledgeGraphService {
  private enableFileCache: boolean;
  private static MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB max file size for parsing

  constructor(
    private persistenceService: IPersistenceService,
    private codeParserService: ICodeParserService,
    private gitService: IGitHubIntegrationService,
    enableFileCache: boolean = false
  ) {
    this.enableFileCache = enableFileCache;
  }

  /**
   * Get the commit history for a code element
   * @param elementId ID of the code element
   * @param limit Maximum number of commits to return
   */
  async getElementCommitHistory(elementId: string, limit?: number): Promise<Commit[]> {
    return this.persistenceService.getCommitHistoryForElementId(elementId, limit);
  }

  /**
   * Get decisions linked to a specific code element version
   * @param versionId ID of the code element version
   */
  async getLinkedDecisions(versionId: string): Promise<DecisionRecord[]> {
    return this.persistenceService.findDecisionRecordsLinkedToVersion(versionId);
  }

  /**
   * Get the latest version of a code element
   * @param elementId ID of the code element
   */
  async getLatestElementVersion(elementId: string): Promise<CodeElementVersion | null> {
    return this.persistenceService.findLatestCodeElementVersion(elementId);
  }

  /**
   * Get data for generating an architecture diagram
   * @param repoId ID of the repository
   */
  async getArchitectureDiagramData(repoId: string): Promise<{nodes: any[]; edges: any[]}> {
    // Fetch all code elements from persistence
    const elements = await this.persistenceService.getAllCodeElements(repoId);
    // Prepare nodes for files and classes
    const nodes = elements.map(element => ({
      id: element.elementId,
      type: element.type,
      label: this.getLabelFromIdentifier(element.stableIdentifier),
      elementId: element.elementId,
      hasDecisions: false
    }));
    // Build containment edges (class -> file)
    const edges: Array<{source: string; target: string; type: string}> = [];
    elements.forEach(element => {
      if (element.type === 'class') {
        const filePath = element.stableIdentifier.split(':')[0];
        const fileElement = elements.find(e => e.type === 'file' && e.stableIdentifier === filePath);
        if (fileElement) {
          edges.push({source: fileElement.elementId, target: element.elementId, type: 'contains'});
        }
      }
    });
    // Decorate nodes with decision flags
    for (const node of nodes) {
      const version = await this.persistenceService.findLatestCodeElementVersion(node.elementId);
      if (version) {
        const decisions = await this.persistenceService.findDecisionRecordsLinkedToVersion(version.versionId);
        node.hasDecisions = decisions.length > 0;
      }
    }
    return {nodes, edges};
  }

  /**
   * Process a commit to update the knowledge graph
   * @param repoPath Path to the repository
   * @param repoId Repository ID
   * @param commitHash Commit hash
   */
  async processCommit(repoPath: string, repoId: string, commitHash: string): Promise<void> {
    // Get the commit from the Git service
    const commit = await this.gitService.getCommit(repoPath, commitHash);
    if (!commit) {
      throw new Error(`Commit ${commitHash} not found`);
    }

    // Get changed files for this commit
    const { stdout } = await this.execGitCommand(
      `git show --name-only --pretty=format: ${commitHash}`,
      repoPath
    );

    const changedFiles = stdout.split('\n').filter(line => line.trim() !== '');

    // Process each changed file
    for (const filePath of changedFiles) {
      const fullPath = `${repoPath}/${filePath}`;

      // Skip files that exceed size limit
      try {
        const stats = fs.statSync(fullPath);
        if (stats.size > KnowledgeGraphService.MAX_FILE_SIZE_BYTES) { continue; }
      } catch {
        // if stat fails, skip
        continue;
      }

      // Skip unparseable files
      if (!this.codeParserService.canParseFile(fullPath)) {
        continue;
      }

      // File-cache: compute hash as string
      let fileHash: string | undefined;
      if (this.enableFileCache) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          fileHash = crypto.createHash('sha1').update(content).digest('hex');
          const last = await this.persistenceService.getFileHash(repoId, fullPath);
          if (last === fileHash) { continue; }
        } catch {
          // ignore and parse
        }
      }

      // Get the full path to the file
      // Parse the file to get code elements
      const codeElements = await this.codeParserService.parseFile(fullPath, repoId);

      // Save code elements to the database
      for (const element of codeElements) {
        await this.persistenceService.saveCodeElement(element);

        // Create a version for this element at this commit
        const version: CodeElementVersion = {
          versionId: this.generateVersionId(element.elementId, commitHash),
          elementId: element.elementId,
          commitHash,
          name: this.getNameFromIdentifier(element.stableIdentifier),
          // Note: In a real implementation, we would extract line numbers
          // from the tree-sitter parsing results
          startLine: undefined,
          endLine: undefined,
          previousVersionId: null // Will be linked later
        };

        // Save the version
        await this.persistenceService.saveCodeElementVersion(version);

        // Find the previous version of this element
        const previousVersions = await this.getPreviousVersions(element.elementId, commitHash);
        if (previousVersions.length > 0) {
          // Link to the most recent previous version
          await this.persistenceService.linkVersionToPreviousVersion(
            version.versionId,
            previousVersions[0].versionId
          );
        }
      }

      // Save updated hash
      if (this.enableFileCache && fileHash) {
        await this.persistenceService.saveFileHash(repoId, fullPath, fileHash);
      }
    }
  }

  /**
   * Get previous versions of a code element before a specific commit
   * @param elementId Element ID
   * @param commitHash Commit hash
   */
  private async getPreviousVersions(elementId: string, commitHash: string): Promise<CodeElementVersion[]> {
    // Get the commit to find its timestamp
    const commit = await this.persistenceService.getCommit(commitHash);
    if (!commit) {
      return [];
    }

    // Get all versions of this element
    const allVersions: CodeElementVersion[] = [];
    const commits = await this.persistenceService.getCommitHistoryForElementId(elementId);

    for (const c of commits) {
      if (c.commitHash !== commitHash && c.timestamp < commit.timestamp) {
        const version = await this.persistenceService.getCodeElementVersions(elementId, c.commitHash);
        if (version) {
          allVersions.push(version);
        }
      }
    }

    // Sort by timestamp (descending)
    allVersions.sort((a, b) => {
      const commitA = commits.find(c => c.commitHash === a.commitHash);
      const commitB = commits.find(c => c.commitHash === b.commitHash);
      if (!commitA || !commitB) {
        return 0;
      }
      return commitB.timestamp - commitA.timestamp;
    });

    return allVersions;
  }

  /**
   * Trace the history of a code element through all its versions
   * @param elementId Element ID
   */
  async traceElementHistory(elementId: string): Promise<CodeElementVersion[]> {
    // Get the latest version of the element
    const latestVersion = await this.persistenceService.findLatestCodeElementVersion(elementId);
    if (!latestVersion) {
      return [];
    }

    // Start with the latest version
    const history: CodeElementVersion[] = [latestVersion];
    let currentVersion = latestVersion;

    // Follow the previousVersionId links to trace the history
    while (currentVersion.previousVersionId) {
      const previousVersion = await this.persistenceService.getCodeElementVersion(currentVersion.previousVersionId);
      if (!previousVersion) {
        break;
      }
      history.push(previousVersion);
      currentVersion = previousVersion;
    }

    return history;
  }

  /**
   * Link a decision record to a code element version
   * @param decisionId Decision record ID
   * @param elementId Code element ID
   */
  async linkDecisionToElement(decisionId: string, elementId: string): Promise<void> {
    // Get the latest version of the element
    const latestVersion = await this.persistenceService.findLatestCodeElementVersion(elementId);
    if (!latestVersion) {
      throw new Error(`Code element ${elementId} not found`);
    }

    // Link the decision to the latest version
    await this.persistenceService.linkDecisionToCodeVersion(decisionId, latestVersion.versionId);
  }

  /**
   * Get all code elements modified by a specific commit
   * @param commitHash Commit hash
   */
  async getElementsModifiedByCommit(commitHash: string): Promise<CodeElement[]> {
    // Get the commit to verify it exists
    const commit = await this.persistenceService.getCommit(commitHash);
    if (!commit) {
      throw new Error(`Commit ${commitHash} not found`);
    }

    // Get all code element versions for this commit
    const elements: CodeElement[] = [];
    const allElements = await this.persistenceService.getAllCodeElements(commit.repoId);

    for (const element of allElements) {
      const version = await this.persistenceService.getCodeElementVersions(element.elementId, commitHash);
      if (version) {
        elements.push(element);
      }
    }

    return elements;
  }

  /**
   * Get all code elements for a repository
   * @param repoId Repository ID
   */
  private async getCodeElementsForRepo(repoId: string): Promise<CodeElement[]> {
    return this.persistenceService.getAllCodeElements(repoId);
  }

  /**
   * Execute a Git command
   * @param command Git command to execute
   * @param cwd Working directory
   */
  private async execGitCommand(command: string, cwd: string): Promise<{stdout: string, stderr: string}> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec(command, { cwd }, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  /**
   * Generate a version ID
   * @param elementId Element ID
   * @param commitHash Commit hash
   */
  private generateVersionId(elementId: string, commitHash: string): string {
    return crypto.createHash('sha256').update(`${elementId}:${commitHash}`).digest('hex').substring(0, 16);
  }

  /**
   * Extract the name from a stable identifier
   * @param identifier Stable identifier
   */
  private getNameFromIdentifier(identifier: string): string {
    // Extract the name from the identifier
    // e.g., "src/main.ts:class:MyClass" -> "MyClass"
    const parts = identifier.split(':');
    return parts[parts.length - 1];
  }

  /**
   * Extract the file path from a stable identifier
   * @param identifier Stable identifier
   */
  private getFileFromIdentifier(identifier: string): string {
    // Extract the file path from the identifier
    // e.g., "src/main.ts:class:MyClass" -> "src/main.ts"
    return identifier.split(':')[0];
  }

  /**
   * Get a human-readable label from a stable identifier
   * @param identifier Stable identifier
   */
  private getLabelFromIdentifier(identifier: string): string {
    // Create a human-readable label from the identifier
    const parts = identifier.split(':');

    if (parts.length === 1) {
      // Just a file path
      return parts[0];
    }

    if (parts.length >= 3 && parts[1] === 'class') {
      return parts[2]; // Class name
    }

    if (parts.length >= 3 && parts[1] === 'function') {
      return parts[2]; // Function name
    }

    if (parts.length >= 5 && parts[1] === 'class' && parts[3] === 'method') {
      return `${parts[2]}.${parts[4]}`; // Class.method
    }

    return identifier;
  }
}
