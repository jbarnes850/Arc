#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import { performance } from 'perf_hooks';
import fs from 'fs';
import * as cp from 'child_process';
import * as util from 'util';
import crypto from 'crypto';
import { SQLitePersistenceService } from '../persistence/SQLitePersistenceService';
import { CodeParserService } from '../indexing/CodeParserService';
import { GitHubIntegrationService } from '../integration/GitHubIntegrationService';
import { KnowledgeGraphService } from '../services/KnowledgeGraphService';

async function main() {
  const argv = yargs(hideBin(process.argv))
    .scriptName('arc-bench')
    .option('repo', {
      type: 'string',
      default: 'test/testRepo',
      describe: 'Path to repository for benchmarking'
    })
    .option('branch', {
      type: 'string',
      describe: 'Branch name for incremental checks'
    })
    .option('json', {
      type: 'boolean',
      default: false,
      describe: 'Output results as JSON'
    })
    .help()
    .alias('help', 'h')
    .parseSync();

  const repoPath = path.resolve(process.cwd(), argv.repo);
  const branch = argv.branch || 'HEAD';

  // Setup persistence & services
  const storagePath = path.join(process.cwd(), '.arcbench-db');
  if (!fs.existsSync(storagePath)) { fs.mkdirSync(storagePath, { recursive: true }); }
  const fakeContext: any = { globalStorageUri: { fsPath: storagePath } };
  const persistenceService = new SQLitePersistenceService(fakeContext);
  await persistenceService.initializeDatabase();
  const codeParserService = new CodeParserService();
  // Initialize parsers for TS & Python
  await codeParserService.initializeParser('typescript');
  await codeParserService.initializeParser('python');
  const gitService = new GitHubIntegrationService(persistenceService);
  const enableFileCache = true;
  const knowledgeGraphService = new KnowledgeGraphService(
    persistenceService,
    codeParserService,
    gitService,
    enableFileCache
  );
  // Save repository record
  const repoId = crypto.createHash('sha256').update(repoPath).digest('hex').substring(0, 16);
  await persistenceService.saveRepository({ repoId, path: repoPath, name: path.basename(repoPath) });

  // 1) Cold index
  const exec = util.promisify(cp.exec);
  const { stdout } = await exec('git log --pretty=format:"%H" --no-merges', { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 });
  const commitHashes = stdout.split('\n').filter(l => l);
  const startCold = performance.now();
  await gitService.indexCommitHistory(repoPath, repoId);
  for (const hash of commitHashes) {
    await knowledgeGraphService.processCommit(repoPath, repoId, hash);
  }
  const endCold = performance.now();

  // 2) Mutate 200 files
  const allFiles: string[] = [];
  (function walkDir(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const res = path.join(dir, entry.name);
      if (entry.isDirectory()) { walkDir(res); }
      else if (['.ts', '.js', '.py'].includes(path.extname(res))) { allFiles.push(res); }
    }
  })(repoPath);
  const mutateFiles = allFiles.sort(() => 0.5 - Math.random()).slice(0, 200);
  const originalContents = mutateFiles.map(f => ({ f, content: fs.readFileSync(f, 'utf8') }));
  for (const { f } of originalContents) {
    const marker = ['.py'].includes(path.extname(f)) ? '\n# ARC-bench' : '\n// ARC-bench';
    fs.appendFileSync(f, marker);
  }

  // 3) Incremental index
  const startIncr = performance.now();
  for (const hash of commitHashes) {
    await knowledgeGraphService.processCommit(repoPath, repoId, hash);
  }
  const endIncr = performance.now();
  // Restore mutated files
  for (const { f, content } of originalContents) { fs.writeFileSync(f, content, 'utf8'); }

  const results = {
    repo: repoPath,
    branch,
    cold_ms: Math.round(endCold - startCold),
    incremental_ms: Math.round(endIncr - startIncr)
  };

  if (argv.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('Benchmark results:');
    console.log(` Cold index: ${results.cold_ms} ms`);
    console.log(` Incremental: ${results.incremental_ms} ms`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
