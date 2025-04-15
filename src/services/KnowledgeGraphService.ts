import * as crypto from 'crypto';
import { IKnowledgeGraphService } from './IKnowledgeGraphService';
import { IPersistenceService } from '../persistence/IPersistenceService';
import { ICodeParserService } from '../indexing/ICodeParserService';
import { IGitHubIntegrationService } from '../integration/IGitHubIntegrationService';
import { Commit, CodeElement, CodeElementVersion, DecisionRecord } from '../models/types';

/**
 * Implementation of IKnowledgeGraphService that connects Git history with code structure
 */
export class KnowledgeGraphService implements IKnowledgeGraphService {
  constructor(
    private persistenceService: IPersistenceService,
    private codeParserService: ICodeParserService,
    private gitService: IGitHubIntegrationService
  ) {}

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
  async getArchitectureDiagramData(repoId: string): Promise<any> {
    // This is a simplified implementation for the architecture diagram
    // In a real implementation, we would analyze the code structure more deeply
    
    // Get all code elements for the repository
    const elements = await this.getCodeElementsForRepo(repoId);
    
    // Create nodes for files and classes
    const nodes = elements
      .filter(element => element.type === 'file' || element.type === 'class')
      .map(element => ({
        id: element.elementId,
        type: element.type,
        label: this.getLabelFromIdentifier(element.stableIdentifier),
        elementId: element.elementId,
        hasDecisions: false // Default value, will be updated below
      }));
    
    // Create edges based on file/class relationships
    // This is a simplified approach - in a real implementation we would
    // analyze imports, dependencies, etc.
    const edges: Array<{source: string, target: string, type: string}> = [];
    
    // For each class, create an edge to its containing file
    for (const element of elements) {
      if (element.type === 'class') {
        const fileIdentifier = this.getFileFromIdentifier(element.stableIdentifier);
        const fileElement = elements.find(e => 
          e.type === 'file' && 
          this.getFileFromIdentifier(e.stableIdentifier) === fileIdentifier
        );
        
        if (fileElement) {
          edges.push({
            source: fileElement.elementId,
            target: element.elementId,
            type: 'contains'
          });
        }
      }
    }
    
    // Add decision record information to nodes
    for (const node of nodes) {
      if (node.elementId) {
        const version = await this.getLatestElementVersion(node.elementId);
        if (version) {
          const decisions = await this.getLinkedDecisions(version.versionId);
          node.hasDecisions = decisions.length > 0;
        }
      }
    }
    
    return {
      nodes,
      edges
    };
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
      // Only process files that can be parsed
      if (!this.codeParserService.canParseFile(filePath)) {
        continue;
      }
      
      // Get the full path to the file
      const fullPath = `${repoPath}/${filePath}`;
      
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
    }
  }

  /**
   * Get previous versions of a code element before a specific commit
   * @param _elementId Element ID
   * @param _commitHash Commit hash
   */
  private async getPreviousVersions(_elementId: string, _commitHash: string): Promise<CodeElementVersion[]> {
    // In a real implementation, we would query the database for versions
    // of this element with commit timestamps before the current commit
    // For simplicity, we'll return an empty array
    return [];
  }

  /**
   * Get all code elements for a repository
   * @param _repoId Repository ID
   */
  private async getCodeElementsForRepo(_repoId: string): Promise<CodeElement[]> {
    // In a real implementation, we would query the database for all code elements
    // in the repository. For simplicity, we'll return an empty array.
    return [];
  }

  /**
   * Execute a Git command
   * @param _command Git command to execute
   * @param _cwd Working directory
   */
  private async execGitCommand(_command: string, _cwd: string): Promise<{stdout: string, stderr: string}> {
    // In a real implementation, we would use child_process.exec
    // For simplicity, we'll return empty strings
    return { stdout: '', stderr: '' };
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
