import { AttributeValue } from '@aws-sdk/client-dynamodb';

export function stringValue(val: string): AttributeValue {
  return { S: val };
}
export function boolValue(val: boolean): AttributeValue {
  return { BOOL: val };
}
export function numberValue(val: number): AttributeValue {
  return { N: val.toString(10) };
}
