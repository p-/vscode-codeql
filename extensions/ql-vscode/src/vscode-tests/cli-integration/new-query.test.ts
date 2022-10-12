import { expect } from 'chai';
import * as path from 'path';
import * as tmp from 'tmp';
import { CancellationTokenSource } from 'vscode-jsonrpc';
import * as messages from '../../pure/new-messages';
import * as qsClient from '../../query-server/queryserver-client';
import * as cli from '../../cli';
import { CellValue } from '../../pure/bqrs-cli-types';
import { extensions, Uri } from 'vscode';
import { CodeQLExtensionInterface } from '../../extension';
import { fail } from 'assert';
import { skipIfNoCodeQL } from '../ensureCli';
import { QueryServerClient } from '../../query-server/queryserver-client';
import { logger, ProgressReporter } from '../../logging';
import { QueryResultType } from '../../pure/new-messages';
import { cleanDatabases, dbLoc, storagePath } from './global.helper';
import { importArchiveDatabase } from '../../databaseFetcher';


const baseDir = path.join(__dirname, '../../../test/data');

const tmpDir = tmp.dirSync({ prefix: 'query_test_', keep: false, unsafeCleanup: true });

const RESULTS_PATH = path.join(tmpDir.name, 'results.bqrs');

const source = new CancellationTokenSource();
const token = source.token;

class Checkpoint<T> {
  private res: () => void;
  private rej: (e: Error) => void;
  private promise: Promise<T>;

  constructor() {
    this.res = () => { /**/ };
    this.rej = () => { /**/ };
    this.promise = new Promise((res, rej) => {
      this.res = res as () => Record<string, never>;
      this.rej = rej;
    });
  }

  async done(): Promise<T> {
    return this.promise;
  }

  async resolve(): Promise<void> {
    await (this.res)();
  }

  async reject(e: Error): Promise<void> {
    await (this.rej)(e);
  }
}

type ResultSets = {
  [name: string]: CellValue[][];
}

type QueryTestCase = {
  queryPath: string;
  expectedResultSets: ResultSets;
}

// Test cases: queries to run and their expected results.
const queryTestCases: QueryTestCase[] = [
  {
    queryPath: path.join(baseDir, 'query.ql'),
    expectedResultSets: {
      '#select': [[42, 3.14159, 'hello world', true]]
    }
  },
  {
    queryPath: path.join(baseDir, 'compute-default-strings.ql'),
    expectedResultSets: {
      '#select': [[{ label: '(no string representation)' }]]
    }
  },
  {
    queryPath: path.join(baseDir, 'multiple-result-sets.ql'),
    expectedResultSets: {
      'edges': [[1, 2], [2, 3]],
      '#select': [['s']]
    }
  }
];

const nullProgressReporter: ProgressReporter = { report: () => { /** ignore */ } };

describe('using the new query server', function() {
  before(function() {
    skipIfNoCodeQL(this);
  });

  // Note this does not work with arrow functions as the test case bodies:
  // ensure they are all written with standard anonymous functions.
  this.timeout(20000);

  let qs: qsClient.QueryServerClient;
  let cliServer: cli.CodeQLCliServer;
  let db: string;
  before(async () => {
    try {
      const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
      if ('cliServer' in extension && 'databaseManager' in extension) {
        cliServer = extension.cliServer;

        cliServer.quiet = true;
        if (!(await cliServer.cliConstraints.supportsNewQueryServer())) {
          this.ctx.skip();
        }
        qs = new QueryServerClient({
          codeQlPath: (await extension.distributionManager.getCodeQlPathWithoutVersionCheck()) || '',
          debug: false,
          cacheSize: 0,
          numThreads: 1,
          saveCache: false,
          timeoutSecs: 0
        }, cliServer, {
          contextStoragePath: tmpDir.name,
          logger
        }, task => task(nullProgressReporter, new CancellationTokenSource().token));
        await qs.startQueryServer();

        // Unlike the old query sevre the new one wants a database and the empty direcrtory is not valid.
        // Add a database, but make sure the database manager is empty first
        await cleanDatabases(extension.databaseManager);
        const uri = Uri.file(dbLoc);
        const maybeDbItem = await importArchiveDatabase(
          uri.toString(true),
          extension.databaseManager,
          storagePath,
          () => { /**ignore progress */ },
          token,
        );

        if (!maybeDbItem) {
          throw new Error('Could not import database');
        }
        db = maybeDbItem.databaseUri.fsPath;
      } else {
        throw new Error('Extension not initialized. Make sure cli is downloaded and installed properly.');
      }
    } catch (e) {
      fail(e as Error);
    }

  });

  for (const queryTestCase of queryTestCases) {
    const queryName = path.basename(queryTestCase.queryPath);
    const evaluationSucceeded = new Checkpoint<void>();
    const parsedResults = new Checkpoint<void>();

    it('should register the database', async () => {
      await qs.sendRequest(messages.registerDatabases, { databases: [db] }, token, (() => { /**/ }) as any);
    });


    it(`should be able to run query ${queryName}`, async function() {
      try {
        const params: messages.RunQueryParams = {
          db,
          queryPath: queryTestCase.queryPath,
          outputPath: RESULTS_PATH,
          additionalPacks: [],
          externalInputs: {},
          singletonExternalInputs: {},
          target: { query: {} }
        };
        const result = await qs.sendRequest(messages.runQuery, params, token, () => { /**/ });
        expect(result.resultType).to.equal(QueryResultType.SUCCESS);
        await evaluationSucceeded.resolve();
      }
      catch (e) {
        await evaluationSucceeded.reject(e as Error);
      }
    });

    const actualResultSets: ResultSets = {};
    it(`should be able to parse results of query ${queryName}`, async function() {
      await evaluationSucceeded.done();
      const info = await cliServer.bqrsInfo(RESULTS_PATH);

      for (const resultSet of info['result-sets']) {
        const decoded = await cliServer.bqrsDecode(RESULTS_PATH, resultSet.name);
        actualResultSets[resultSet.name] = decoded.tuples;
      }
      await parsedResults.resolve();
    });

    it(`should have correct results for query ${queryName}`, async function() {
      await parsedResults.done();
      expect(actualResultSets!).not.to.be.empty;
      expect(Object.keys(actualResultSets!).sort()).to.eql(Object.keys(queryTestCase.expectedResultSets).sort());
      for (const name in queryTestCase.expectedResultSets) {
        expect(actualResultSets![name]).to.eql(queryTestCase.expectedResultSets[name], `Results for query predicate ${name} do not match`);
      }
    });
  }
});