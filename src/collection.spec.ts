import { afterAll, expect, test } from 'bun:test';
import { monk } from './monk.js';
import { ObjectId } from 'mongodb';

const getDb = () => monk({ url: process.env.MONGO_TEST_URI! }).then(db => db.useDb('test'));

test('monk creates arbitrary documents', async () => {
  const db = await getDb();
  const id1 = db.collection('foo').save({ foo: 'bar' });
  const id2 = db.collection('foo').save({ bar: 'foo' });
  await expect(id1).resolves.toBeInstanceOf(ObjectId);
  await expect(id2).resolves.toBeInstanceOf(ObjectId);
  expect(db.collection('foo').collection.findOne({ _id: await id1 })).resolves.toMatchObject({ foo: 'bar' });
  expect(db.collection('foo').collection.findOne({ _id: await id2 })).resolves.toMatchObject({ bar: 'foo' });
});

test('monk queries arbitrary documents', async () => {
  const db = await getDb();
  const id1 = await db.collection('foo').save({ foo: 'bar' });
  const id2 = await db.collection('foo').save({ bar: 'foo' });
  const q1 = db.collection('foo').query().exact('_id', id1);
  const q2 = db.collection('foo').query().exact('_id', id2);
  await expect(q1.findOne()).resolves.toMatchObject({ foo: 'bar' });
  await expect(q2.findOne()).resolves.toMatchObject({ bar: 'foo' });
});

test('monk sorts queried documents', async () => {
  interface TestType {
    foo: string;
    order: number;
  }

  const db = await getDb();
  const coll = db.collection('foo');
  const ids = await Promise.all([
    coll.save({ foo: 'foo',  order: 2 }),
    coll.save({ foo: 'bar',  order: 1 }),
    coll.save({ foo: 'baz',  order: 4 }),
    coll.save({ foo: 'quux', order: 3 }),
  ]);

  const res = await coll.query<TestType>().has('order').find().sort('order').collect();
  expect(res.map(d => d.order)).toMatchObject([1, 2, 3, 4]);
});

afterAll(async () => {
  const db = await getDb();
  await db.deleteDb('test').catch();
  db.close();
});
