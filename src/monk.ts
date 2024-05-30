import type { Marshaller } from '@kiruse/marshal';
import { Event } from '@kiruse/typed-events';
import { MongoClient, type Db, type MongoClientOptions } from 'mongodb';
import { Collection } from './collection.js';
import { defaultMarshaller } from './marshal.js';
import { envar, getObjectHash } from './util.js';
import { Session } from './session.js';

export interface MonkOptions extends MongoClientOptions {
  url: string;
  marshaller?: Marshaller;
}

export interface MonkIndexDeclaration {
  [collection: string]: {
    fields: { [field: string]: 1 | -1 | 'text' | 'hashed' }[];
    sparse?: boolean;
    unique?: boolean;
  }[];
}

export async function monk(opts: MonkOptions) {
  return await new Monk(opts).connect();
}

export class Monk {
  #url: string;
  #opts: MongoClientOptions;
  #client: MongoClient | undefined;
  #db: Db | undefined;
  #marshaller: Marshaller;

  readonly session = new Session(this);

  readonly onClose = Event();
  readonly onError = Event<any>();

  constructor({ url, marshaller = defaultMarshaller, ...opts }: MonkOptions) {
    this.#url = url;
    this.#opts = opts;
    this.#marshaller = marshaller;
  }

  async connect() {
    if (this.#client) return this;
    this.#client = new MongoClient(this.#url, this.#opts);
    await this.#client.connect();
    this.#client.on('close', this.#onClose);
    this.#client.on('error', this.#onError);
  }

  async reconnect() {
    this.close();
    await this.connect();
  }

  close() {
    const cli = this.#client;
    if (cli) {
      cli.off('close', this.#onClose);
      cli.off('error', this.#onError);
      cli.close();
      this.#client = undefined;
    }
  }

  getDb(name: string) {
    if (!this.#client) throw new Error('Not connected');
    return this.#client.db(name);
  }

  /** Unselects any database. Methods requiring a selected database like `collection` will fail. */
  useDb(): this;
  /** Selects the given database. Beware, as the database will be created if it doesn't yet exist. */
  useDb(name: string): this;
  useDb(name?: string) {
    if (!name)
      this.#db = undefined;
    else
      this.#db = this.getDb(name);
    return this;
  }

  async withDb(name: string, callback: () => Promise<void>): Promise<void> {
    const prevDb = this.#db;
    this.useDb(name);
    try {
      await callback();
    } finally {
      this.#db = prevDb;
    }
  }

  deleteDb(): Promise<boolean>;
  deleteDb(name: string): Promise<boolean>;
  async deleteDb(name?: string) {
    name = name ?? this.#db?.databaseName;
    if (!name) throw new Error('No database selected');
    return await this.getDb(name).dropDatabase();
  }

  collection<DOC = any>(name: string): Collection<DOC>;
  collection<DOC = any>(db: string, collection: string): Collection<DOC>;
  collection<DOC = any>(db: string, collection?: string) {
    if (collection === undefined) {
      if (!this.#db) throw new Error('No database selected');
      return new Collection<DOC>(this, this.#db!.collection(db));
    }
    return new Collection<DOC>(this, this.#client!.db(db).collection(collection));
  }

  /** Manage indexes by declaration file. These indexes will have generated names. Changes to this
   * document will be reflected across the entire database, and drastic changes can cause dramatic
   * computational overhead.
   *
   * The document is expected to be in YAML format in the following structure:
   * ```yaml
   * collection:
   *   - fields:
   *     - field1: 1
   *     - field2: -1
   *     - field3: text
   *     - nested.field: 1
   *     sparse: true
   *     unique: true
   * ```
   *
   * **IMPORTANT:** Indexes that are not listed in this declaration will be dropped! You cannot call
   * this method consecutively to create all indices in a database. Instead, you should merge all
   * index declarations into one and then call this method once.
   */
  async manageIndexes(decl: MonkIndexDeclaration) {
    interface CollectionIndex {
      collection: string;
      indexes: string[];
    }

    const db = this.#db;
    if (!db) throw new Error('No database selected');

    const idx = this.collection('managed-indexes');

    for (const collection in decl) {
      const coll = db.collection(collection);
      const meta = await idx.query<CollectionIndex>().exact('collection', collection).findOne();
      const removed = new Set<string>(meta?.indexes ?? []);
      const added = new Set<string>();

      for (const { fields, sparse = false, unique = false } of decl[collection]) {
        const idx: any = {};
        for (const field of fields) {
          const [name, value] = Object.entries(field)[0];
          idx[name] = value;
        }

        // create a new object to standardize the order of fields to produce the same hash
        const opts = { sparse, unique };
        const hash = getObjectHash({ fields, ...opts });
        if (!removed.has(hash)) {
          await coll.createIndex(idx, { ...opts, name: hash });
        }

        added.add(hash);
        removed.delete(hash);
      }

      for (const hash of removed) {
        try {
          await coll.dropIndex(hash);
        } catch {}
      }
      await idx.save({
        collection,
        indexes: [...added],
      });
    }
  }

  #onClose = () => {
    this.onClose.emit();
    this.#client = undefined;
  }

  #onError = (err: any) => {
    this.onError.emit(err);
    this.close();
  }

  marshal = (data: any): unknown => this.#marshaller.marshal ? this.#marshaller.marshal(data) : data;
  unmarshal = (data: any): unknown => this.#marshaller.unmarshal ? this.#marshaller.unmarshal(data) : data;

  get client() { return this.#client }
  get db() { return this.#db }

  static async readIndexDecl(file: string) {
    const { default: fs } = await import('fs/promises');
    const { default: YAML } = await import('yaml');
    return YAML.parse(await fs.readFile(file, 'utf8')) as any as MonkIndexDeclaration;
  }

  static async fromEnv({ marshaller = defaultMarshaller } = {}) {
    const mongoUrl = envar('MONGODB_HOST');
    const mongoRs = envar('MONGODB_REPLSET');
    return await new Monk({
      url: `mongodb://${mongoUrl}`,
      replicaSet: mongoRs,
      marshaller,
    }).connect();
  }
}
