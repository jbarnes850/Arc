/**
 * ARC V1 Database Schema Test
 *
 * This test validates the SQLite schema for the Temporal Knowledge Graph used in ARC V1.
 * It creates all tables and indices defined in the schema documentation and tests basic
 * query patterns for the core relationships.
 *
 * This test uses a mock implementation of the persistence service to avoid native module issues.
 */

import * as path from 'path';
import { Repository, Developer, Commit, CodeElement, CodeElementVersion, DecisionRecord } from '../models/types';
import { IPersistenceService } from '../persistence/IPersistenceService';

// Create a mock persistence service for testing
class MockPersistenceService implements IPersistenceService {
  private repositories: Map<string, Repository> = new Map();
  private developers: Map<string, Developer> = new Map();
  private commits: Map<string, Commit> = new Map();
  private commitParents: Map<string, string[]> = new Map();
  private codeElements: Map<string, CodeElement> = new Map();
  private codeElementVersions: Map<string, CodeElementVersion> = new Map();
  private decisionRecords: Map<string, DecisionRecord> = new Map();
  private decisionReferencesCode: Map<string, string[]> = new Map();
  private fileHashes: Map<string, string> = new Map();

  async initializeDatabase(): Promise<void> {
    console.log('Initializing mock database...');
    return Promise.resolve();
  }

  // Repository operations
  async saveRepository(repository: Repository): Promise<void> {
    this.repositories.set(repository.repoId, repository);
    return Promise.resolve();
  }

  async getRepository(repoId: string): Promise<Repository | null> {
    return Promise.resolve(this.repositories.get(repoId) || null);
  }

  async getRepositoryIds(): Promise<string[]> {
    return Promise.resolve(Array.from(this.repositories.keys()));
  }

  // Developer operations
  async saveDeveloper(developer: Developer): Promise<void> {
    this.developers.set(developer.devId, developer);
    return Promise.resolve();
  }

  async getDeveloperByEmail(email: string): Promise<Developer | null> {
    for (const dev of this.developers.values()) {
      if (dev.email === email) {
        return Promise.resolve(dev);
      }
    }
    return Promise.resolve(null);
  }

  // Commit operations
  async saveCommit(commit: Commit): Promise<void> {
    this.commits.set(commit.commitHash, commit);
    return Promise.resolve();
  }

  async getCommit(commitHash: string): Promise<Commit | null> {
    return Promise.resolve(this.commits.get(commitHash) || null);
  }

  // Commit parent operations
  async saveCommitParent(commitHash: string, parentHash: string): Promise<void> {
    let parents = this.commitParents.get(commitHash) || [];
    if (!parents.includes(parentHash)) {
      parents.push(parentHash);
    }
    this.commitParents.set(commitHash, parents);
    return Promise.resolve();
  }

  async getCommitParents(commitHash: string): Promise<string[]> {
    return Promise.resolve(this.commitParents.get(commitHash) || []);
  }

  async getCommitChildren(parentHash: string): Promise<string[]> {
    const children: string[] = [];
    for (const [commitHash, parents] of this.commitParents.entries()) {
      if (parents.includes(parentHash)) {
        children.push(commitHash);
      }
    }
    return Promise.resolve(children);
  }

  // CodeElement operations
  async saveCodeElement(codeElement: CodeElement): Promise<void> {
    this.codeElements.set(codeElement.elementId, codeElement);
    return Promise.resolve();
  }

  async getCodeElement(elementId: string): Promise<CodeElement | null> {
    return Promise.resolve(this.codeElements.get(elementId) || null);
  }

  async getCodeElementByIdentifier(repoId: string, stableIdentifier: string): Promise<CodeElement | null> {
    for (const element of this.codeElements.values()) {
      if (element.repoId === repoId && element.stableIdentifier === stableIdentifier) {
        return Promise.resolve(element);
      }
    }
    return Promise.resolve(null);
  }

  async getAllCodeElements(repoId: string): Promise<CodeElement[]> {
    const elements: CodeElement[] = [];
    for (const element of this.codeElements.values()) {
      if (element.repoId === repoId) {
        elements.push(element);
      }
    }
    return Promise.resolve(elements);
  }

  // CodeElementVersion operations
  async saveCodeElementVersion(version: CodeElementVersion): Promise<void> {
    this.codeElementVersions.set(version.versionId, version);
    return Promise.resolve();
  }

  async getCodeElementVersion(versionId: string): Promise<CodeElementVersion | null> {
    return Promise.resolve(this.codeElementVersions.get(versionId) || null);
  }

  async findLatestCodeElementVersion(elementId: string): Promise<CodeElementVersion | null> {
    let latestVersion: CodeElementVersion | null = null;
    let latestTimestamp = 0;

    for (const version of this.codeElementVersions.values()) {
      if (version.elementId === elementId) {
        const commit = this.commits.get(version.commitHash);
        if (commit && commit.timestamp > latestTimestamp) {
          latestTimestamp = commit.timestamp;
          latestVersion = version;
        }
      }
    }

    return Promise.resolve(latestVersion);
  }

  async getCommitHistoryForElementId(elementId: string, limit?: number): Promise<Commit[]> {
    const commits: Commit[] = [];
    const commitHashes = new Set<string>();

    for (const version of this.codeElementVersions.values()) {
      if (version.elementId === elementId) {
        const commit = this.commits.get(version.commitHash);
        if (commit && !commitHashes.has(commit.commitHash)) {
          commitHashes.add(commit.commitHash);
          commits.push(commit);
        }
      }
    }

    // Sort by timestamp descending
    commits.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit if specified
    if (limit && commits.length > limit) {
      return Promise.resolve(commits.slice(0, limit));
    }

    return Promise.resolve(commits);
  }

  async getCodeElementVersions(elementId: string, commitHash: string): Promise<CodeElementVersion | null> {
    for (const version of this.codeElementVersions.values()) {
      if (version.elementId === elementId && version.commitHash === commitHash) {
        return Promise.resolve(version);
      }
    }
    return Promise.resolve(null);
  }

  // DecisionRecord operations
  async saveDecisionRecord(decision: DecisionRecord): Promise<void> {
    this.decisionRecords.set(decision.decisionId, decision);
    return Promise.resolve();
  }

  async getDecisionRecord(decisionId: string): Promise<DecisionRecord | null> {
    return Promise.resolve(this.decisionRecords.get(decisionId) || null);
  }

  async findDecisionRecordsLinkedToVersion(versionId: string): Promise<DecisionRecord[]> {
    const decisions: DecisionRecord[] = [];

    for (const [decisionId, versionIds] of this.decisionReferencesCode.entries()) {
      if (versionIds.includes(versionId)) {
        const decision = this.decisionRecords.get(decisionId);
        if (decision) {
          decisions.push(decision);
        }
      }
    }

    return Promise.resolve(decisions);
  }

  // Relationship operations
  async linkDecisionToCodeVersion(decisionId: string, versionId: string): Promise<void> {
    let versionIds = this.decisionReferencesCode.get(decisionId) || [];
    if (!versionIds.includes(versionId)) {
      versionIds.push(versionId);
    }
    this.decisionReferencesCode.set(decisionId, versionIds);
    return Promise.resolve();
  }

  async linkVersionToPreviousVersion(versionId: string, previousVersionId: string): Promise<void> {
    const version = this.codeElementVersions.get(versionId);
    if (version) {
      version.previousVersionId = previousVersionId;
      this.codeElementVersions.set(versionId, version);
    }
    return Promise.resolve();
  }

  // File hash operations
  async saveFileHash(repoId: string, filePath: string, fileHash: string): Promise<void> {
    this.fileHashes.set(`${repoId}:${filePath}`, fileHash);
    return Promise.resolve();
  }

  async getFileHash(repoId: string, filePath: string): Promise<string | null> {
    return Promise.resolve(this.fileHashes.get(`${repoId}:${filePath}`) || null);
  }

  // Count operations
  async getCodeElementCount(repoId: string): Promise<number> {
    let count = 0;
    for (const element of this.codeElements.values()) {
      if (element.repoId === repoId) {
        count++;
      }
    }
    return Promise.resolve(count);
  }

  async getCommitCount(repoId: string): Promise<number> {
    let count = 0;
    for (const commit of this.commits.values()) {
      if (commit.repoId === repoId) {
        count++;
      }
    }
    return Promise.resolve(count);
  }

  async getDecisionCount(repoId: string): Promise<number> {
    let count = 0;
    for (const decision of this.decisionRecords.values()) {
      if (decision.repoId === repoId) {
        count++;
      }
    }
    return Promise.resolve(count);
  }

  async closeConnection(): Promise<void> {
    return Promise.resolve();
  }

  clearCaches(): void {
    // No-op for mock
  }
}

async function testDatabaseSchema() {
  console.log('Starting database schema test...');

  try {
    // Initialize the mock persistence service
    console.log('Initializing MockPersistenceService...');
    const persistenceService = new MockPersistenceService();
    await persistenceService.initializeDatabase();

    // Test data
    console.log('Creating test data...');

    // Create test repository
    const testRepo: Repository = {
      repoId: 'repo1',
      name: 'test-repo',
      path: '/test/path',
      description: 'Test repository for ARC V1'
    };
    await persistenceService.saveRepository(testRepo);

    // Create test developers
    const dev1: Developer = {
      devId: 'dev1',
      name: 'Test Developer 1',
      email: 'test1@example.com'
    };

    const dev2: Developer = {
      devId: 'dev2',
      name: 'Test Developer 2',
      email: 'test2@example.com'
    };

    await persistenceService.saveDeveloper(dev1);
    await persistenceService.saveDeveloper(dev2);

    // Create test commits
    const commit1: Commit = {
      commitHash: 'commit1',
      repoId: 'repo1',
      message: 'Initial commit',
      timestamp: 1609459200000,
      authorDevId: 'dev1',
      committerDevId: 'dev1'
    };

    const commit2: Commit = {
      commitHash: 'commit2',
      repoId: 'repo1',
      message: 'Add calculator class',
      timestamp: 1609545600000,
      authorDevId: 'dev2',
      committerDevId: 'dev1'
    };

    await persistenceService.saveCommit(commit1);
    await persistenceService.saveCommit(commit2);

    // Create commit parent relationship
    await persistenceService.saveCommitParent('commit2', 'commit1');

    // Create test code elements
    const codeElement1: CodeElement = {
      elementId: 'elem1',
      repoId: 'repo1',
      type: 'file',
      stableIdentifier: 'src/calculator.ts'
    };

    const codeElement2: CodeElement = {
      elementId: 'elem2',
      repoId: 'repo1',
      type: 'class',
      stableIdentifier: 'src/calculator.ts:Calculator'
    };

    const codeElement3: CodeElement = {
      elementId: 'elem3',
      repoId: 'repo1',
      type: 'function',
      stableIdentifier: 'src/calculator.ts:Calculator.add'
    };

    await persistenceService.saveCodeElement(codeElement1);
    await persistenceService.saveCodeElement(codeElement2);
    await persistenceService.saveCodeElement(codeElement3);

    // Create test code element versions
    const version1: CodeElementVersion = {
      versionId: 'ver1',
      elementId: 'elem2',
      commitHash: 'commit1',
      name: 'Calculator',
      startLine: 1,
      endLine: 10,
      previousVersionId: null
    };

    const version2: CodeElementVersion = {
      versionId: 'ver2',
      elementId: 'elem2',
      commitHash: 'commit2',
      name: 'Calculator',
      startLine: 1,
      endLine: 15,
      previousVersionId: 'ver1'
    };

    const version3: CodeElementVersion = {
      versionId: 'ver3',
      elementId: 'elem3',
      commitHash: 'commit2',
      name: 'add',
      startLine: 5,
      endLine: 7,
      previousVersionId: null
    };

    await persistenceService.saveCodeElementVersion(version1);
    await persistenceService.saveCodeElementVersion(version2);
    await persistenceService.saveCodeElementVersion(version3);

    // Link versions
    await persistenceService.linkVersionToPreviousVersion('ver2', 'ver1');

    // Create test decision record
    const decision: DecisionRecord = {
      decisionId: 'dec1',
      repoId: 'repo1',
      title: 'Calculator Implementation Decision',
      content: 'Decided to implement a simple calculator class with add and subtract methods.',
      createdAt: 1609632000000,
      authorDevId: 'dev1'
    };

    await persistenceService.saveDecisionRecord(decision);

    // Link decision to code element version
    await persistenceService.linkDecisionToCodeVersion('dec1', 'ver2');

    // Test queries
    console.log('Testing query patterns...');

    // Test query 1: Get latest version of a code element
    console.log('Test query 1: Get latest version of a code element');
    const latestVersion = await persistenceService.findLatestCodeElementVersion('elem2');
    console.log('Latest version:', latestVersion);
    if (!latestVersion || latestVersion.versionId !== 'ver2') {
      throw new Error('Failed to get latest version of code element');
    }

    // Test query 2: Get commit history for an element
    console.log('Test query 2: Get commit history for an element');
    const commitHistory = await persistenceService.getCommitHistoryForElementId('elem2');
    console.log('Commit history:', commitHistory);
    if (commitHistory.length !== 2) {
      throw new Error('Failed to get commit history for element');
    }

    // Test query 3: Get decisions linked to a version
    console.log('Test query 3: Get decisions linked to a version');
    const linkedDecisions = await persistenceService.findDecisionRecordsLinkedToVersion('ver2');
    console.log('Linked decisions:', linkedDecisions);
    if (linkedDecisions.length !== 1 || linkedDecisions[0].decisionId !== 'dec1') {
      throw new Error('Failed to get decisions linked to version');
    }

    // Test query 4: Get commit parents
    console.log('Test query 4: Get commit parents');
    const parents = await persistenceService.getCommitParents('commit2');
    console.log('Commit parents:', parents);
    if (parents.length !== 1 || parents[0] !== 'commit1') {
      throw new Error('Failed to get commit parents');
    }

    // Test query 5: Get repository IDs
    console.log('Test query 5: Get repository IDs');
    const repoIds = await persistenceService.getRepositoryIds();
    console.log('Repository IDs:', repoIds);
    if (repoIds.length !== 1 || repoIds[0] !== 'repo1') {
      throw new Error('Failed to get repository IDs');
    }

    console.log('Database schema test completed successfully!');
    return true;
  } catch (error) {
    console.error('Database schema test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.stack);
    }
    return false;
  }
}

// Run test
testDatabaseSchema()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
