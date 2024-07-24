// import {
//   LDLogger,
//   Storage
// } from '@launchdarkly/js-sdk-common';

// /**
//  * A storage implementation that drops the least recently used entry when another entry above capacity is added.
//  * The index for this storage implementation will be saved in the same namespace as the data will be stored, so the
//  * '_Index' key is reserved.  Attempting to set '_Index' will result in error.
//  */
// class LRUStorage implements Storage {

//     constructor(private readonly storage: Storage, private readonly namespacePrefix: string, 
//       private readonly capacity: number, private readonly logger: LDLogger){}

//     async clear(key: string): Promise<void> {
//       return this.storage.clear(this.namespacePrefix+key)
//     }
  
//     async get(key: string): Promise<string | null> {
//       return this.storage.get(this.namespacePrefix+key)
//     }
  
//     async set(key: string, value: string): Promise<void> {
//       if (key === '_Index') {
//         // TODO: update log message
//         this.logger.error('TODO - _Index is reserved')
//         return
//       }

//       let internalKey = this.namespacePrefix+key
//       await this.storage.set(internalKey, value)

//       // update the index
//       let indexKey = this.namespacePrefix + '_Index'
//       let data = await this.storage.get(indexKey)
//       let index: Index
//       if (data != null && data != undefined) {
//         index = JSON.parse(data)
//       } else {
//         index = {entries: []}
//       }
//       let indexSize = index.entries.push({key: internalKey, timestamp: Date.now()})
//       if (indexSize > this.capacity) {
//         // sort by timestamp so that newer timestamps appear first in the array
//         index.entries.sort((a, b) => b.timestamp - a.timestamp)
//         // delete the end elements above capacity
//         let removed = index.entries.splice(this.capacity, indexSize - this.capacity);
//         // delete associated data
//         removed.forEach(async (r) => await this.storage.clear(this.namespacePrefix+r.key))
//       }
//       // save the index
//       await this.storage.set(indexKey, JSON.stringify(index))
//     }
// }

// interface Index {
//   entries: Array<IndexEntry>
// }

// interface IndexEntry {
//   key: string
//   timestamp: number
// }