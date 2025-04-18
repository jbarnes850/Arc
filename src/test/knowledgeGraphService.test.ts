/**
 * ARC V1 Knowledge Graph Service Test
 * 
 * This test validates the KnowledgeGraphService implementation, which is the core
 * service for the Temporal Knowledge Graph used in ARC V1.
 */

import * as assert from 'assert';
import * as path from 'path';
import { KnowledgeGraphService } from '../services/KnowledgeGraphService';
import { IPersistenceService } from '../persistence/IPersistenceService';
import { ICodeParserService } from '../indexing/ICodeParserService';
import { IGitHubIntegrationService } from '../integration/IGitHubIntegrationService';
import { Repository, Developer, Commit, CodeElement, CodeElementVersion, DecisionRecord } from '../models/types';

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
}

// Create a mock code parser service for testing
class MockCodeParserService implements ICodeParserService {
  async parseFile(filePath: string, repoId: string): Promise<CodeElement[]> {
    // Return a simple code element for testing
    return [
      {
        elementId: `elem-${filePath}-1`,
        repoId,
        type: 'class',
        stableIdentifier: `${filePath}:TestClass`
      },
      {
        elementId: `elem-${filePath}-2`,
        repoId,
        type: 'function',
        stableIdentifier: `${filePath}:TestClass.testMethod`
      }
    ];
  }

  async initializeParser(language: 'typescript' | 'python'): Promise<void> {
    return Promise.resolve();
  }

  canParseFile(filePath: string): boolean {
    return filePath.endsWith('.ts') || filePath.endsWith('.py');
  }
}

// Create a mock GitHub integration service for testing
class MockGitHubIntegrationService implements IGitHubIntegrationService {
  async indexCommitHistory(repoPath: string, repoId: string): Promise<void> {
    return Promise.resolve();
  }

  async getCommitsForFile(repoPath: string, filePath: string, limit?: number): Promise<Commit[]> {
    return [
      {
        commitHash: 'commit1',
        repoId: 'repo1',
        message: 'Initial commit',
        timestamp: 1609459200000,
        authorDevId: 'dev1',
        committerDevId: 'dev1'
      },
      {
        commitHash: 'commit2',
        repoId: 'repo1',
        message: 'Update file',
        timestamp: 1609545600000,
        authorDevId: 'dev2',
        committerDevId: 'dev1'
      }
    ];
  }

  async getCommit(repoPath: string, commitHash: string): Promise<Commit | null> {
    if (commitHash === 'commit1') {
      return {
        commitHash: 'commit1',
        repoId: 'repo1',
        message: 'Initial commit',
        timestamp: 1609459200000,
        authorDevId: 'dev1',
        committerDevId: 'dev1'
      };
    } else if (commitHash === 'commit2') {
      return {
        commitHash: 'commit2',
        repoId: 'repo1',
        message: 'Update file',
        timestamp: 1609545600000,
        authorDevId: 'dev2',
        committerDevId: 'dev1'
      };
    }
    return null;
  }

  async getDeveloperByEmail(email: string): Promise<Developer | null> {
    return null;
  }
}

suite('KnowledgeGraphService Test Suite', () => {
  let persistenceService: IPersistenceService;
  let codeParserService: ICodeParserService;
  let gitService: IGitHubIntegrationService;
  let knowledgeGraphService: KnowledgeGraphService;
  const testRepoId = 'repo1';
  const testRepoPath = '/test/path';

  setup(async () => {
    // Initialize services with mocks
    persistenceService = new MockPersistenceService();
    codeParserService = new MockCodeParserService();
    gitService = new MockGitHubIntegrationService();
    knowledgeGraphService = new KnowledgeGraphService(
      persistenceService,
      codeParserService,
      gitService,
      false // disable file cache for testing
    );

    // Set up test data
    await persistenceService.saveRepository({
      repoId: testRepoId,
      name: 'Test Repository',
      path: testRepoPath
    });

    // Save test developers
    await persistenceService.saveDeveloper({
      devId: 'dev1',
      name: 'Test Developer 1',
      email: 'test1@example.com'
    });

    await persistenceService.saveDeveloper({
      devId: 'dev2',
      name: 'Test Developer 2',
      email: 'test2@example.com'
    });

    // Save test commits
    await persistenceService.saveCommit({
      commitHash: 'commit1',
      repoId: testRepoId,
      message: 'Initial commit',
      timestamp: 1609459200000,
      authorDevId: 'dev1',
      committerDevId: 'dev1'
    });

    await persistenceService.saveCommit({
      commitHash: 'commit2',
      repoId: testRepoId,
      message: 'Update file',
      timestamp: 1609545600000,
      authorDevId: 'dev2',
      committerDevId: 'dev1'
    });

    // Save commit parent relationship
    await persistenceService.saveCommitParent('commit2', 'commit1');

    // Save test code elements
    const codeElement1: CodeElement = {
      elementId: 'elem1',
      repoId: testRepoId,
      type: 'file',
      stableIdentifier: 'src/calculator.ts'
    };

    const codeElement2: CodeElement = {
      elementId: 'elem2',
      repoId: testRepoId,
      type: 'class',
      stableIdentifier: 'src/calculator.ts:Calculator'
    };

    await persistenceService.saveCodeElement(codeElement1);
    await persistenceService.saveCodeElement(codeElement2);

    // Save test code element versions
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

    await persistenceService.saveCodeElementVersion(version1);
    await persistenceService.saveCodeElementVersion(version2);

    // Link versions
    await persistenceService.linkVersionToPreviousVersion('ver2', 'ver1');

    // Save test decision record
    const decision: DecisionRecord = {
      decisionId: 'dec1',
      repoId: testRepoId,
      title: 'Calculator Implementation Decision',
      content: 'Decided to implement a simple calculator class with add and subtract methods.',
      createdAt: 1609632000000,
      authorDevId: 'dev1'
    };

    await persistenceService.saveDecisionRecord(decision);

    // Link decision to code element version
    await persistenceService.linkDecisionToCodeVersion('dec1', 'ver2');
  });

  test('Should get element commit history', async () => {
    const commits = await knowledgeGraphService.getElementCommitHistory('elem2');
    assert.strictEqual(commits.length, 2, 'Should return 2 commits');
    assert.strictEqual(commits[0].commitHash, 'commit2', 'First commit should be commit2');
    assert.strictEqual(commits[1].commitHash, 'commit1', 'Second commit should be commit1');
  });

  test('Should get linked decisions', async () => {
    const decisions = await knowledgeGraphService.getLinkedDecisions('ver2');
    assert.strictEqual(decisions.length, 1, 'Should return 1 decision');
    assert.strictEqual(decisions[0].decisionId, 'dec1', 'Decision ID should be dec1');
  });

  test('Should get latest element version', async () => {
    const version = await knowledgeGraphService.getLatestElementVersion('elem2');
    assert.ok(version, 'Should return a version');
    assert.strictEqual(version?.versionId, 'ver2', 'Latest version should be ver2');
  });

  test('Should trace element history', async () => {
    const history = await knowledgeGraphService.traceElementHistory('elem2');
    assert.strictEqual(history.length, 2, 'Should return 2 versions');
    assert.strictEqual(history[0].versionId, 'ver2', 'First version should be ver2');
    assert.strictEqual(history[1].versionId, 'ver1', 'Second version should be ver1');
  });

  test('Should link decision to element', async () => {
    // Create a new decision
    const decision: DecisionRecord = {
      decisionId: 'dec2',
      repoId: testRepoId,
      title: 'Another Decision',
      content: 'Another decision about the calculator.',
      createdAt: 1609718400000,
      authorDevId: 'dev2'
    };

    await persistenceService.saveDecisionRecord(decision);

    // Link the decision to the element
    await knowledgeGraphService.linkDecisionToElement('dec2', 'elem2');

    // Verify the decision was linked to the latest version
    const decisions = await knowledgeGraphService.getLinkedDecisions('ver2');
    assert.strictEqual(decisions.length, 2, 'Should return 2 decisions');
    assert.ok(decisions.some(d => d.decisionId === 'dec2'), 'Should include dec2');
  });

  test('Should get elements modified by commit', async () => {
    const elements = await knowledgeGraphService.getElementsModifiedByCommit('commit2');
    assert.strictEqual(elements.length, 1, 'Should return 1 element');
    assert.strictEqual(elements[0].elementId, 'elem2', 'Element ID should be elem2');
  });

  test('Should get architecture diagram data', async () => {
    const diagramData = await knowledgeGraphService.getArchitectureDiagramData(testRepoId);
    assert.ok(diagramData.nodes, 'Should have nodes');
    assert.ok(diagramData.edges, 'Should have edges');
    assert.strictEqual(diagramData.nodes.length, 2, 'Should have 2 nodes');
    assert.strictEqual(diagramData.edges.length, 1, 'Should have 1 edge');
  });
});
