import { DynamoDBClient, paginateScan, WriteRequest } from '@aws-sdk/client-dynamodb';
import DynamoDBClientState from '../src/DynamoDBClientState';

export default async function clearPrefix(table: string, prefix?: string) {
  const actualPrefix = prefix ? `${prefix}:` : '';

  const client = new DynamoDBClient({
    endpoint: 'http://localhost:8000',
    region: 'us-west-2',
    credentials: { accessKeyId: 'fake', secretAccessKey: 'fake' },
  });

  const state = new DynamoDBClientState({dynamoDBClient: client});

  const deleteOps: WriteRequest[] = [];

  for await (const page of paginateScan({ client }, {
    TableName: table
  })) {
    page?.Items?.forEach((item) => {
      console.log(JSON.stringify(item));
      if(item?.namespace?.S?.startsWith(actualPrefix)) {
        console.log("potato");
        deleteOps.push({
          DeleteRequest: {
          Key: {
            namespace: item.namespace,
            key: item.key
          }
        }
        });
      }
    });
  }

  if(deleteOps.length) {
    await state.batchWrite(table, deleteOps);
  }
}
