import { Redis } from 'ioredis';

export default async function clearPrefix(prefix: string) {
  const client = new Redis();
  const keys = await client.keys(`${prefix}:*`);
  const promises = keys.map((key) => client.del(key));
  await Promise.all(promises);
  client.quit();
}
