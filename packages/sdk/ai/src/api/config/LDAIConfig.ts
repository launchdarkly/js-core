import { LDAIConfigTracker } from "./LDAIConfigTracker";

/**
 * AI Config value and tracker.
*/
export interface LDAIConfig {
	/**
	 * The result of the AI Config evaluation.
	 */
	config: unknown;
      
	/**
	 * A tracker which can be used to generate analytics for the migration.
	 */
	tracker: LDAIConfigTracker;
      }