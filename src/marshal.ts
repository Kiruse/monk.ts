import { IgnoreMarshalUnit, defineMarshalUnit, extendDefaultMarshaller, morph, pass } from '@kiruse/marshal';
import { ObjectId } from 'mongodb';

export const MongoIDRenamer = defineMarshalUnit(
  (value: any, passback) => typeof value === 'object' && value?.id instanceof ObjectId
    //@ts-ignore
    ? morph(passback({ _id: value.id, ...omit(value, 'id') }))
    : pass,
  (value: any, passback) => typeof value === 'object' && value?._id instanceof ObjectId
    //@ts-ignore
    ? morph(passback({ id: value._id, ...omit(value, '_id') }))
    : pass,
  true,
);

export const defaultMarshaller = extendDefaultMarshaller([
  IgnoreMarshalUnit(ObjectId, Date),
  MongoIDRenamer,
]);
