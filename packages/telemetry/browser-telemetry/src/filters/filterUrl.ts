import { UrlFilter } from '../api/Options';

export default function filterUrl(filters: UrlFilter[], url?: string): string {
  if (!url) {
    return '';
  }
  return filters.reduce((filtered, filter) => filter(filtered), url);
}
