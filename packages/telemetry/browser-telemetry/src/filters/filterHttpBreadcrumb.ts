import { HttpBreadcrumb } from '../api/Breadcrumb';
import HttpCollectorOptions from '../collectors/http/HttpCollectorOptions';
import filterUrl from '../collectors/http/filterUrl';

/**
 * This function does in-place filtering of http breadcrumbs.
 *
 * @param crumb The breadcrumb to filter.
 */
export default function filterHttpBreadcrumb(crumb: HttpBreadcrumb, options: HttpCollectorOptions): void {
  if(crumb.data?.url) {
    crumb.data.url = filterUrl(options.urlFilters, crumb.data.url);
  }
}
