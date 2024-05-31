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

afterAll(async () => {
  const db = await getDb();
  await db.deleteDb('test').catch();
  db.close();
});
