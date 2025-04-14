import { Commit, CodeElementVersion, DecisionRecord } from '../models/types';

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
}
