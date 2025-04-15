# ARC V1 Knowledge Graph Query Patterns

This document provides examples of common query patterns for the Temporal Knowledge Graph used in ARC V1.

## Core Query Patterns

These query patterns are implemented in the `IPersistenceService` and used by the `KnowledgeGraphService` to provide higher-level functionality.

### 1. Finding the Latest Version of a Code Element

This query pattern is used to find the most recent version of a code element based on commit timestamp.

```sql
SELECT cev.*
FROM code_element_versions cev
JOIN commits c ON cev.commit_hash = c.commit_hash
WHERE cev.element_id = ?
ORDER BY c.commit_timestamp DESC
LIMIT 1;
```

### 2. Tracing a Code Element's History

This query pattern follows the `PRECEDES` relationship backward to trace the full history of a code element.

```sql
WITH RECURSIVE version_history AS (
  -- Base case: start with the given version
  SELECT cev.*, c.commit_timestamp
  FROM code_element_versions cev
  JOIN commits c ON cev.commit_hash = c.commit_hash
  WHERE cev.version_id = ?
  
  UNION ALL
  
  -- Recursive case: follow previous_version_id links
  SELECT cev.*, c.commit_timestamp
  FROM code_element_versions cev
  JOIN commits c ON cev.commit_hash = c.commit_hash
  JOIN version_history vh ON cev.version_id = vh.previous_version_id
)
SELECT * FROM version_history
ORDER BY commit_timestamp DESC;
```

### 3. Finding Code Elements Modified by a Commit

This query pattern implements the `MODIFIES` relationship to find all code elements affected by a specific commit.

```sql
SELECT ce.*, cev.*
FROM code_element_versions cev
JOIN code_elements ce ON cev.element_id = ce.element_id
WHERE cev.commit_hash = ?;
```

### 4. Finding Decisions Linked to a Code Element Version

This query pattern implements the `REFERENCES` relationship to find all decisions linked to a specific code element version.

```sql
SELECT dr.*
FROM decision_records dr
JOIN decision_references_code drc ON dr.decision_id = drc.decision_id
WHERE drc.version_id = ?;
```

### 5. Finding Code Element Versions Linked to a Decision

This query pattern implements the reverse `REFERENCES` relationship to find all code element versions referenced by a decision.

```sql
SELECT cev.*, ce.stable_identifier, ce.type
FROM code_element_versions cev
JOIN code_elements ce ON cev.element_id = ce.element_id
JOIN decision_references_code drc ON cev.version_id = drc.version_id
WHERE drc.decision_id = ?;
```

### 6. Finding Commits by Author

This query pattern implements the `AUTHORS` relationship for commits.

```sql
SELECT c.*
FROM commits c
WHERE c.author_dev_id = ?
ORDER BY c.commit_timestamp DESC;
```

### 7. Finding Decisions by Author

This query pattern implements the `AUTHORS` relationship for decisions.

```sql
SELECT dr.*
FROM decision_records dr
WHERE dr.author_dev_id = ?
ORDER BY dr.created_at DESC;
```

### 8. Finding Code Elements by Type for Architecture Diagram

This query pattern is used to generate the architecture diagram.

```sql
SELECT ce.element_id, ce.stable_identifier, ce.type
FROM code_elements ce
WHERE ce.repo_id = ? AND (? IS NULL OR ce.type = ?)
ORDER BY ce.stable_identifier;
```

## Implementation in TypeScript

These SQL queries are implemented in the `SQLitePersistenceService` class using the `better-sqlite3` library. Here's an example implementation of the "Finding the Latest Version of a Code Element" query:

```typescript
findLatestCodeElementVersion(elementId: string): Promise<CodeElementVersion | null> {
  try {
    const stmt = this.db.prepare(`
      SELECT cev.*
      FROM code_element_versions cev
      JOIN commits c ON cev.commit_hash = c.commit_hash
      WHERE cev.element_id = ?
      ORDER BY c.commit_timestamp DESC
      LIMIT 1
    `);
    
    const result = stmt.get(elementId);
    
    if (!result) {
      return Promise.resolve(null);
    }
    
    return Promise.resolve({
      versionId: result.version_id,
      elementId: result.element_id,
      commitHash: result.commit_hash,
      name: result.name,
      startLine: result.start_line,
      endLine: result.end_line,
      previousVersionId: result.previous_version_id
    });
  } catch (error) {
    return Promise.reject(error);
  }
}
```

## Higher-Level Query Patterns in KnowledgeGraphService

The `KnowledgeGraphService` combines these basic queries to implement higher-level functionality:

### 1. Getting Element Commit History

```typescript
async getElementCommitHistory(elementId: string, limit = 10): Promise<Commit[]> {
  // Get all versions of this element
  const versions = await this.persistenceService.findCodeElementVersionsByElementId(elementId);
  
  // Extract commit hashes
  const commitHashes = versions.map(v => v.commitHash);
  
  // Get commits
  const commits = await Promise.all(
    commitHashes.map(hash => this.persistenceService.getCommit(hash))
  );
  
  // Filter out nulls, sort by timestamp (descending), and limit
  return commits
    .filter((c): c is Commit => c !== null)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}
```

### 2. Getting Current Code Element by Stable ID

```typescript
async getCurrentCodeElementByStableId(
  repoId: string,
  stableId: string
): Promise<CodeElementVersion | null> {
  // Find the code element by stable ID
  const element = await this.persistenceService.getCodeElementByStableId(repoId, stableId);
  
  if (!element) {
    return null;
  }
  
  // Get the latest version
  return this.persistenceService.findLatestCodeElementVersion(element.elementId);
}
```

### 3. Getting Linked Decisions

```typescript
async getLinkedDecisions(versionId: string): Promise<DecisionRecord[]> {
  return this.persistenceService.findDecisionRecordsLinkedToVersion(versionId);
}
```

## Best Practices

1. **Use Prepared Statements**: Always use prepared statements to prevent SQL injection.
2. **Index Key Columns**: Ensure all columns used in WHERE clauses and joins are indexed.
3. **Limit Result Sets**: Use LIMIT to prevent returning large result sets.
4. **Use Transactions**: Wrap related operations in transactions for consistency.
5. **Handle Errors**: Properly catch and handle database errors.
6. **Close Resources**: Ensure statements and connections are properly closed.
7. **Use Async/Await**: Wrap database operations in Promises and use async/await for clean code.
