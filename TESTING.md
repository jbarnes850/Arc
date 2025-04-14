# ARC V1 Testing Plan

This document outlines the testing approach for validating the core "Capture → Structure → Enrich → Preserve → Surface" loop of ARC V1.

## Test Repository Setup

For consistent testing, we'll use a simple test repository with the following characteristics:

- Contains both TypeScript and Python files
- Has multiple commits modifying different files
- Includes classes and functions that evolve over time
- Small enough for quick testing but complex enough to validate all features

## End-to-End Test Flow

### 1. Capture Stage Testing

**Test Objective:** Verify that Git commit history is correctly extracted.

**Test Steps:**
1. Initialize test repository with known commit history
2. Run ARC indexing on the repository
3. Verify that all commits are captured with correct metadata:
   - Commit hash, author, timestamp, message
   - Changed files per commit

**Validation Criteria:**
- All commits from the test repository are present in the database
- Commit metadata matches the actual Git history

### 2. Structure Stage Testing

**Test Objective:** Verify that code is correctly parsed into structural elements.

**Test Steps:**
1. Run ARC indexing on the test repository
2. Examine the `CodeElement` entries in the database
3. Verify that all files, classes, and top-level functions are correctly identified

**Validation Criteria:**
- Each file has a corresponding `CodeElement` entry
- Classes and top-level functions are correctly extracted
- Element metadata (name, location) matches the actual code

### 3. Enrich Stage Testing

**Test Objective:** Verify that relationships between entities are correctly established.

**Test Steps:**
1. Run ARC indexing on the test repository
2. Examine the relationships in the database
3. Verify that `MODIFIES`, `PRECEDES`, and `AUTHORS` relationships are correctly established

**Validation Criteria:**
- Each commit is linked to the developers who authored it
- Each code element version is linked to the commit that modified it
- Sequential versions of the same code element are linked via `PRECEDES`

### 4. Preserve Stage Testing

**Test Objective:** Verify that decision records can be created and linked to code elements.

**Test Steps:**
1. Create a decision record through the ARC UI
2. Link the decision record to a specific code element
3. Verify that the decision record and its relationship are stored in the database

**Validation Criteria:**
- Decision record is stored with correct title and content
- `REFERENCES` relationship is established between the decision record and the correct code element version

### 5. Surface Stage Testing

**Test Objective:** Verify that context is correctly displayed in the VS Code panels.

**Test Steps:**
1. Open a file that has been indexed by ARC
2. Verify that the Context Panel shows the correct information:
   - Stable identifier of the viewed element
   - Commit history affecting the element
   - Linked decision records
3. Verify that the Architecture Panel shows the correct system structure

**Validation Criteria:**
- Context Panel displays accurate commit history for the viewed element
- Context Panel shows all linked decision records
- Architecture Panel reflects the current state of the codebase

## Feature-Specific Tests

### ARC-101: VS Code Extension Setup
- Verify that the extension installs successfully
- Confirm that ARC panels are visible
- Validate that all commands are available in the command palette

### ARC-102: Repository Indexing
- Verify successful indexing of TypeScript and Python files
- Confirm that errors during parsing are handled gracefully
- Validate that all code elements are created in the database

### ARC-103: Temporal KG Population
- Verify that `CodeElementVersion` nodes are created for each commit
- Confirm that versions are linked via `PRECEDES` relationships
- Validate that `MODIFIES` relationships are correctly established

### ARC-104: SQLite Persistence Layer
- Verify that all entities and relationships are correctly stored
- Confirm that temporal queries return the expected results
- Validate that the database file is reliably stored locally

### ARC-105: Basic GitHub Integration
- Verify that commit history is correctly fetched via Git CLI
- Confirm that developer information is extracted from commits
- Validate that commit data is passed to the persistence service

### ARC-106: Architecture Diagram Generator
- Verify that the diagram reflects the current state of the KG
- Confirm that high-level components are correctly visualized
- Validate that the diagram is generated in a reasonable time

### ARC-107: Decision Record MVP
- Verify that users can create and save decision records
- Confirm that decisions can be linked to code elements
- Validate that `REFERENCES` relationships are stored correctly

### ARC-108: Context Surfacing MVP
- Verify that the panel updates based on the viewed element
- Confirm that commit history is displayed correctly
- Validate that linked decisions are shown and clickable

## Test Implementation

The tests will be implemented as a combination of:

1. **Unit tests** for individual services and components
2. **Integration tests** for the interaction between services
3. **Manual validation** for UI components and end-to-end flows

All tests will follow the minimalist approach outlined in the .windsurfrules, focusing on validating the core functionality without unnecessary complexity.
