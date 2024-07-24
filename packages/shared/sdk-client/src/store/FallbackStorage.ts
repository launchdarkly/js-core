// import {
//   LDLogger,
//   Storage
// } from '@launchdarkly/js-sdk-common';

// introduce a flag data manager to deal with atomicity of flag data calculateFlagChanges
// update fallbackstorage to be migration focused so that it is more intentional
//   it should delete existing data after moving data into the first priority data store

// /**
//  * A storage implementation that will use the provided storages in priority order with the first storage in
//  * the array being the highest priority.
//  * 
//  * @param storages A non empty list of storages, the first is highest priority.
//  */
// class MigrateV10ToV11Storage implements Storage {

//     constructor(private readonly storages: Array<Storage>){}

//     async clear(key: string): Promise<void> {
//       this.storages[0].clear(key)
//     }
  
//     async get(key: string): Promise<string | null> {
//       this.storages.forEach(async (s) => {
//         const value = await s.get(key)
//         if (value !== null) {
//           return value
//         }
//       })

//       return null
//     }
  
//     async set(key: string, value: string): Promise<void> {
//       this.storages[0].set(key, value)
//     }
// }