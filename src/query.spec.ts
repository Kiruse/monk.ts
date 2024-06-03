import { expect, test } from 'bun:test';
import { createQuery } from './query.js';
import { defaultMarshaller } from './marshal.js';

const TEST_COLLECTION: any = {
  client: {
    marshal: defaultMarshaller.marshal,
    unmarshal: defaultMarshaller.unmarshal,
  },
};
const TEST_API_FACTORY = () => ({});

test('.toQuery()', () => {
  const q = createQuery(TEST_COLLECTION, TEST_API_FACTORY);
  expect(q.toQuery()).toEqual({});

  q.exact('type', 'foo');
  expect(q.toQuery()).toEqual({ type: { $eq: 'foo' } });

  q.greaterThan('count', 5);
  expect(q.toQuery()).toEqual({ type: { $eq: 'foo' }, count: { $gt: 5 } });

  q.lessThanOrEqual('count', 10);
  expect(q.toQuery()).toEqual({ type: { $eq: 'foo' }, count: { $gt: 5, $lte: 10 } });
});
