import type { Filter } from 'mongodb';
import type { Primitive } from './util.js';
import type { Collection } from './collection.js';

export interface MonkQuery<API extends {}, DOC> {
  /** General purpose field assignment. Used by the other operators. */
  is(fieldname: string, value: any): MonkQueryApi<API, DOC>;

  /** Documents must match all of these subqueries. */
  all(...queries: MonkQuery<{}, DOC>[]): MonkQueryApi<API, DOC>;
  /** Documents must match at least one of these subqueries. */
  any(...queries: MonkQuery<{}, DOC>[]): MonkQueryApi<API, DOC>;
  /** Documents must match exactly one of these subqueries. */
  oneOf(...queries: MonkQuery<{}, DOC>[]): MonkQueryApi<API, DOC>;
  /** Documents must not match this subquery. */
  not(query: MonkQuery<{}, DOC>): MonkQueryApi<API, DOC>;

  /** Create a new empty subquery, e.g. for use with a logical filter.
   * This subquery's application methods (e.g. `findOne` or `delete`) cannot be called and will only
   * raise an exception.
   */
  sub<S = DOC>(): MonkQuery<{}, S>;

  /** Applies when this field matches the given value. For most values, this is an exact equivalence.
   * For arrays, this is an exact match of the array elements. For objects, this is a deep match.
   * For regular expressions, the field must match the regular expression.
   */
  match(fieldname: string, value: Primitive): MonkQueryApi<API, DOC>;

  /** Alias for `equals`. */
  exact(fieldname: string, value: Primitive): MonkQueryApi<API, DOC>;

  /** Applies when this field is exactly the given value. Identical to `match` except the in the case
   * of regular expressions, where this will match the regular expression itself.
   */
  equals(fieldname: string, value: Primitive): MonkQueryApi<API, DOC>;

  /** Applies when this field is not the given value. */
  notEquals(fieldname: string, value: Primitive): MonkQueryApi<API, DOC>;

  /** Applies when this field is one of the given values. If the field itself is an array, one of
   * its items must match one of the given values.
   */
  in(fieldname: string, values: DOC[keyof DOC][]): MonkQueryApi<API, DOC>;

  /** Applies when this field is not one of the given values. If the field itself is an array, none of
   * its items must match any of the given values.
   */
  notIn(fieldname: string, values: DOC[keyof DOC][]): MonkQueryApi<API, DOC>;

  lessThan(fieldname: string, value: Primitive): MonkQueryApi<API, DOC>;
  lessThanOrEqual(fieldname: string, value: Primitive): MonkQueryApi<API, DOC>;
  greaterThan(fieldname: string, value: Primitive): MonkQueryApi<API, DOC>;
  greaterThanOrEqual(fieldname: string, value: Primitive): MonkQueryApi<API, DOC>;

  /** Applies to documents that have this field at all. `value` can be passed to explicitly specify
   * whether the field must exist or must not exist. Defaults to `true`.
   */
  has(fieldname: string, value?: boolean): MonkQueryApi<API, DOC>;

  /** Return queried object(s) only with given fields. Fields must be in dot notation to match embedded documents.
   * TODO: Apply extractor lens.
   */
  extract(...fields: string[]): MonkQueryApi<API, any>;

  /** Return the queried object(s) without the given fields. Fields must be in dot notation to match embedded documents.
   * TODO: Apply extractor lens.
   */
  exclude(...fields: string[]): MonkQueryApi<API, any>;

  /** Checks if this query can be used, i.e. has at least one actual filter. */
  isValid(): boolean;

  /** Produces the final document query that can be passed to MongoDB. Typically only needed internally. */
  toQuery(): Filter<any>;

  /** Get configured projection for queries. */
  getProjection(): Record<string, 0 | 1> | undefined;
}

export type MonkQueryApiFactory<API extends {}, DOC> = (result: MonkQuery<API, DOC>) => API;
export type MonkQueryApi<API extends {}, DOC> = API & MonkQuery<API, DOC>;

export function createQuery<API extends object = {}, DOC = any>(
  coll: Collection,
  apiFactory: MonkQueryApiFactory<API, DOC>,
): MonkQueryApi<API, DOC> {
  const logicals = {
    all: '$and',
    any: '$or',
    xor: '$xor',
  };
  const operators = {
    exact: '$eq',
    equals: '$eq',
    notEquals: '$ne',
    lessThan: '$lt',
    lessThanOrEqual: '$lte',
    greaterThan: '$gt',
    greaterThanOrEqual: '$gte',
    in: '$in',
    notIn: '$nin',
  };

  let projection: Record<string, 0 | 1> | undefined;
  const factory = () => createQuery({ client: coll.client } as any, () => ({}));
  const query: any = {};

  const result: any = {
    is(fieldname: string, value: any) {
      query[fieldname] = Object.assign(query[fieldname] ?? {}, value);
      return this;
    },
    has(fieldname: string, value = true) { return this.is(fieldname, { $exists: value }) },
    not(sub: MonkQuery<API, DOC>) {
      query.$not = sub;
      return this;
    },
    sub: factory,
    extract(...fields: string[]) {
      projection = Object.fromEntries(fields.map(f => [f, 1]));
      return this;
    },
    exclude(...fields: string[]) {
      if (fields.length === 0) {
        projection = undefined;
        return this;
      }
      projection = Object.fromEntries(fields.map(f => [f, 0]));
      return this;
    },
    toQuery() {
      return Object.fromEntries(Object.entries(query).map(
        ([key, value]) => {
          if (value && typeof value === 'object' && 'toQuery' in value && typeof value.toQuery === 'function') {
            return [key, value.toQuery()];
          }
          return [key, coll.client.marshal(value)];
        }
      ));
    },
    getProjection: () => projection,
  };

  for (const prop in logicals) {
    result[prop] = function(this: any, ...queries: MonkQuery<API, DOC>[]) {
      //@ts-ignore
      query[logicals[prop]] = queries;
      return this;
    }
  }

  for (const prop in operators) {
    result[prop] = function(this: any, fieldname: keyof API & string, value: any) {
      //@ts-ignore
      return this.is(fieldname, { [operators[prop]]: value });
    };
  }

  return Object.assign(apiFactory(result), result);
}

createQuery.bindDocType = <DOC>() => <Factory extends MonkQueryApiFactory<any, any>>(
  coll: Collection,
  apiFactory: Factory,
) => createQuery<ReturnType<Factory>, DOC>(coll, apiFactory);
