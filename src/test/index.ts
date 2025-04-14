import * as path from 'path';
import Mocha from 'mocha';
import * as fs from 'fs';

/**
 * Run the unit tests for ARC V1
 */
export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true
  });

  const testsRoot = path.resolve(__dirname, '.');

  return new Promise<void>((resolve, reject) => {
    // Use fs.readdir instead of glob for simplicity and to avoid extra dependencies
    fs.readdir(testsRoot, (err: NodeJS.ErrnoException | null, files: string[]) => {
      if (err) {
        return reject(err);
      }

      // Add files to the test suite
      files.forEach((f: string) => {
        if (f.endsWith('.test.js')) {
          mocha.addFile(path.resolve(testsRoot, f));
        }
      });

      try {
        // Run the mocha test
        mocha.run((failures: number) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
