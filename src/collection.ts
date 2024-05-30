import { Collection as MongoCollection, ObjectId } from 'mongodb';
import { createQuery, type MonkQuery } from './query.js';
import type { Monk } from './monk.js';
import { checkPojo, type DeepPartial } from './util.js';

export class Collection<DOC = any> {
  constructor(public readonly client: Monk, public readonly collection: MongoCollection) {}

  async get<T = DOC>(id: ObjectId): Promise<T | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? this.client.unmarshal(doc) as any : null;
  }

  findOne = <T = DOC>(query: MonkQuery<{}, T>) =>
    this.collection.findOne(
      query.toQuery(),
      { projection: query.getProjection() },
    ).then(doc => doc ? this.client.unmarshal(doc) as T : null);

  findAll = <T = DOC>(query: MonkQuery<{}, T>) =>
    this.collection.find(
      query.toQuery(),
      { projection: query.getProjection() },
    ).toArray().then(docs => docs.map(this.client.unmarshal) as T[]);

  update = <T = DOC>(query: MonkQuery<{}, T>, update: DeepPartial<T>) =>
    this.collection.updateMany(query.toQuery(), { $set: this.client.marshal(update) as any });

  updateOne = <T = DOC>(query: MonkQuery<{}, T>, update: DeepPartial<T>) =>
    this.collection.updateOne(query.toQuery(), { $set: this.client.marshal(update) as any });

  deleteBy = <T = DOC>(query: MonkQuery<{}, T>) => this.collection.deleteMany(query.toQuery());
  deleteOneBy = <T = DOC>(query: MonkQuery<{}, T>) => this.collection.deleteOne(query.toQuery());

  query = <T = DOC>() => createQuery.bindDocType<T>()(this, (qry) => ({
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
