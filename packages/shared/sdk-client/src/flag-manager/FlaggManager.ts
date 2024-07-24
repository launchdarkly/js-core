import { Context, LDLogger, Platform } from "@launchdarkly/js-sdk-common";

import FlagPersistence from "./FlagPersistence";
import FlagStore from "./FlagStore";
import FlagUpdater from "./FlagUpdater";
import { ItemDescriptor } from "./ItemDescriptor";
import { concatNamespacesAndValues } from "../utils/namespaceUtils";

export default class FlagManager {

    private flagStore = new FlagStore()
    private flagUpdater : FlagUpdater
    private flagPersistence: FlagPersistence

    constructor(
        platform: Platform, 
        sdkKey: string, 
        maxCachedContexts: number, 
        logger: LDLogger, 
        private readonly timeStamper: () => number = () => Date.now()
    ) {
        const environmentNamespace = concatNamespacesAndValues(platform.crypto, [
            {value: 'LaunchDarkly', hashIt: false},
            {value: sdkKey, hashIt: true}
        ])

        this.flagUpdater = new FlagUpdater(this.flagStore, logger)
        this.flagPersistence = new FlagPersistence(platform, environmentNamespace, maxCachedContexts, this.flagStore, this.flagUpdater, logger, timeStamper)
    }

    get(key: string) : ItemDescriptor | undefined {
        return this.flagStore.get(key)
    }

    getAll() : Map<string, ItemDescriptor> {
        return this.flagStore.getAll()
    }

    init(context: Context, newFlags: Map<string, ItemDescriptor>) {
        // TODO: update flag persistence
    }

    async upsert(context: Context, key: string, item: ItemDescriptor) : Promise<boolean> {
        // TODO: upsert flag persistence
        return true
    }

    async loadCached(context: Context) : Promise<boolean> {
        return this.flagPersistence.loadCached(context)
    }

}