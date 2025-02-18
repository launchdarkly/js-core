import { MinLogger } from '../../api/MinLogger';
import { UrlFilter } from '../../api/Options';

/**
 * Options which impact the behavior of http collectors.
 */
export default interface HttpCollectorOptions {
  /**
   * A list of filters to execute on the URL of the breadcrumb.
   *
   * This allows for redaction of potentially sensitive information in URLs.
   */
  urlFilters: UrlFilter[];

  /**
   * Method to get a logger for warnings.
   *
   * This is a function to allow for accessing the current logger, as the logger
   * instance may change during runtime.
   */
  getLogger?: () => MinLogger;
}
