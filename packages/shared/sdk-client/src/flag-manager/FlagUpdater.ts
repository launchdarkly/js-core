import { Context, LDLogger } from "@launchdarkly/js-sdk-common";
import { LDEvaluationResultsMap } from "../types";
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

    init(context: Context, newFlags: Map<string, ItemDescriptor>) {
        this.activeContextKey = context.canonicalKey
        const oldFlags = this.flagStore.getAll()
        this.flagStore.init(newFlags)
        this.handleChanges(oldFlags, newFlags)
    }

    initCached(context: Context, newFlags: Map<string, ItemDescriptor>) {
        if (this.activeContextKey === context.canonicalKey) {
            return;
        }

        this.init(context, newFlags)
    }

    upsert(context: Context, key: string, item: ItemDescriptor) {
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

    private handleChanges(oldFlags: Map<string, ItemDescriptor>, newFlags: Map<string, ItemDescriptor>) {
        // TODO
    }

}