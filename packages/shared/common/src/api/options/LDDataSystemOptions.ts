export interface LDDataSystemOptions {

    this.offline = validatedOptions.offline;
    this.stream = validatedOptions.stream;
    this.streamInitialReconnectDelay = validatedOptions.streamInitialReconnectDelay;
    this.useLdd = validatedOptions.useLdd;

    if (TypeValidators.Function.is(validatedOptions.updateProcessor)) {
      // @ts-ignore
      this.updateProcessorFactory = validatedOptions.updateProcessor;
    } else {
      // The processor is already created, just have the method return it.
      // @ts-ignore
      this.updateProcessorFactory = () => validatedOptions.updateProcessor;
    }

    if (TypeValidators.Function.is(validatedOptions.featureStore)) {
      // @ts-ignore
      this.featureStoreFactory = validatedOptions.featureStore;
    } else {
      // The store is already created, just have the method return it.
      // @ts-ignore
      this.featureStoreFactory = () => validatedOptions.featureStore;
    }

    /**
     * List of synchronizer factories that will be used in priority order for initialization.
     * Expect them to be called any number of times.
     */
    initializerFactories: InitializerFactory[];

    /**
     * List of synchronizer factories that will be used in priority order for syncrhonization.
     * of data. Expect them to be called any number of times.
     */
    syncFactories: SynchronizerFactory[];

    store: 
}
