
class ContextIndex {
    private container : IndexContainer

    constructor(){
        this.container = {index: []}
    }

    toJson() : string {
        return JSON.stringify(this.container)
    }

    notice(id: string, timestamp: number) {
        let entry = this.container.index.find((it) => it.id == id)
        if (entry === undefined) {
            this.container.index.push({id: id, timestamp: timestamp})
        } else {
            entry.timestamp = timestamp
        }
    }

    prune(maxContexts: number) : Array<IndexEntry> {
          if (this.container.index.length > maxContexts) {
            // sort by timestamp so that newer timestamps appear first in the array
            this.container.index.sort((a, b) => b.timestamp - a.timestamp)
            // delete the end elements above capacity
            return this.container.index.splice(maxContexts, this.container.index.length - maxContexts);
          } else {
            return []
          }
    }

    static fromJson(json: string) : ContextIndex {
        let contextIndex = new ContextIndex()
        contextIndex.container = JSON.parse(json)
        return contextIndex
    }
}

interface IndexContainer {
    index: Array<IndexEntry>
}

interface IndexEntry {
    id: string
    timestamp: number
}