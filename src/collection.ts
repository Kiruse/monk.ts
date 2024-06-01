import { Collection as MongoCollection, FindCursor as MongoCursor, ObjectId } from 'mongodb';
import { createQuery, type MonkQuery } from './query.js';
import type { Monk } from './monk.js';
import { checkPojo, type DeepPartial } from './util.js';

export class Collection<DOC = any> {
  constructor(public readonly client: Monk, public readonly collection: MongoCollection) {}

  async get<T = DOC>(id: ObjectId): Promise<T | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.client.unmarshal(doc) as any : null;
  }

  find = <T = DOC>(query: MonkQuery<{}, T>) =>
    new Cursor(this, query, this.collection.find(
      query.toQuery(),
      { projection: query.getProjection() },
    ));

  findOne = <T = DOC>(query: MonkQuery<{}, T>) => this.find(query).next();
  findAll = <T = DOC>(query: MonkQuery<{}, T>) => this.find(query).collect();

  update = <T = DOC>(query: MonkQuery<{}, T>, update: DeepPartial<T>) =>
    this.collection.updateMany(query.toQuery(), { $set: this.client.marshal(update) as any });

  updateOne = <T = DOC>(query: MonkQuery<{}, T>, update: DeepPartial<T>) =>
    this.collection.updateOne(query.toQuery(), { $set: this.client.marshal(update) as any });

  deleteBy = <T = DOC>(query: MonkQuery<{}, T>) => this.collection.deleteMany(query.toQuery());
  deleteOneBy = <T = DOC>(query: MonkQuery<{}, T>) => this.collection.deleteOne(query.toQuery());

  query = <T = DOC>() => createQuery.bindDocType<T>()(this, (qry) => ({
    find: () => this.find<T>(qry),
    findAll: () => this.findAll<T>(qry),
    findOne: () => this.findOne<T>(qry),
    update: (update: DeepPartial<T>) => this.update<T>(qry, update),
    updateOne: (update: DeepPartial<T>) => this.updateOne<T>(qry, update),
    delete: () => this.deleteBy<T>(qry),
    deleteOne: () => this.deleteOneBy<T>(qry),
  }));

  async save<T = DOC>(data: T): Promise<ObjectId> {
    const doc: any = this.client.marshal(data);
    if (process.env.NODE_ENV === 'development') checkPojo(doc);
    doc._id = doc._id ?? new ObjectId();
    await this.collection.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
    return doc._id;
  }

  async delete(id: ObjectId, soft = true): Promise<boolean> {
    if (soft) {
      const res = await this.collection.updateOne({ _id: id }, { $set: { _deletedAt: new Date() } });
      return res.matchedCount > 0;
    } else {
      const res = await this.collection.deleteOne({ _id: id });
      return res.deletedCount > 0;
    }
  }
}

export class Cursor<DOC = any> {
  #cursor: MongoCursor;

  constructor(
    public readonly collection: Collection,
    public readonly query: MonkQuery<{}, DOC>,
    cursor: MongoCursor,
  ) {
    this.#cursor = cursor;
  }

  close = () => this.#cursor.close();

  sort = (...fields: (string | [string, 1 | -1])[]) => {
    this.#cursor = this.#cursor.sort(
      Object.fromEntries(fields.map(f => Array.isArray(f) ? f : [f, 1]))
    );
    return this;
  }

  limit = (n: number) => {
    this.#cursor = this.#cursor.limit(n);
    return this;
  }

  next = () => this.#cursor.next().then(doc => doc ? this.collection.client.unmarshal(doc) as DOC : null);
  collect = () => this.#cursor.toArray().then(docs => docs.map(this.collection.client.unmarshal) as DOC[]);
  hasNext = () => this.#cursor.hasNext();
  tryNext = () => this.#cursor.tryNext().then(doc => doc ? this.collection.client.unmarshal(doc) as DOC : null);

  clone = () => new Cursor(this.collection, this.query, this.#cursor.clone());
  retype = <T>() => new Cursor<T>(this.collection, this.query as any, this.#cursor);

  get closed() {
    return this.#cursor.closed;
  }
}
