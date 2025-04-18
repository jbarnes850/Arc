import {
  Developer,
  Repository,
  Commit,
  CodeElement,
  CodeElementVersion,
  DecisionRecord
} from '../models/types';

/**
 * Interface for database operations to persist and retrieve Knowledge Graph entities
 */
export interface IPersistenceService {
  // Repository operations
  saveRepository(repository: Repository): Promise<void>;
  getRepository(repoId: string): Promise<Repository | null>;
  getRepositoryIds(): Promise<string[]>;

  // Developer operations
  saveDeveloper(developer: Developer): Promise<void>;
  getDeveloperByEmail(email: string): Promise<Developer | null>;

  // Commit operations
  saveCommit(commit: Commit): Promise<void>;
  getCommit(commitHash: string): Promise<Commit | null>;

  // Commit parent operations
  saveCommitParent(commitHash: string, parentHash: string): Promise<void>;
  getCommitParents(commitHash: string): Promise<string[]>;
  getCommitChildren(parentHash: string): Promise<string[]>;

  // CodeElement operations
  saveCodeElement(codeElement: CodeElement): Promise<void>;
  getCodeElement(elementId: string): Promise<CodeElement | null>;
  getCodeElementByIdentifier(repoId: string, stableIdentifier: string): Promise<CodeElement | null>;
  /**
   * List all code elements in a repository
   * @param repoId Repository ID
   */
  getAllCodeElements(repoId: string): Promise<CodeElement[]>;

  // CodeElementVersion operations
  saveCodeElementVersion(version: CodeElementVersion): Promise<void>;
  getCodeElementVersion(versionId: string): Promise<CodeElementVersion | null>;
  findLatestCodeElementVersion(elementId: string): Promise<CodeElementVersion | null>;
  getCommitHistoryForElementId(elementId: string, limit?: number): Promise<Commit[]>;
  getCodeElementVersions(elementId: string, commitHash: string): Promise<CodeElementVersion | null>;

  // DecisionRecord operations
  saveDecisionRecord(decision: DecisionRecord): Promise<void>;
  getDecisionRecord(decisionId: string): Promise<DecisionRecord | null>;
  findDecisionRecordsLinkedToVersion(versionId: string): Promise<DecisionRecord[]>;

  // Relationship operations
  linkDecisionToCodeVersion(decisionId: string, versionId: string): Promise<void>;
  linkVersionToPreviousVersion(versionId: string, previousVersionId: string): Promise<void>;

  // File-hash cache operations
  saveFileHash(repoId: string, filePath: string, fileHash: string): Promise<void>;
  getFileHash(repoId: string, filePath: string): Promise<string | null>;

  // Database initialization
  initializeDatabase(): Promise<void>;

  // Count operations
  getCodeElementCount(repoId: string): Promise<number>;
  getCommitCount(repoId: string): Promise<number>;
  getDecisionCount(repoId: string): Promise<number>;

  // Connection management
  closeConnection(): Promise<void>;
  clearCaches(): void;
}
