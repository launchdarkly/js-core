/**
 * Represents an override for a specific custom event.
 * 
 * This does not use the data store type, because storage would not be shared between
 * client and server implementations.
 */
export interface LDMetricOverride {
  samplingRatio?: number;
}

/**
 * Interfaces for accessing dynamic event configuration data from LaunchDarkly.
 * 
 * LaunchDarkly may adjust the rate of sampling of specific event types, or
 * specific custom events.
 */
export interface LDEventOverrides {
  
}