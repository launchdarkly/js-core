/**
 * Defines the 'class' of the breadcrumb.
 */
export type BreadcrumbClass =
  | 'custom'
  | 'log'
  | 'navigation'
  | 'feature-management'
  | 'ui'
  | 'http';

/**
 * Indicates the severity of the breadcrumb.
 */
export type BreadcrumbLevel = 'error' | 'warning' | 'info' | 'debug';

/**
 * Types of data support with breadcrumbs.
 */
export type BreadcrumbDataValue = boolean | number | string;

/**
 * Defines arbitrary data that may be associated with a breadcrumb.
 */
export type BreadcrumbData = Record<string, BreadcrumbDataValue>;

/**
 * Interface which defines a breadcrumb.
 */
export interface Breadcrumb {
  /**
   * The class of the breadcrumb. This is the top level categorization of breadcrumbs.
   */
  class: BreadcrumbClass;

  /**
   * When the event associated with the breadcrumb happened. The timestamp is in milliseconds since January 1, 1970
   * Universal Coordinated Time (UTC)
   *
   * For most breadcrumbs this will not be different than the time of breadcrumb creation, but if there is a delay
   * between the event and breadcrumb capture, then the time of the event should be used instead.
   */
  timestamp: number;

  /**
   * The level of severity of the breadcrumb. The default choice of level should be `info` if there isn't a clear
   * reason to use a different level.
   */
  level: BreadcrumbLevel;

  /**
   * The type of the breadcrumb. Each class may be split into multiple types with the type more specifically
   * categorizing the type of event.
   */
  type?: string;

  /**
   * A message associated with the breadcrumb.
   */
  message?: string;

  /**
   * Any data associated with the breadcrumb.
   */
  data?: BreadcrumbData;
}

/**
 * Utility type which allows for easy extension of base breadcrumb type.
 */
export type ImplementsCrumb<U extends Breadcrumb> = U;

/**
 * Type for custom breadcrumbs.
 */
export type CustomBreadcrumb = ImplementsCrumb<{
  class: 'custom';
  timestamp: number;
  level: BreadcrumbLevel;
  type?: string;
  message?: string;
  data?: BreadcrumbData;
}>;

/**
 * Type for log breadcrumbs.
 */
export type LogBreadcrumb = ImplementsCrumb<{
  class: 'log';
  timestamp: number;
  level: BreadcrumbLevel;
  message: string;
  data?: BreadcrumbData;
}>;

/**
 * Type for navigation breadcrumbs.
 */
export type NavigationBreadcrumb = ImplementsCrumb<{
  class: 'navigation';
  timestamp: number;
  level: 'info';
  type?: string;
  data?: {
    /**
     * The location being navigated from. In a web application this would typically be a URL.
     */
    from?: string;
    /**
     * The location being navigated to. In a web application this would typically be a URL.
     */
    to?: string;
  };
}>;

/**
 * Type for feature management breadcrumbs.
 */
export type FeatureManagementBreadcrumb = ImplementsCrumb<{
  class: 'feature-management';
  timestamp: number;
  level: 'info';
  type: 'flag-evaluated' | 'flag-detail-changed';
  data?: {
    /**
     * The flag key.
     */
    key?: string;
    // Not supporting JSON flags in breadcrumbs. As noted in design we may want to eventually support none of the
    // values in the breadcrumb.
    /**
     * The evaluated value for simple types.
     */
    value?: boolean | string | number;
  };
}>;

/**
 * Type for UI breadcrumbs.
 */
export type UiBreadcrumb = ImplementsCrumb<{
  class: 'ui';
  timestamp: number;
  level: 'info';
  type: 'click' | 'input';
  message: string;
}>;

/**
 * Type for HTTP breadcrumbs.
 */
export type HttpBreadcrumb = ImplementsCrumb<{
  class: 'http';
  timestamp: number;
  level: 'error' | 'info'; // Error if an error status code?
  type: 'xhr' | 'fetch';
  data?: {
    url?: string;
    method?: string;
    statusCode: number;
    statusText: string;
  };
}>;
