import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

console.log('Debug: Starting database test');
console.log('Debug: Current directory:', process.cwd());
console.log('Debug: __dirname:', __dirname);

async function testDatabaseInit() {
    const testDbDir = path.join(require('os').tmpdir(), 'arc-test');
    const testDbPath = path.join(testDbDir, 'arc-test.db');

    console.log('Debug: Test DB Path:', testDbPath);
    console.log('Debug: Checking better-sqlite3 version:', require('better-sqlite3/package.json').version);

    // Cleanup existing test database
    if (fs.existsSync(testDbPath)) {
        console.log('Removing existing test database...');
        fs.unlinkSync(testDbPath);
    }

    // Ensure directory exists
    fs.mkdirSync(testDbDir, { recursive: true });

    try {
        console.log('Attempting to create SQLite database...');
        const db = new Database(testDbPath);
        console.log('SQLite database created successfully');

        // Simple test table
        console.log('Creating test table...');
        db.exec('CREATE TABLE test (id TEXT PRIMARY KEY)');
        console.log('Test table created');

        // Test insert
        console.log('Testing insert...');
        db.exec('INSERT INTO test (id) VALUES (\'test1\')');
        console.log('Insert successful');

        // Test query
        console.log('Testing query...');
        const result = db.prepare('SELECT * FROM test').get();
        console.log('Query result:', result);

        db.close();
        console.log('Test completed successfully');
        return true;
    } catch (error) {
        console.error('Test failed with error:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        return false;
    }
}

testDatabaseInit()
    .then(success => {
        console.log('Test finished with success:', success);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });