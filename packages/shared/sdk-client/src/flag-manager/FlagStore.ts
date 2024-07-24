import { ItemDescriptor } from "./ItemDescriptor";

export default class FlagStore {
    private flags : Map<string, ItemDescriptor> = new Map()

    init(newFlags: Map<string, ItemDescriptor>) {
        this.flags.clear()
        newFlags.forEach((value, key) => this.flags.set(key, value));
    }

    insertOrUpdate(key: string, update: ItemDescriptor) {
        this.flags.set(key, update)
    }

    get(key: string): ItemDescriptor | undefined {
        return this.flags.get(key)
    }

    getAll() : Map<string, ItemDescriptor> {
        return new Map([...this.flags])
    }
}