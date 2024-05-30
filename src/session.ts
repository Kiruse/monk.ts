import type { ClientSession, ClientSessionOptions } from 'mongodb';
import type { Monk } from './monk.js';

export class Session {
  #session: ClientSession | undefined;

  options: ClientSessionOptions = {
    causalConsistency: true,
    defaultTransactionOptions: {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    },
  };

  constructor(public readonly client: Monk) {}

  start() {
    if (this.#session) return this;
    if (this.client.client) throw Error('Not connected');
    this.#session = this.client.client!.startSession(this.options);
    return this;
  }

  async close() {
    if (this.#session) {
      await this.#session.endSession();
      this.#session = undefined;
    }
    return this;
  }

  get actual() { return this.#session }
  get isOpen() { return !!this.#session }
}
