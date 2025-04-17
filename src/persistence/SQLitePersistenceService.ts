import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import BetterSQLite3 from 'better-sqlite3';

import { 
  IPersistenceService 
} from './IPersistenceService';
import { 
  Developer, 
  Repository, 
  Commit, 
  CodeElement, 
  CodeElementVersion, 
  DecisionRecord 
} from '../models/types';

// Define SQLite error type to avoid 'any' type errors
type SQLiteError = {
  message: string;
  code?: string;
};

/**
 * SQLite implementation of the IPersistenceService
 */
export class SQLitePersistenceService implements IPersistenceService {
  // Using `any` to allow legacy run/get/all calls; will refactor to Statement API later
  private db: any = null;
  private dbPath: string;

  constructor(context: vscode.ExtensionContext) {
    // Store the database in the extension's global storage path
    this.dbPath = path.join(context.globalStorageUri.fsPath, 'arc-knowledge-graph.db');
    
    // Ensure the directory exists
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  /**
   * Initialize the database with the required schema
   */
  async initializeDatabase(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.db = new BetterSQLite3(this.dbPath) as any;
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('foreign_keys = ON');
        const schema = `
          -- Repositories table
          CREATE TABLE IF NOT EXISTS repositories (
            repo_id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            name TEXT NOT NULL
          );

          -- Developers table
          CREATE TABLE IF NOT EXISTS developers (
            dev_id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT NOT NULL UNIQUE
          );

          -- Commits table
          CREATE TABLE IF NOT EXISTS commits (
            commit_hash TEXT PRIMARY KEY,
            message TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            author_dev_id TEXT NOT NULL,
            committer_dev_id TEXT NOT NULL,
            FOREIGN KEY (author_dev_id) REFERENCES developers (dev_id),
            FOREIGN KEY (committer_dev_id) REFERENCES developers (dev_id)
          );

          -- Code elements table
          CREATE TABLE IF NOT EXISTS code_elements (
            element_id TEXT PRIMARY KEY,
            repo_id TEXT NOT NULL,
            type TEXT NOT NULL,
            stable_identifier TEXT NOT NULL,
            FOREIGN KEY (repo_id) REFERENCES repositories (repo_id),
            UNIQUE (repo_id, stable_identifier)
          );

          -- Code element versions table
          CREATE TABLE IF NOT EXISTS code_element_versions (
            version_id TEXT PRIMARY KEY,
            element_id TEXT NOT NULL,
            commit_hash TEXT NOT NULL,
            name TEXT,
            start_line INTEGER,
            end_line INTEGER,
            previous_version_id TEXT,
            FOREIGN KEY (element_id) REFERENCES code_elements (element_id),
            FOREIGN KEY (commit_hash) REFERENCES commits (commit_hash),
            FOREIGN KEY (previous_version_id) REFERENCES code_element_versions (version_id)
          );

          -- Decision records table
          CREATE TABLE IF NOT EXISTS decision_records (
            decision_id TEXT PRIMARY KEY,
            repo_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            author_dev_id TEXT,
            FOREIGN KEY (repo_id) REFERENCES repositories (repo_id),
            FOREIGN KEY (author_dev_id) REFERENCES developers (dev_id)
          );

          -- Decision references code table (for REFERENCES relationship)
          CREATE TABLE IF NOT EXISTS decision_references_code (
            decision_id TEXT NOT NULL,
            version_id TEXT NOT NULL,
            PRIMARY KEY (decision_id, version_id),
            FOREIGN KEY (decision_id) REFERENCES decision_records (decision_id),
            FOREIGN KEY (version_id) REFERENCES code_element_versions (version_id)
          );

          -- File hashes table
          CREATE TABLE IF NOT EXISTS file_hashes (
            repo_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            PRIMARY KEY (repo_id, file_path),
            FOREIGN KEY (repo_id) REFERENCES repositories(repo_id)
          );
          CREATE INDEX IF NOT EXISTS idx_file_hashes_repo_id ON file_hashes(repo_id);

          -- Create indexes for better query performance
          CREATE INDEX IF NOT EXISTS idx_code_elements_repo_id ON code_elements (repo_id);
          CREATE INDEX IF NOT EXISTS idx_code_element_versions_element_id ON code_element_versions (element_id);
          CREATE INDEX IF NOT EXISTS idx_code_element_versions_commit_hash ON code_element_versions (commit_hash);
          CREATE INDEX IF NOT EXISTS idx_decision_records_repo_id ON decision_records (repo_id);
        `;
        
        const batch = this.db.transaction(() => this.db.exec(schema));
        batch();
        console.log('Database initialized successfully');
        resolve();
      } catch (error) {
        console.error('Error initializing database:', error);
        reject(error);
      }
    });
  }

  // Repository operations
  async saveRepository(repository: Repository): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO repositories (repo_id, path, name)
        VALUES (?, ?, ?)
      `;

      this.db.run(sql, [repository.repoId, repository.path, repository.name], (err: SQLiteError) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async getRepository(repoId: string): Promise<Repository | null> {
    return new Promise<Repository | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM repositories WHERE repo_id = ?
      `;

      this.db.get(sql, [repoId], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          repoId: row.repo_id,
          path: row.path,
          name: row.name
        });
      });
    });
  }

  // Developer operations
  async saveDeveloper(developer: Developer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO developers (dev_id, name, email)
        VALUES (?, ?, ?)
      `;

      this.db.run(sql, [developer.devId, developer.name, developer.email], (err: SQLiteError) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async getDeveloperByEmail(email: string): Promise<Developer | null> {
    return new Promise<Developer | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM developers WHERE email = ?
      `;

      this.db.get(sql, [email], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          devId: row.dev_id,
          name: row.name,
          email: row.email
        });
      });
    });
  }

  // Commit operations
  async saveCommit(commit: Commit): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO commits (commit_hash, message, timestamp, author_dev_id, committer_dev_id)
        VALUES (?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          commit.commitHash,
          commit.message,
          commit.timestamp,
          commit.authorDevId,
          commit.committerDevId
        ],
        (err: SQLiteError) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async getCommit(commitHash: string): Promise<Commit | null> {
    return new Promise<Commit | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM commits WHERE commit_hash = ?
      `;

      this.db.get(sql, [commitHash], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          commitHash: row.commit_hash,
          message: row.message,
          timestamp: row.timestamp,
          authorDevId: row.author_dev_id,
          committerDevId: row.committer_dev_id
        });
      });
    });
  }

  // CodeElement operations
  async saveCodeElement(codeElement: CodeElement): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO code_elements (element_id, repo_id, type, stable_identifier)
        VALUES (?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          codeElement.elementId,
          codeElement.repoId,
          codeElement.type,
          codeElement.stableIdentifier
        ],
        (err: SQLiteError) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async getCodeElement(elementId: string): Promise<CodeElement | null> {
    return new Promise<CodeElement | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM code_elements WHERE element_id = ?
      `;

      this.db.get(sql, [elementId], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          elementId: row.element_id,
          repoId: row.repo_id,
          type: row.type as 'file' | 'class' | 'function',
          stableIdentifier: row.stable_identifier
        });
      });
    });
  }

  async getCodeElementByIdentifier(repoId: string, stableIdentifier: string): Promise<CodeElement | null> {
    return new Promise<CodeElement | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM code_elements 
        WHERE repo_id = ? AND stable_identifier = ?
      `;

      this.db.get(sql, [repoId, stableIdentifier], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          elementId: row.element_id,
          repoId: row.repo_id,
          type: row.type as 'file' | 'class' | 'function',
          stableIdentifier: row.stable_identifier
        });
      });
    });
  }

  /**
   * List all code elements in a repository
   */
  async getAllCodeElements(repoId: string): Promise<CodeElement[]> {
    return new Promise<CodeElement[]>((resolve, reject) => {
      if (!this.db) { reject(new Error('Database not initialized')); return; }
      const sql = `SELECT * FROM code_elements WHERE repo_id = ?`;
      this.db.all(sql, [repoId], (err: any, rows: any[]) => {
        if (err) { reject(err); return; }
        const elements = rows.map(row => ({
          elementId: row.element_id,
          repoId: row.repo_id,
          type: row.type as 'file' | 'class' | 'function',
          stableIdentifier: row.stable_identifier
        }));
        resolve(elements);
      });
    });
  }

  // CodeElementVersion operations
  async saveCodeElementVersion(version: CodeElementVersion): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO code_element_versions 
        (version_id, element_id, commit_hash, name, start_line, end_line, previous_version_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          version.versionId,
          version.elementId,
          version.commitHash,
          version.name,
          version.startLine,
          version.endLine,
          version.previousVersionId
        ],
        (err: SQLiteError) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async getCodeElementVersion(versionId: string): Promise<CodeElementVersion | null> {
    return new Promise<CodeElementVersion | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM code_element_versions WHERE version_id = ?
      `;

      this.db.get(sql, [versionId], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          versionId: row.version_id,
          elementId: row.element_id,
          commitHash: row.commit_hash,
          name: row.name,
          startLine: row.start_line,
          endLine: row.end_line,
          previousVersionId: row.previous_version_id
        });
      });
    });
  }

  async findLatestCodeElementVersion(elementId: string): Promise<CodeElementVersion | null> {
    return new Promise<CodeElementVersion | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT v.* FROM code_element_versions v
        JOIN commits c ON v.commit_hash = c.commit_hash
        WHERE v.element_id = ?
        ORDER BY c.timestamp DESC
        LIMIT 1
      `;

      this.db.get(sql, [elementId], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          versionId: row.version_id,
          elementId: row.element_id,
          commitHash: row.commit_hash,
          name: row.name,
          startLine: row.start_line,
          endLine: row.end_line,
          previousVersionId: row.previous_version_id
        });
      });
    });
  }

  async getCommitHistoryForElementId(elementId: string, limit?: number): Promise<Commit[]> {
    return new Promise<Commit[]>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const limitClause = limit ? `LIMIT ${limit}` : '';
      
      const sql = `
        SELECT c.* FROM commits c
        JOIN code_element_versions v ON c.commit_hash = v.commit_hash
        WHERE v.element_id = ?
        ORDER BY c.timestamp DESC
        ${limitClause}
      `;

      this.db.all(sql, [elementId], (err: SQLiteError, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const commits = rows.map(row => ({
          commitHash: row.commit_hash,
          message: row.message,
          timestamp: row.timestamp,
          authorDevId: row.author_dev_id,
          committerDevId: row.committer_dev_id
        }));
        
        resolve(commits);
      });
    });
  }

  // DecisionRecord operations
  async saveDecisionRecord(decision: DecisionRecord): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO decision_records 
        (decision_id, repo_id, title, content, created_at, author_dev_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          decision.decisionId,
          decision.repoId,
          decision.title,
          decision.content,
          decision.createdAt,
          decision.authorDevId
        ],
        (err: SQLiteError) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  async getDecisionRecord(decisionId: string): Promise<DecisionRecord | null> {
    return new Promise<DecisionRecord | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT * FROM decision_records WHERE decision_id = ?
      `;

      this.db.get(sql, [decisionId], (err: SQLiteError, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          decisionId: row.decision_id,
          repoId: row.repo_id,
          title: row.title,
          content: row.content,
          createdAt: row.created_at,
          authorDevId: row.author_dev_id
        });
      });
    });
  }

  async findDecisionRecordsLinkedToVersion(versionId: string): Promise<DecisionRecord[]> {
    return new Promise<DecisionRecord[]>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT d.* FROM decision_records d
        JOIN decision_references_code r ON d.decision_id = r.decision_id
        WHERE r.version_id = ?
      `;

      this.db.all(sql, [versionId], (err: SQLiteError, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const decisions = rows.map(row => ({
          decisionId: row.decision_id,
          repoId: row.repo_id,
          title: row.title,
          content: row.content,
          createdAt: row.created_at,
          authorDevId: row.author_dev_id
        }));
        
        resolve(decisions);
      });
    });
  }

  // Relationship operations
  async linkDecisionToCodeVersion(decisionId: string, versionId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO decision_references_code (decision_id, version_id)
        VALUES (?, ?)
      `;

      this.db.run(sql, [decisionId, versionId], (err: SQLiteError) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async linkVersionToPreviousVersion(versionId: string, previousVersionId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        UPDATE code_element_versions
        SET previous_version_id = ?
        WHERE version_id = ?
      `;

      this.db.run(sql, [previousVersionId, versionId], (err: SQLiteError) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  // File-hash cache operations
  async saveFileHash(repoId: string, filePath: string, fileHash: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        INSERT OR REPLACE INTO file_hashes (repo_id, file_path, file_hash)
        VALUES (?, ?, ?)
      `;

      this.db.run(sql, [repoId, filePath, fileHash], (err: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async getFileHash(repoId: string, filePath: string): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const sql = `
        SELECT file_hash FROM file_hashes WHERE repo_id = ? AND file_path = ?
      `;

      this.db.get(sql, [repoId, filePath], (err: any, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row ? row.file_hash : null);
      });
    });
  }

  // Count operations
  async getCodeElementCount(repoId: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(
        'SELECT COUNT(*) as count FROM code_elements WHERE repo_id = ?',
        [repoId],
        (err: SQLiteError, row: { count: number }) => {
          if (err) {
            reject(new Error(`Failed to get code element count: ${err.message}`));
            return;
          }
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  async getCommitCount(repoId: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(
        'SELECT COUNT(*) as count FROM commits WHERE repo_id = ?',
        [repoId],
        (err: SQLiteError, row: { count: number }) => {
          if (err) {
            reject(new Error(`Failed to get commit count: ${err.message}`));
            return;
          }
          resolve(row ? row.count : 0);
        }
      );
    });
  }

  async getDecisionCount(repoId: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(
        'SELECT COUNT(*) as count FROM decision_records WHERE repo_id = ?',
        [repoId],
        (err: SQLiteError, row: { count: number }) => {
          if (err) {
            reject(new Error(`Failed to get decision count: ${err.message}`));
            return;
          }
          resolve(row ? row.count : 0);
        }
      );
    });
  }
}
