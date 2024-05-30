import { ObjectId } from 'mongodb';
import type { Collection } from './collection.js';

export class Document<T extends { id: ObjectId } = any> {
  constructor(public readonly collection: Collection, public data: T) {}

  async refresh() {
    if (!(this.data.id instanceof ObjectId)) throw Error('Document has no ID');
    this.data = await this.collection.get(this.data.id) as any;
    return this;
  }

  async save() {
    if (!(this.data.id instanceof ObjectId)) {
      if (this.data.id) throw Error('Document ID must be an ObjectId');
      this.data.id = new ObjectId();
    }
    await this.collection.save(this.data);
    return this;
  }
}
