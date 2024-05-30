import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { InvalidDocumentError } from './error.js';

export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;
export type Primitive = string | number | boolean | Date | ObjectId | null;

/** Ensure the given object is a valid MongoDB document. Throws if it isn't. */
export function checkPojo(doc: any) {
  const ignoreTypes = [Date, Uint8Array];
  if (!doc || typeof doc !== 'object') return;
  if (Array.isArray(doc)) return;
  if (ignoreTypes.find(t => doc instanceof t)) return;

  if (!isValidMongoObj(doc))
    throw new InvalidDocumentError(doc);

  for (const prop in doc) {
    if (typeof prop === 'symbol')
      throw new InvalidDocumentError(doc);
    checkPojo(doc[prop]);
  }
}

export function isValidMongoObj(doc: any) {
  if (typeof doc !== 'object') return true;
  if (doc.constructor === Object) return true;
  if (Array.isArray(doc)) return true;
  if (doc instanceof Date || doc instanceof ObjectId) return true;
  return false;
}

export const omit = <T extends object>(obj: T, ...props: (keyof T)[]) => Object.fromEntries(Object.entries(obj).filter(([prop]) => !props.includes(prop as any)));

export const getObjectHash = (index: any) => crypto.createHash('sha256').update(JSON.stringify(index)).digest('hex');

export function envar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
