# ARC Manual Testing Guide

This document provides instructions for manually testing the ARC extension with a real repository.

## Setup

1. Run the test script to clone the Helia repository and install the ARC extension:

```bash
./scripts/test-with-helia.sh
```

This script will:
- Clone the Helia repository to ~/helia-test
- Build and package the ARC extension
- Install the extension in VS Code
- Open the Helia repository in VS Code

## Testing Scenarios

### 1. Repository Indexing

**Steps:**
1. Open the Command Palette (Cmd+Shift+P)
2. Run "ARC: Index Repository"
3. Authorize the indexing process
4. Wait for indexing to complete

**Expected Results:**
- Progress should be shown in the status bar
- A success toast should appear with stats after indexing
- The architecture diagram should open automatically

### 2. Memory Usage Monitoring

**Steps:**
1. Open the Command Palette (Cmd+Shift+P)
2. Run "ARC: Show Memory Status"
3. Check the memory usage values

**Expected Results:**
- Memory usage should be displayed in an information message
- Memory usage should be below or around 200MB
- No memory warnings should appear during normal usage

### 3. Context Toast + Peek

**Steps:**
1. Open a source file (e.g., src/index.ts)
2. Wait for the context toast to appear
3. Click on the toast or use the peek command
4. Explore the timeline and decisions tabs

**Expected Results:**
- Toast should appear within 3 seconds
- Peek view should show commit history
- Clicking on a commit should show the diff

### 4. Decision Capture

**Steps:**
1. Open a source file
2. Use the keyboard shortcut (Alt+Cmd+D) or command palette to capture a decision
3. Enter a title and rationale
4. Save the decision

**Expected Results:**
- Decision capture modal should appear
- Decision should be saved and linked to the current file
- Peek view should update to show the new decision

### 5. Architecture Diagram

**Steps:**
1. Click on the ARC icon in the status bar
2. Explore the architecture diagram
3. Toggle the experimental timeline view

**Expected Results:**
- Diagram should load quickly
- Nodes should be grouped by top-level directory
- Decision-linked nodes should be highlighted

### 6. Database Locking Prevention

**Steps:**
1. Close VS Code
2. Reopen VS Code and the Helia repository
3. Use ARC features again

**Expected Results:**
- No database locking errors should occur
- All features should work correctly after reopening

### 7. Stability Testing

**Steps:**
1. Use the extension continuously for at least 30 minutes
2. Perform various operations (indexing, decision capture, peek views)
3. Monitor for crashes or errors

**Expected Results:**
- No crashes or unhandled rejections
- Consistent performance throughout the session
- Memory usage remains stable

## Reporting Issues

If you encounter any issues during testing, please document:

1. The steps to reproduce the issue
2. The expected behavior
3. The actual behavior
4. Any error messages or logs
5. Screenshots if applicable

## Performance Metrics

Track the following metrics during testing:

1. Indexing time for the Helia repository
2. Memory usage after indexing
3. Memory usage after extended use
4. Time for context toast to appear
5. Time for peek view to load
6. Time for architecture diagram to load
