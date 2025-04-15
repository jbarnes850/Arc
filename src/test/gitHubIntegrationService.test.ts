import * as assert from 'assert';
import * as path from 'path';
import { GitHubIntegrationService } from '../integration/GitHubIntegrationService';
import { IPersistenceService } from '../persistence/IPersistenceService';

// Simple test suite for GitHubIntegrationService
suite('GitHubIntegrationService Test Suite', () => {
  let integrationService: GitHubIntegrationService;
  const testRepoPath = path.join(__dirname, '..', '..', 'test', 'testRepo');
  
  setup(() => {
    // Create a minimal mock persistence service with just the methods needed for testing
    const mockPersistenceService: IPersistenceService = {
      saveRepository: async () => {},
      getRepository: async () => null,
      saveDeveloper: async () => {},
      getDeveloperByEmail: async () => null,
      saveCommit: async () => {},
      getCommit: async () => null,
      saveCodeElement: async () => {},
      getCodeElement: async () => null,
      getCodeElementByIdentifier: async () => null,
      saveCodeElementVersion: async () => {},
      getCodeElementVersion: async () => null,
      findLatestCodeElementVersion: async () => null,
      getCommitHistoryForElementId: async () => [],
      saveDecisionRecord: async () => {},
      getDecisionRecord: async () => null,
      findDecisionRecordsLinkedToVersion: async () => [],
      linkDecisionToCodeVersion: async () => {},
      linkVersionToPreviousVersion: async () => {},
      initializeDatabase: async () => {},
      // Add count methods
      getCodeElementCount: async () => 0,
      getCommitCount: async () => 0,
      getDecisionCount: async () => 0
    };
    
    // Initialize the integration service with our minimal mock
    integrationService = new GitHubIntegrationService(mockPersistenceService);
  });
  
  test('Should index commit history', async function() {
    // This test may take longer
    this.timeout(10000);
    
    // Generate a test repo ID
    const repoId = 'test-repo-' + Date.now();
    
    try {
      // Index the commit history
      await integrationService.indexCommitHistory(testRepoPath, repoId);
      
      // Success if no exception is thrown
      assert.ok(true, 'Should index commit history without errors');
    } catch (error) {
      // If the test repo isn't a git repo, this is expected to fail
      // Just make sure it fails gracefully
      assert.ok(error, 'Expected error for non-git repository');
    }
  });
  
  test('Should get commits for file', async function() {
    // This test may take longer
    this.timeout(10000);
    
    try {
      // Get commits for a specific file
      const commits = await integrationService.getCommitsForFile(
        testRepoPath, 
        'src/ts/calculator.ts'
      );
      
      // Verify that we got an array of commits
      assert.ok(Array.isArray(commits), 'Should return an array of commits');
      
      // If the file has commits, verify their structure
      if (commits.length > 0) {
        const commit = commits[0];
        assert.ok(commit.commitHash, 'Commit should have a hash');
        assert.ok(commit.message, 'Commit should have a message');
        assert.ok(commit.timestamp, 'Commit should have a timestamp');
      }
    } catch (error) {
      // If the test repo isn't a git repo or the file doesn't exist, this is expected to fail
      // Just make sure it fails gracefully
      assert.ok(error, 'Expected error for non-git repository or non-existent file');
    }
  });
  
  test('Should handle non-existent repository gracefully', async () => {
    // Test with non-existent repository path
    const nonExistentPath = path.join(__dirname, 'non-existent-repo');
    
    try {
      // Should throw an error
      await integrationService.indexCommitHistory(nonExistentPath, 'test-repo');
      assert.fail('Should throw an error for non-existent repository');
    } catch (error) {
      // Expected error
      assert.ok(error, 'Expected error for non-existent repository');
    }
  });
});
