import { Context, Crypto as LDCrypto, LDLogger, Platform } from "@launchdarkly/js-sdk-common";
import { LDEvaluationResult, LDEvaluationResultsMap } from "../types";
import FlagStore from "./FlagStore";
import FlagUpdater from "./FlagUpdater";
import { ItemDescriptor } from "./ItemDescriptor";
import { concatNamespacesAndValues } from "../utils/namespaceUtils";

const CONTEXT_INDEX_KEY = 'ContextIndex'

export default class FlagPersistence {

    private contextIndex: ContextIndex | undefined
    private indexKey: string

    constructor(
        private readonly platform: Platform,
        private readonly environmentNamespace: string,
        private readonly maxCachedContexts: number,
        private readonly flagStore: FlagStore,
        private readonly flagUpdater: FlagUpdater,
        private readonly logger: LDLogger,
        private readonly timeStamper: () => number = () => Date.now()
    ) { 
        this.indexKey = concatNamespacesAndValues(platform.crypto, [
            {value: this.environmentNamespace, hashIt: false},
            {value: 'ContextIndex', hashIt: false}
        ])
    }

    async init(context: Context, newFlags: Map<string, ItemDescriptor>): Promise<void> {
        this.flagUpdater.init(context, newFlags)
        return this.storeCache(context)
    }

    async loadCached(context: Context) : Promise<boolean> {
        const storageKey = concatNamespacesAndValues(this.platform.crypto, [
            {value: this.environmentNamespace, hashIt: false},
            {value: context.canonicalKey, hashIt: true}
        ])
        const json = await this.platform.storage?.get(storageKey)
        if (json === null || json === undefined) {
            return false
        }

        try {
            const flagEvals: LDEvaluationResultsMap = JSON.parse(json)
            // TODO: is there a more efficient way in javascript to do this map transform
            const descriptors = new Map<string, ItemDescriptor>()
            
            flagEvals.forEach((flag: LDEvaluationResult, key: string) => {
                descriptors.set(key, {version: flag.version, flag: flag})
            });

            this.flagUpdater.initCached(context, descriptors)
            this.logger.debug('Loaded cached flag evaluations from persistent storage')
            return true
        } catch (e) {
            this.logger.warn('Could not load cached flag evaluations from persistent storage: ${e.message}')
            return false
        }
    }

    private async loadIndex(): Promise<ContextIndex> {
        if (this.contextIndex !== undefined) {
            return this.contextIndex
        }

        // TODO: this data fetch needs to be keyed by an environment key
        const json = await this.platform.storage?.get(this.indexKey)
        if (json === null || json === undefined) {
            this.contextIndex = new ContextIndex()
            return this.contextIndex
        }

        try {
            this.contextIndex = ContextIndex.fromJson(json)
            this.logger.debug('Loaded context index from persistent storage')
        } catch (e) {
            this.logger.warn('Could not load index from persistent storage: ${e.message}')
            this.contextIndex = new ContextIndex()
        }
        return this.contextIndex
    }

    private async storeCache(context: Context): Promise<void> {
        const index = await this.loadIndex()

        const contextStorageKey = concatNamespacesAndValues(this.platform.crypto, [
            {value: this.environmentNamespace, hashIt: false},
            {value: context.canonicalKey, hashIt: true}
        ])
        index.notice(contextStorageKey, this.timeStamper())

        const pruned = index.prune(this.maxCachedContexts)
        pruned.forEach(async (it) => {
            await this.platform.storage?.clear(it.id)
        })

        // store index
        await this.platform.storage?.set(this.indexKey, index.toJson())

        const allFlags = this.flagStore.getAll()
        // TODO: is there a more efficient way in javascript to do this map transform
        const sanitized : LDEvaluationResultsMap = new Map()
        
        allFlags.forEach((item: ItemDescriptor, key: string) => {
            if (item.flag !== null && item.flag !== undefined) {
                sanitized.set(key, item.flag)
            }
        });

        const jsonAll = JSON.stringify(sanitized)
        // store flag data
        await this.platform.storage?.set(contextStorageKey, jsonAll)
    }


}