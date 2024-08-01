import { Context, LDLogger, Platform } from "@launchdarkly/js-sdk-common";

import FlagPersistence from "./FlagPersistence";
import FlagStore from "./FlagStore";
import FlagUpdater, { FlagsChangeCallback } from "./FlagUpdater";
import { ItemDescriptor } from "./ItemDescriptor";
import { concatNamespacesAndValues } from "../utils/namespaceUtils";

export default class FlagManager {

    private flagStore = new FlagStore()
    private flagUpdater: FlagUpdater
    private flagPersistence: FlagPersistence

    constructor(
        platform: Platform,
        sdkKey: string,
        maxCachedContexts: number,
        logger: LDLogger,
        private readonly timeStamper: () => number = () => Date.now()
    ) {
        // TODO: update to use helper function
        const environmentNamespace = concatNamespacesAndValues(platform.crypto, [
            { value: 'LaunchDarkly', hashIt: false },
            { value: sdkKey, hashIt: true }
        ])

        this.flagUpdater = new FlagUpdater(this.flagStore, logger)
        this.flagPersistence = new FlagPersistence(platform, environmentNamespace, maxCachedContexts, this.flagStore, this.flagUpdater, logger, timeStamper)
    }

    get(key: string): ItemDescriptor | undefined {
        return this.flagStore.get(key)
    }

    getAll(): { [key: string]: ItemDescriptor } {
        return this.flagStore.getAll()
    }

    async init(context: Context, newFlags: { [key: string]: ItemDescriptor }): Promise<void> {
        return this.flagPersistence.init(context, newFlags)
    }

    async upsert(context: Context, key: string, item: ItemDescriptor): Promise<boolean> {
        return this.flagPersistence.upsert(context, key, item)
    }

    async loadCached(context: Context): Promise<boolean> {
        return this.flagPersistence.loadCached(context)
    }

    on(callback: FlagsChangeCallback): void {
        this.flagUpdater.on(callback);
    }

    off(callback: FlagsChangeCallback): void {
        this.flagUpdater.off(callback);
    }
}
