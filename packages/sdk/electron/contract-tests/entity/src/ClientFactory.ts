import { ClientEntity, createEntity } from './ClientEntity';
import { CommandParams } from './CommandParams';
import { CreateInstanceParams } from './ConfigParams';

export default class ClientFactory {
  private _clientCounter = 0;
  private _clients: Record<string, ClientEntity> = {};

  async createClient(options: CreateInstanceParams) {
    const id = this._clientCounter.toString();
    this._clientCounter += 1;

    const client = await createEntity(options);
    this._clients[id] = client;

    return id;
  }

  async deleteClient(id: string) {
    const client = this._clients[id];
    if (!client) {
      throw new Error(`Client not found: ${id}`);
    }
    await client.close();
    delete this._clients[id];
  }

  async runCommand(id: string, command: CommandParams) {
    const client = this._clients[id];
    if (!client) {
      throw new Error(`Client not found: ${id}`);
    }
    return client.doCommand(command);
  }
}
