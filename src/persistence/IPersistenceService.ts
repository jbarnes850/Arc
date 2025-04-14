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
  
  // Developer operations
  saveDeveloper(developer: Developer): Promise<void>;
  getDeveloperByEmail(email: string): Promise<Developer | null>;
  
  // Commit operations
  saveCommit(commit: Commit): Promise<void>;
  getCommit(commitHash: string): Promise<Commit | null>;
  
  // CodeElement operations
  saveCodeElement(codeElement: CodeElement): Promise<void>;
  getCodeElement(elementId: string): Promise<CodeElement | null>;
  getCodeElementByIdentifier(repoId: string, stableIdentifier: string): Promise<CodeElement | null>;
  
  // CodeElementVersion operations
  saveCodeElementVersion(version: CodeElementVersion): Promise<void>;
  getCodeElementVersion(versionId: string): Promise<CodeElementVersion | null>;
  findLatestCodeElementVersion(elementId: string): Promise<CodeElementVersion | null>;
  getCommitHistoryForElementId(elementId: string, limit?: number): Promise<Commit[]>;
  
  // DecisionRecord operations
  saveDecisionRecord(decision: DecisionRecord): Promise<void>;
  getDecisionRecord(decisionId: string): Promise<DecisionRecord | null>;
  findDecisionRecordsLinkedToVersion(versionId: string): Promise<DecisionRecord[]>;
  
  // Relationship operations
  linkDecisionToCodeVersion(decisionId: string, versionId: string): Promise<void>;
  linkVersionToPreviousVersion(versionId: string, previousVersionId: string): Promise<void>;
  
  // Database initialization
  initializeDatabase(): Promise<void>;
}
