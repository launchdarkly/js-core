import { HttpBreadcrumb } from '../api/Breadcrumb';
import HttpCollectorOptions from '../collectors/http/HttpCollectorOptions';
import filterUrl from './filterUrl';

/**
 * This function does in-place filtering of http breadcrumbs.
 *
 * @param crumb The breadcrumb to filter.
 */
export default function filterHttpBreadcrumb(
  crumb: HttpBreadcrumb,
  options: HttpCollectorOptions,
): void {
  if (crumb.data?.url) {
    // Re-assigning for performance. The contract of the function is clear that the input
    // data is modified.
    // eslint-disable-next-line no-param-reassign
    crumb.data.url = filterUrl(options.urlFilters, crumb.data.url);
  }
}
