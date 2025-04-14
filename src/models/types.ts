/**
 * Core data models for the ARC Temporal Knowledge Graph
 */

export interface Developer {
  devId: string;
  name?: string;
  email: string;
}

export interface Repository {
  repoId: string;
  path: string;
  name: string;
}

export interface Commit {
  commitHash: string;
  message: string;
  timestamp: number;
  authorDevId: string;
  committerDevId: string;
}

export interface CodeElement {
  elementId: string;
  repoId: string;
  type: 'file' | 'class' | 'function';
  stableIdentifier: string;
}

export interface CodeElementVersion {
  versionId: string;
  elementId: string;
  commitHash: string;
  name?: string;
  startLine?: number;
  endLine?: number;
  previousVersionId?: string | null;
}

export interface DecisionRecord {
  decisionId: string;
  repoId: string;
  title: string;
  content: string;
  createdAt: number;
  authorDevId?: string;
}

// Relationship types for the Temporal Knowledge Graph
export enum RelationshipType {
  MODIFIES = 'MODIFIES',     // Commit -> CodeElementVersion
  PRECEDES = 'PRECEDES',     // CodeElementVersion -> CodeElementVersion
  AUTHORS = 'AUTHORS',       // Developer -> Commit or Developer -> DecisionRecord
  REFERENCES = 'REFERENCES'  // DecisionRecord -> CodeElementVersion
}
