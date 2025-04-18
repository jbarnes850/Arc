import { Commit, CodeElement, CodeElementVersion, DecisionRecord } from '../models/types';

/**
 * Interface for Knowledge Graph operations and queries
 */
export interface IKnowledgeGraphService {
  /**
   * Get the commit history for a code element
   * @param elementId ID of the code element
   * @param limit Maximum number of commits to return
   */
  getElementCommitHistory(elementId: string, limit?: number): Promise<Commit[]>;

  /**
   * Get decisions linked to a specific code element version
   * @param versionId ID of the code element version
   */
  getLinkedDecisions(versionId: string): Promise<DecisionRecord[]>;

  /**
   * Get the latest version of a code element
   * @param elementId ID of the code element
   */
  getLatestElementVersion(elementId: string): Promise<CodeElementVersion | null>;

  /**
   * Get data for generating an architecture diagram
   * @param repoId ID of the repository
   */
  getArchitectureDiagramData(repoId: string): Promise<any>;

  /**
   * Trace the history of a code element through all its versions
   * @param elementId Element ID
   */
  traceElementHistory(elementId: string): Promise<CodeElementVersion[]>;

  /**
   * Link a decision record to a code element version
   * @param decisionId Decision record ID
   * @param elementId Code element ID
   */
  linkDecisionToElement(decisionId: string, elementId: string): Promise<void>;

  /**
   * Get all code elements modified by a specific commit
   * @param commitHash Commit hash
   */
  getElementsModifiedByCommit(commitHash: string): Promise<CodeElement[]>;

  /**
   * Process a commit to update the knowledge graph
   * @param repoPath Path to the repository
   * @param repoId Repository ID
   * @param commitHash Commit hash
   */
  processCommit(repoPath: string, repoId: string, commitHash: string): Promise<void>;
}
