
/**
 * An index for tracking the most recently used contexts by timestamp with the ability to
 * update entry timestamps and prune out least used contexts above a max capacity provided.
 */
export default class ContextIndex {
    private container: IndexContainer = { index: new Array<IndexEntry> }

    /**
     * Creates a {@link ContextIndex} from its JSON representation (likely retrieved from persistence).
     * @param json representation of the {@link ContextIndex}
     * @returns the {@link ContextIndex}
     */
    static fromJson(json: string): ContextIndex {
        let contextIndex = new ContextIndex()
        contextIndex.container = JSON.parse(json)
        return contextIndex
    }

    /**
     * @returns the JSON representation of the {@link ContextIndex} (like for saving to persistence)
     */
    toJson(): string {
        return JSON.stringify(this.container)
    }

    /**
     * Notice that a context has been used and when it was used.  This will update an existing record
     * with the given timestamp, or create a new record if one doesn't exist.
     * @param id of the corresponding context
     * @param timestamp in millis since epoch
     */
    notice(id: string, timestamp: number) {
        let entry = this.container.index.find((it) => it.id === id)
        if (entry === undefined) {
            this.container.index.push({ id: id, timestamp: timestamp })
        } else {
            entry.timestamp = timestamp
        }
    }

    /**
     * Prune the index to the specified max size and then return the IDs
     * @param maxContexts the maximum number of contexts to retain after this prune
     * @returns an array of removed entries
     */
    prune(maxContexts: number): Array<IndexEntry> {
        if (this.container.index.length > maxContexts) {
            // sort by timestamp so that newer timestamps appear first in the array
            this.container.index.sort((a, b) => b.timestamp - a.timestamp)
            // delete the end elements above capacity.  splice returns removed elements
            return this.container.index.splice(maxContexts, this.container.index.length - maxContexts);
        } else {
            return []
        }
    }
}

interface IndexContainer {
    index: Array<IndexEntry>
}

interface IndexEntry {
    id: string
    timestamp: number
}
