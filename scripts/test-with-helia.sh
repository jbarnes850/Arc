#!/bin/bash

# Script to clone and test ARC with the Helia repository
# This script will:
# 1. Clone the Helia repository
# 2. Build and package the ARC extension
# 3. Install the extension in VS Code
# 4. Open the Helia repository in VS Code

# Exit on error
set -e

# Configuration
HELIA_REPO="https://github.com/ipfs/helia"
HELIA_DIR="$HOME/helia-test"
ARC_DIR="$(pwd)"
VSIX_PATH="$ARC_DIR/arc-0.0.1.vsix"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting ARC test with Helia repository...${NC}"

# Check if Helia directory already exists
if [ -d "$HELIA_DIR" ]; then
  echo -e "${YELLOW}Helia directory already exists. Updating...${NC}"
  cd "$HELIA_DIR"
  git pull
else
  echo -e "${YELLOW}Cloning Helia repository...${NC}"
  git clone "$HELIA_REPO" "$HELIA_DIR"
fi

# Build and package ARC extension
echo -e "${YELLOW}Building and packaging ARC extension...${NC}"
cd "$ARC_DIR"
pnpm run package
vsce package

# Check if the VSIX file was created
if [ ! -f "$VSIX_PATH" ]; then
  echo -e "${RED}Failed to create VSIX package${NC}"
  exit 1
fi

# Install the extension in VS Code
echo -e "${YELLOW}Installing ARC extension in VS Code...${NC}"
code --install-extension "$VSIX_PATH" --force

# Open the Helia repository in VS Code
echo -e "${YELLOW}Opening Helia repository in VS Code...${NC}"
code "$HELIA_DIR"

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${YELLOW}Manual testing steps:${NC}"
echo "1. Use the command 'ARC: Index Repository' to index the Helia codebase"
echo "2. Check memory usage with 'ARC: Show Memory Status'"
echo "3. Test the Context Toast + Peek functionality"
echo "4. Create and link decision records"
echo "5. Explore the architecture diagram"
echo "6. Close and reopen VS Code to test database locking prevention"
