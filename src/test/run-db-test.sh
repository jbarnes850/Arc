#!/bin/bash
set -e  # Exit on any error
set -x  # Print each command before executing

echo "Running SQLite initialization test..."

# Check pnpm installation
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm globally..."
    npm install -g pnpm
fi

# Show environment info
echo "Node version: $(node --version)"
echo "PNPM version: $(pnpm --version)"
echo "Current directory: $(pwd)"

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Run the debug test
echo "Running database debug test..."
pnpm exec ts-node src/test/debug-db-test.ts

if [ $? -eq 0 ]; then
    echo "✅ Database test passed"
    exit 0
else
    echo "❌ Database test failed"
    exit 1
fi
