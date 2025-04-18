#!/bin/bash
# Script to run the database initialization test using ts-node

echo "Installing ts-node if not already installed..."
npm install --no-save ts-node

echo "Running database test with ts-node..."
npx ts-node src/test/database-init-test.ts
