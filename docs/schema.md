# ARC V1 SQLite Schema Documentation
**Performance Tuning and Targets**
- PRAGMAs:
  - `journal_mode = WAL`
  - `synchronous = NORMAL`
  - `temp_store = MEMORY`
- Micro-benchmark target: ≥ 25 k rows/s

This document provides detailed information about the SQLite schema used by ARC V1 to implement the Temporal Knowledge Graph.

## Core Tables

### `repositories`
Stores information about code repositories being tracked.

```sql
CREATE TABLE repositories (
  repo_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  description TEXT
);
```

### `developers`
Stores information about developers who have contributed to the repositories.

```sql
CREATE TABLE developers (
  dev_id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL
);

CREATE INDEX idx_developers_email ON developers(email);
```

### `commits`
Stores Git commit information.

```sql
CREATE TABLE commits (
  commit_hash TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  message TEXT NOT NULL,
  commit_timestamp INTEGER NOT NULL,
  author_dev_id TEXT NOT NULL,
  committer_dev_id TEXT NOT NULL,
  FOREIGN KEY (repo_id) REFERENCES repositories(repo_id),
  FOREIGN KEY (author_dev_id) REFERENCES developers(dev_id),
  FOREIGN KEY (committer_dev_id) REFERENCES developers(dev_id)
);

CREATE INDEX idx_commits_repo_id ON commits(repo_id);
CREATE INDEX idx_commits_timestamp ON commits(commit_timestamp);
CREATE INDEX idx_commits_author ON commits(author_dev_id);
```

### `commit_parents`
Represents the parent-child relationship between commits.

```sql
CREATE TABLE commit_parents (
  commit_hash TEXT NOT NULL,
  parent_hash TEXT NOT NULL,
  PRIMARY KEY (commit_hash, parent_hash),
  FOREIGN KEY (commit_hash) REFERENCES commits(commit_hash),
  FOREIGN KEY (parent_hash) REFERENCES commits(commit_hash)
);

CREATE INDEX idx_commit_parents_commit ON commit_parents(commit_hash);
CREATE INDEX idx_commit_parents_parent ON commit_parents(parent_hash);
```

### `code_elements`
Represents logical code entities (files, classes, functions).

```sql
CREATE TABLE code_elements (
  element_id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('file', 'class', 'function')),
  stable_identifier TEXT NOT NULL,
  FOREIGN KEY (repo_id) REFERENCES repositories(repo_id),
  UNIQUE (repo_id, stable_identifier)
);

CREATE INDEX idx_code_elements_repo ON code_elements(repo_id);
CREATE INDEX idx_code_elements_stable_id ON code_elements(stable_identifier);
```

### `code_element_versions`
Represents the state of a code element at a specific commit.

```sql
CREATE TABLE code_element_versions (
  version_id TEXT PRIMARY KEY,
  element_id TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  name TEXT,
  start_line INTEGER,
  end_line INTEGER,
  previous_version_id TEXT,
  FOREIGN KEY (element_id) REFERENCES code_elements(element_id),
  FOREIGN KEY (commit_hash) REFERENCES commits(commit_hash),
  FOREIGN KEY (previous_version_id) REFERENCES code_element_versions(version_id)
);

CREATE INDEX idx_code_element_versions_element ON code_element_versions(element_id);
CREATE INDEX idx_code_element_versions_commit ON code_element_versions(commit_hash);
CREATE INDEX idx_code_element_versions_previous ON code_element_versions(previous_version_id);
```

### `decision_records`
Stores architectural and implementation decisions.

```sql
CREATE TABLE decision_records (
  decision_id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  author_dev_id TEXT,
  FOREIGN KEY (repo_id) REFERENCES repositories(repo_id),
  FOREIGN KEY (author_dev_id) REFERENCES developers(dev_id)
);

CREATE INDEX idx_decision_records_repo ON decision_records(repo_id);
```

### `decision_references_code`
Represents the relationship between decision records and code element versions.

```sql
CREATE TABLE decision_references_code (
  decision_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  PRIMARY KEY (decision_id, version_id),
  FOREIGN KEY (decision_id) REFERENCES decision_records(decision_id),
  FOREIGN KEY (version_id) REFERENCES code_element_versions(version_id)
);

CREATE INDEX idx_decision_references_decision ON decision_references_code(decision_id);
CREATE INDEX idx_decision_references_version ON decision_references_code(version_id);
```

## Relationship Mapping

The Temporal Knowledge Graph relationships are implemented as follows:

1. **MODIFIES**: Implicit in the `code_element_versions` table via the `commit_hash` foreign key
2. **PRECEDES**: Implemented via the `previous_version_id` in the `code_element_versions` table
3. **AUTHORS**: Implicit in the `commits` and `decision_records` tables via the `author_dev_id` foreign key
4. **REFERENCES**: Implemented via the `decision_references_code` junction table

## Indexing Strategy

The schema includes indexes on:
- All foreign keys to optimize join operations
- `commit_timestamp` for efficient time-based queries
- `stable_identifier` for quick lookup of code elements
- Junction table columns to optimize relationship queries
