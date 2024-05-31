import { afterAll, expect, test } from 'bun:test';
import * as YAML from 'yaml';
import { Monk, MonkIndexDeclaration, monk } from './monk.js';

const getDb = () => monk({ url: process.env.MONGO_TEST_URI! }).then(db => db.useDb('test'));

test('monk connects', async () => {
  await expect(monk({ url: process.env.MONGO_TEST_URI! })).resolves.toBeInstanceOf(Monk);
});

test('monk manages indices', async () => {
  const db = await getDb();
  const fooDB = await db.collection('foo');
  const barDB = await db.collection('bar');

  await expect(db.manageIndexes(INDEXES1)).resolves.toBeUndefined();

  // there is always an implicit _id index
  await expect(fooDB.collection.indexes()).resolves.toHaveLength(3);
  await expect(barDB.collection.indexes()).resolves.toHaveLength(2);

  // update indexes
  await expect(db.manageIndexes(INDEXES2)).resolves.toBeUndefined();

  await expect(fooDB.collection.indexes()).resolves.toHaveLength(2);
  await expect(barDB.collection.indexes()).resolves.toHaveLength(2);
});

const INDEXES1: MonkIndexDeclaration = YAML.parse(`
foo:
- fields:
  - foo:  1
  - bar: -1
  unique: true
- fields:
  - baz: text
  sparse: true
bar:
- fields:
  - qux: hashed
`);

const INDEXES2: MonkIndexDeclaration = YAML.parse(`
foo:
- fields:
  - foo:  1
  - bar: -1
  unique: true
bar:
- fields:
  - qux: hashed
`);

afterAll(async () => {
  const db = await getDb();
  await db.deleteDb('test').catch();
  db.close();
});
