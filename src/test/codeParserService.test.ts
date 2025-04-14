import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { CodeParserService } from '../indexing/CodeParserService';

// Simple test suite for CodeParserService
suite('CodeParserService Test Suite', () => {
  let parserService: CodeParserService;
  
  setup(async () => {
    // Initialize the parser service before each test
    parserService = new CodeParserService();
    // Note: We don't call initialize() since it's not in the interface
  });
  
  test('Should parse TypeScript file correctly', async () => {
    // Read the test TypeScript file
    const filePath = path.join(__dirname, '..', '..', 'test', 'testRepo', 'src', 'ts', 'calculator.ts');
    const repoId = 'test-repo';
    
    // Parse the file
    const elements = await parserService.parseFile(filePath, repoId);
    
    // Verify that the correct elements were extracted
    assert.ok(elements.length > 0, 'Should extract at least one element');
    
    // Find the Calculator class element
    const calculatorClass = elements.find(e => 
      e.stableIdentifier.includes('Calculator') && e.type === 'class');
    assert.ok(calculatorClass, 'Should extract Calculator class');
    
    // Find the multiply function
    const multiplyFunction = elements.find(e => 
      e.stableIdentifier.includes('multiply') && e.type === 'function');
    assert.ok(multiplyFunction, 'Should extract multiply function');
  });
  
  test('Should handle parsing errors gracefully', async () => {
    // Create a temporary invalid file
    const tempDir = path.join(__dirname, '..', '..', 'test', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const invalidFilePath = path.join(tempDir, 'invalid.ts');
    fs.writeFileSync(invalidFilePath, 'class InvalidClass { @#$% }');
    
    try {
      // Should not throw an exception
      const elements = await parserService.parseFile(invalidFilePath, 'test-repo');
      
      // Should return an empty array or partial results, but not throw
      assert.ok(Array.isArray(elements), 'Should return an array even for invalid code');
    } finally {
      // Clean up
      if (fs.existsSync(invalidFilePath)) {
        fs.unlinkSync(invalidFilePath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
      }
    }
  });
});
