/**
 * Mock SQLitePersistenceService Test
 *
 * This test validates the getRepositoryIds method using a mock implementation.
 */

import * as assert from 'assert';
import * as path from 'path';
import { IPersistenceService } from '../persistence/IPersistenceService';
import { Repository } from '../models/types';

suite('Repository IDs Test Suite', function() {
  // Mock implementation of IPersistenceService
  class MockPersistenceService implements IPersistenceService {
    private repositories: Map<string, Repository> = new Map();

    async initializeDatabase(): Promise<void> {
      return Promise.resolve();
    }

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

    // Implement other methods as needed for the test
    async saveDeveloper(): Promise<void> { return Promise.resolve(); }
    async getDeveloperByEmail(): Promise<any> { return Promise.resolve(null); }
    async saveCommit(): Promise<void> { return Promise.resolve(); }
    async getCommit(): Promise<any> { return Promise.resolve(null); }
    async saveCommitParent(): Promise<void> { return Promise.resolve(); }
    async getCommitParents(): Promise<string[]> { return Promise.resolve([]); }
    async getCommitChildren(): Promise<string[]> { return Promise.resolve([]); }
    async saveCodeElement(): Promise<void> { return Promise.resolve(); }
    async getCodeElement(): Promise<any> { return Promise.resolve(null); }
    async getCodeElementByIdentifier(): Promise<any> { return Promise.resolve(null); }
    async getAllCodeElements(): Promise<any[]> { return Promise.resolve([]); }
    async saveCodeElementVersion(): Promise<void> { return Promise.resolve(); }
    async getCodeElementVersion(): Promise<any> { return Promise.resolve(null); }
    async findLatestCodeElementVersion(): Promise<any> { return Promise.resolve(null); }
    async getCommitHistoryForElementId(): Promise<any[]> { return Promise.resolve([]); }
    async getCodeElementVersions(): Promise<any> { return Promise.resolve(null); }
    async saveDecisionRecord(): Promise<void> { return Promise.resolve(); }
    async getDecisionRecord(): Promise<any> { return Promise.resolve(null); }
    async findDecisionRecordsLinkedToVersion(): Promise<any[]> { return Promise.resolve([]); }
    async linkDecisionToCodeVersion(): Promise<void> { return Promise.resolve(); }
    async linkVersionToPreviousVersion(): Promise<void> { return Promise.resolve(); }
    async saveFileHash(): Promise<void> { return Promise.resolve(); }
    async getFileHash(): Promise<string | null> { return Promise.resolve(null); }
    async getCodeElementCount(): Promise<number> { return Promise.resolve(0); }
    async getCommitCount(): Promise<number> { return Promise.resolve(0); }
    async getDecisionCount(): Promise<number> { return Promise.resolve(0); }
    async closeConnection(): Promise<void> { return Promise.resolve(); }
  }

  // Test repository path
  const testRepoPath = path.join(__dirname, '..', '..', 'test', 'testRepo');
  const testRepoId = 'test-repo-' + Date.now();

  // Service instance
  let persistenceService: IPersistenceService;

  setup(async function() {
    // Create a new instance of MockPersistenceService
    persistenceService = new MockPersistenceService();

    // Initialize the service
    await persistenceService.initializeDatabase();

    // Create a test repository
    const testRepo: Repository = {
      repoId: testRepoId,
      name: 'Test Repository',
      path: testRepoPath
    };

    // Save the repository
    await persistenceService.saveRepository(testRepo);
  });

  test('Should save and retrieve repository', async function() {
    // Get the repository by ID
    const repo = await persistenceService.getRepository(testRepoId);

    // Verify the repository was saved correctly
    assert.ok(repo, 'Repository should exist');
    assert.strictEqual(repo?.repoId, testRepoId, 'Repository ID should match');
    assert.strictEqual(repo?.name, 'Test Repository', 'Repository name should match');
    assert.strictEqual(repo?.path, testRepoPath, 'Repository path should match');
  });

  test('Should get repository IDs', async function() {
    // Get all repository IDs
    const repoIds = await persistenceService.getRepositoryIds();

    // Verify the repository ID is in the list
    assert.ok(repoIds.includes(testRepoId), 'Repository ID should be in the list');

    // Add another repository
    const anotherRepoId = 'another-repo-' + Date.now();
    const anotherRepo: Repository = {
      repoId: anotherRepoId,
      name: 'Another Repository',
      path: '/path/to/another/repo'
    };

    // Save the repository
    await persistenceService.saveRepository(anotherRepo);

    // Get all repository IDs again
    const updatedRepoIds = await persistenceService.getRepositoryIds();

    // Verify both repository IDs are in the list
    assert.ok(updatedRepoIds.includes(testRepoId), 'First repository ID should be in the list');
    assert.ok(updatedRepoIds.includes(anotherRepoId), 'Second repository ID should be in the list');
    assert.strictEqual(updatedRepoIds.length, 2, 'There should be exactly 2 repositories');
  });

  test('Should handle empty repository list', async function() {
    // Create a new empty service
    const emptyService = new MockPersistenceService();

    // Initialize the service
    await emptyService.initializeDatabase();

    // Get all repository IDs
    const repoIds = await emptyService.getRepositoryIds();

    // Verify the list is empty
    assert.strictEqual(repoIds.length, 0, 'Repository ID list should be empty');
  });
});
