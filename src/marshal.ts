import { IgnoreMarshalUnit, defineMarshalUnit, extendDefaultMarshaller, morph, pass } from '@kiruse/marshal';
import { ObjectId } from 'mongodb';
import { omit } from './util.js';

export const MongoIDRenamer = defineMarshalUnit(
  (value: any, { marshal }) => typeof value === 'object' && value?.id instanceof ObjectId
    //@ts-ignore
    ? morph(marshal({ _id: value.id, ...omit(value, 'id') }))
    : pass,
  (value: any, { unmarshal }) => typeof value === 'object' && value?._id instanceof ObjectId
    //@ts-ignore
    ? morph(unmarshal({ id: value._id, ...omit(value, '_id') }))
    : pass,
  true,
);

export const defaultMarshaller = extendDefaultMarshaller([
  IgnoreMarshalUnit(ObjectId, Date),
  MongoIDRenamer,
]);
