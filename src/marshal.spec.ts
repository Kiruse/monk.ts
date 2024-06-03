import { afterAll, expect, test } from 'bun:test';
import { monk } from './monk.js';
import { ObjectId } from 'mongodb';

const getDb = () => monk({ url: process.env.MONGO_TEST_URI! }).then(db => db.useDb('test'));

test('ignore MongoDB native types', async () => {
  const db = await getDb();
  const coll = db.collection('marshal-test');

  const doc = { foo: 'bar', createdAt: new Date() };
  await coll.save(doc);

  const res = await coll.query().exact('foo', 'bar').findOne();
  expect(res).toMatchObject(doc);
  expect(res.id).toBeInstanceOf(ObjectId);
  expect(res.createdAt).toBeInstanceOf(Date);
});

test('special treatment for _id', async () => {
  const db = await getDb();
  const coll = db.collection('marshal-test');

  const doc = { id: new ObjectId(), foo: 'bar' };
  await coll.save(doc);

  expect(coll.query().exact('_id', doc.id).findOne()).resolves.toMatchObject(doc);
});

afterAll(async () => {
  const db = await getDb();
  await db.deleteDb('test').catch();
  db.close();
});
