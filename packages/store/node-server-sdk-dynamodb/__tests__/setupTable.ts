import { CreateTableCommand, DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';

export default async function setupTable(tableName: string, options: DynamoDBClientConfig) {
  const client = new DynamoDBClient(options);
  try {
    await client.send(new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [
        { AttributeName: 'namespace', AttributeType: 'S' },
        { AttributeName: 'key', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'namespace', KeyType: 'HASH' },
        { AttributeName: 'key', KeyType: 'RANGE' } //Sort key
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10
      },
    }));
  } catch (err) {
    // Table probably existed.
  }
  client.destroy();
}
