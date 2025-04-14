import { Commit, Developer } from '../models/types';

/**
 * Interface for Git/GitHub integration to extract commit history
 */
export interface IGitHubIntegrationService {
  /**
   * Index the commit history of a repository
   * @param repoPath Path to the local repository
   * @param repoId Unique identifier for the repository
   */
  indexCommitHistory(repoPath: string, repoId: string): Promise<void>;
  
  /**
   * Get commits for a specific file
   * @param repoPath Path to the local repository
   * @param filePath Path to the file relative to the repository root
   * @param limit Maximum number of commits to return
   */
  getCommitsForFile(repoPath: string, filePath: string, limit?: number): Promise<Commit[]>;
  
  /**
   * Get a specific commit by hash
   * @param repoPath Path to the local repository
   * @param commitHash The commit hash to retrieve
   */
  getCommit(repoPath: string, commitHash: string): Promise<Commit | null>;
  
  /**
   * Get a developer by email
   * @param email Developer's email address
   */
  getDeveloperByEmail(email: string): Promise<Developer | null>;
}
