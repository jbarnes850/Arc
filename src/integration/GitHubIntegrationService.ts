import * as cp from 'child_process';
import * as util from 'util';
import * as crypto from 'crypto';
import * as path from 'path';
import { IGitHubIntegrationService } from './IGitHubIntegrationService';
import { IPersistenceService } from '../persistence/IPersistenceService';
import { Commit, Developer } from '../models/types';

/**
 * Implementation of IGitHubIntegrationService using Git CLI
 */
export class GitHubIntegrationService implements IGitHubIntegrationService {
  private execPromise = util.promisify(cp.exec);

  constructor(private persistenceService: IPersistenceService) {}

  /**
   * Index the commit history of a repository
   * @param repoPath Path to the local repository
   * @param repoId Unique identifier for the repository
   */
  async indexCommitHistory(repoPath: string, repoId: string): Promise<void> {
    try {
      // Get all commits in the repository
      const { stdout } = await this.execPromise(
        'git log --pretty=format:"%H|%an|%ae|%cn|%ce|%ct|%s" --no-merges',
        { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large repos
      );

      const commits = stdout.split('\n').filter(line => line.trim() !== '');

      // Process each commit
      for (const commitLine of commits) {
        const [
          hash,
          authorName,
          authorEmail,
          committerName,
          committerEmail,
          timestamp,
          message
        ] = commitLine.split('|');

        // Create or get developers
        const authorDevId = this.generateDevId(authorEmail);
        const committerDevId = this.generateDevId(committerEmail);

        // Save developers
        await this.persistenceService.saveDeveloper({
          devId: authorDevId,
          name: authorName,
          email: authorEmail
        });

        if (authorEmail !== committerEmail) {
          await this.persistenceService.saveDeveloper({
            devId: committerDevId,
            name: committerName,
            email: committerEmail
          });
        }

        // Save commit
        const commit: Commit = {
          commitHash: hash,
          repoId,
          message,
          timestamp: parseInt(timestamp, 10) * 1000, // Convert to milliseconds
          authorDevId,
          committerDevId
        };

        await this.persistenceService.saveCommit(commit);

        // Get changed files for this commit
        await this.processChangedFiles(repoPath, repoId, hash);
      }

      console.log(`Indexed ${commits.length} commits from repository`);
    } catch (error) {
      console.error(`Failed to index repository: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Process files changed in a commit
   * @param repoPath Path to the repository
   * @param repoId Repository ID
   * @param commitHash Commit hash
   */
  private async processChangedFiles(repoPath: string, repoId: string, commitHash: string): Promise<void> {
    try {
      // Get list of files changed in this commit
      const { stdout } = await this.execPromise(
        `git show --name-only --pretty=format: ${commitHash}`,
        { cwd: repoPath }
      );

      const changedFiles = stdout.split('\n').filter(line => line.trim() !== '');

      // Store the information about changed files
      // This will be used by the code parser to create CodeElement and CodeElementVersion entities
      // We're not implementing the full parsing logic here as that will be handled by the CodeParserService

      return;
    } catch (error) {
      console.error(`Error processing changed files for commit ${commitHash}:`, error);
    }
  }

  /**
   * Get commits for a specific file
   * @param repoPath Path to the local repository
   * @param filePath Path to the file relative to the repository root
   * @param limit Maximum number of commits to return
   */
  async getCommitsForFile(repoPath: string, filePath: string, limit?: number): Promise<Commit[]> {
    try {
      const limitArg = limit ? `-n ${limit}` : '';
      const { stdout } = await this.execPromise(
        `git log ${limitArg} --pretty=format:"%H|%an|%ae|%cn|%ce|%ct|%s" -- "${filePath}"`,
        { cwd: repoPath }
      );

      const commits: Commit[] = [];
      const commitLines = stdout.split('\n').filter(line => line.trim() !== '');

      for (const commitLine of commitLines) {
        const [
          hash,
          authorName,
          authorEmail,
          committerName,
          committerEmail,
          timestamp,
          message
        ] = commitLine.split('|');

        const authorDevId = this.generateDevId(authorEmail);
        const committerDevId = this.generateDevId(committerEmail);

        commits.push({
          commitHash: hash,
          repoId: this.extractRepoIdFromPath(repoPath),
          message,
          timestamp: parseInt(timestamp, 10) * 1000, // Convert to milliseconds
          authorDevId,
          committerDevId
        });
      }

      return commits;
    } catch (error) {
      console.error(`Error getting commits for file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Get a specific commit by hash
   * @param repoPath Path to the local repository
   * @param commitHash The commit hash to retrieve
   */
  async getCommit(repoPath: string, commitHash: string): Promise<Commit | null> {
    try {
      const { stdout } = await this.execPromise(
        `git show --pretty=format:"%H|%an|%ae|%cn|%ce|%ct|%s" --no-patch ${commitHash}`,
        { cwd: repoPath }
      );

      const commitLine = stdout.trim();
      if (!commitLine) {
        return null;
      }

      const [
        hash,
        authorName,
        authorEmail,
        committerName,
        committerEmail,
        timestamp,
        message
      ] = commitLine.split('|');

      const authorDevId = this.generateDevId(authorEmail);
      const committerDevId = this.generateDevId(committerEmail);

      return {
        commitHash: hash,
        repoId: this.extractRepoIdFromPath(repoPath),
        message,
        timestamp: parseInt(timestamp, 10) * 1000, // Convert to milliseconds
        authorDevId,
        committerDevId
      };
    } catch (error) {
      console.error(`Error getting commit ${commitHash}:`, error);
      return null;
    }
  }

  /**
   * Get a developer by email
   * @param email Developer's email address
   */
  async getDeveloperByEmail(email: string): Promise<Developer | null> {
    return this.persistenceService.getDeveloperByEmail(email);
  }

  /**
   * Generate a deterministic developer ID from an email
   * @param email Developer's email address
   */
  private generateDevId(email: string): string {
    return crypto.createHash('sha256').update(email).digest('hex').substring(0, 16);
  }

  /**
   * Extract a repository ID from a repository path
   * @param repoPath Path to the repository
   */
  private extractRepoIdFromPath(repoPath: string): string {
    // Extract the repository name from the path
    const repoName = path.basename(repoPath);
    // Generate a deterministic ID from the repository name
    return crypto.createHash('sha256').update(repoName).digest('hex').substring(0, 16);
  }
}
