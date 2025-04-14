# ARC V1 Acceptance Criteria Checklist

This document provides a checklist for validating that the ARC V1 implementation meets all the acceptance criteria specified in the PRD.

## ARC-101: VS Code Extension Setup

- [ ] Extension installs successfully
- [ ] ARC-1 panels (Architecture, Context) are visible
- [ ] Commands for indexing/linking are available in the command palette

## ARC-102: Repository Indexing (Tree-sitter)

- [ ] Indexing completes successfully on a sample repository
- [ ] `CodeElement` entries for files are created in the database
- [ ] `CodeElement` entries for classes are created in the database
- [ ] `CodeElement` entries for functions are created in the database
- [ ] Errors during parsing are handled gracefully

## ARC-103: Temporal KG Population (Commits)

- [ ] Database contains `Commit` records reflecting the commit history
- [ ] Database contains `Developer` records reflecting commit authors
- [ ] Database contains `CodeElement` records for parsed code elements
- [ ] Database contains `CodeElementVersion` records for each commit
- [ ] `MODIFIES` relationships are correctly established between commits and versions
- [ ] `PRECEDES` relationships are correctly established between sequential versions

## ARC-104: SQLite Persistence Layer

- [ ] Data saved via `IPersistenceService` can be successfully retrieved
- [ ] Temporal queries (e.g., `getCodeElementStateAtCommit`) work correctly
- [ ] Database file is reliably stored locally

## ARC-105: Basic GitHub Integration

- [ ] `Commit` data is correctly fetched via Git CLI
- [ ] Associated `Developer` data is correctly extracted from commits
- [ ] Commit data is passed to the persistence service during indexing

## ARC-106: Architecture Diagram Generator

- [ ] Diagram shows high-level components based on file/directory structure
- [ ] Diagram shows top-level class/module definitions
- [ ] Relationships between components are visualized
- [ ] Diagram is displayed in a dedicated ARC-1 panel
- [ ] Diagram generation is reasonably fast after indexing

## ARC-107: Decision Record MVP (Capture/Link)

- [ ] User can create decision records with title and content
- [ ] User can save decision records to the database
- [ ] User can link a decision to a code element
- [ ] `REFERENCES` relationship between `DecisionRecord` and `CodeElementVersion` is stored

## ARC-108: Context Surfacing MVP (Panel)

- [ ] Panel displays the `stable_identifier` of the viewed element
- [ ] Panel lists recent `Commits` affecting the element
- [ ] Commit information shows hash, author, date, and message snippet
- [ ] Panel lists titles of `DecisionRecord`s linked to the element
- [ ] Decision record titles are clickable to open the record

## Overall Validation

- [ ] All ARC-101 through ARC-108 features work on sample projects
- [ ] No crashes during indexing or surfacing
- [ ] Robust fallback behavior when errors occur
- [ ] All operations are performed entirely locally

## Testing Instructions

1. Install the extension in VS Code
2. Open a TypeScript or Python repository
3. Run the "ARC: Index Repository" command
4. Navigate to code files to see their history in the Context Panel
5. Create decision records and link them to code elements
6. View the architecture diagram
7. Check that all acceptance criteria are met

## Notes

- This checklist should be completed for each release candidate
- Any failures should be documented and addressed before release
- Focus on validating the core loop: Capture → Structure → Enrich → Preserve → Surface
