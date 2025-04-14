import * as crypto from 'crypto';
import { IDecisionRecordService } from './IDecisionRecordService';
import { IPersistenceService } from '../persistence/IPersistenceService';
import { DecisionRecord } from '../models/types';

/**
 * Implementation of IDecisionRecordService for managing decision records
 */
export class DecisionRecordService implements IDecisionRecordService {
  constructor(private persistenceService: IPersistenceService) {}

  /**
   * Create a new decision record
   * @param title Title of the decision
   * @param content Content describing the decision
   * @param repoId Repository ID
   * @param authorDevId Optional ID of the author
   */
  async createDecisionRecord(
    title: string, 
    content: string, 
    repoId: string, 
    authorDevId?: string
  ): Promise<DecisionRecord> {
    // Generate a unique ID for the decision record
    const decisionId = this.generateDecisionId(repoId, title);
    
    // Create the decision record
    const decision: DecisionRecord = {
      decisionId,
      repoId,
      title,
      content,
      createdAt: Date.now(),
      authorDevId
    };
    
    // Save the decision record
    await this.persistenceService.saveDecisionRecord(decision);
    
    return decision;
  }

  /**
   * Link a decision record to a code element version
   * @param decisionId ID of the decision record
   * @param versionId ID of the code element version
   */
  async linkDecisionToCodeVersion(decisionId: string, versionId: string): Promise<void> {
    await this.persistenceService.linkDecisionToCodeVersion(decisionId, versionId);
  }

  /**
   * Get all decision records for a repository
   * @param repoId Repository ID
   */
  async getDecisionRecords(repoId: string): Promise<DecisionRecord[]> {
    // For V1, we'll implement a simple approach - we don't have a direct method
    // to get all decisions for a repo, so we'll return an empty array
    // This is consistent with our minimal V1 implementation approach
    console.log(`Getting decision records for repository ${repoId}`);
    return [];
  }

  /**
   * Get a specific decision record
   * @param decisionId ID of the decision record
   */
  async getDecisionRecord(decisionId: string): Promise<DecisionRecord | null> {
    return this.persistenceService.getDecisionRecord(decisionId);
  }

  /**
   * Generate a deterministic decision ID
   * @param repoId Repository ID
   * @param title Decision title
   */
  private generateDecisionId(repoId: string, title: string): string {
    return crypto.createHash('sha256').update(`${repoId}:decision:${title}`).digest('hex').substring(0, 16);
  }
}
