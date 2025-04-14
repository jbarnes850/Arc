import { DecisionRecord } from '../models/types';

/**
 * Interface for decision record management
 */
export interface IDecisionRecordService {
  /**
   * Create a new decision record
   * @param title Title of the decision
   * @param content Content describing the decision
   * @param repoId Repository ID
   * @param authorDevId Optional ID of the author
   */
  createDecisionRecord(
    title: string, 
    content: string, 
    repoId: string, 
    authorDevId?: string
  ): Promise<DecisionRecord>;
  
  /**
   * Link a decision record to a code element version
   * @param decisionId ID of the decision record
   * @param versionId ID of the code element version
   */
  linkDecisionToCodeVersion(decisionId: string, versionId: string): Promise<void>;
  
  /**
   * Get all decision records for a repository
   * @param repoId Repository ID
   */
  getDecisionRecords(repoId: string): Promise<DecisionRecord[]>;
  
  /**
   * Get a specific decision record
   * @param decisionId ID of the decision record
   */
  getDecisionRecord(decisionId: string): Promise<DecisionRecord | null>;
}
