import { Context, LDLogger } from "@launchdarkly/js-sdk-common";
import { Flags } from "../types";
import { ItemDescriptor } from "./ItemDescriptor";
import FlagStore from "./FlagStore";

export default class FlagUpdater {

    private flagStore : FlagStore
    private logger : LDLogger
    private activeContextKey : string | undefined

    constructor(flagStore: FlagStore, logger: LDLogger) {
        this.flagStore = flagStore
        this.logger = logger
    }

    init(context: Context, newFlags: {[key: string]: ItemDescriptor}) {
        this.activeContextKey = context.canonicalKey
        const oldFlags = this.flagStore.getAll()
        this.flagStore.init(newFlags)
        this.handleChanges(oldFlags, newFlags)
    }

    initCached(context: Context, newFlags: {[key: string]: ItemDescriptor}) {
        if (this.activeContextKey === context.canonicalKey) {
            return;
        }

        this.init(context, newFlags)
    }

    upsert(context: Context, key: string, item: ItemDescriptor): boolean {
        if (this.activeContextKey !== context.canonicalKey) {
            this.logger.warn('Received an update for an inactive context.')
            return false
        }

        const currentValue = this.flagStore.get(key)
        if (currentValue !== undefined && currentValue.version >= item.version) {
            // this is an out of order update that can be ignored
            return false
        }

        // TODO notify listeners

        this.flagStore.insertOrUpdate(key, item)
        return true
    }

    private handleChanges(oldFlags: {[key: string]: ItemDescriptor}, newFlags: {[key: string]: ItemDescriptor}) {
        // TODO
    }

}