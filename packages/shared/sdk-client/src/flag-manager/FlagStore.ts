import { ItemDescriptor } from "./ItemDescriptor";

export default class FlagStore {
    private flags : {[key: string]: ItemDescriptor} = {}

    init(newFlags: {[key: string]: ItemDescriptor}) {
        this.flags = {}
        for (const key in newFlags) {
            this.flags[key] = newFlags[key]
        }
    }

    insertOrUpdate(key: string, update: ItemDescriptor) {
        this.flags[key] = update
    }

    get(key: string): ItemDescriptor | undefined {
        return this.flags[key]
    }

    getAll() : {[key: string]: ItemDescriptor} {
        // TODO: discuss immutability
        return this.flags
    }
}
