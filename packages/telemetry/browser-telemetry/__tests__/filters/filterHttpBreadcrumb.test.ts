import { HttpBreadcrumb } from '../../src/api/Breadcrumb';
import filterHttpBreadcrumb from '../../src/filters/filterHttpBreadcrumb';

it('filters breadcrumbs with the provided filters', () => {
  const breadcrumb: HttpBreadcrumb = {
    class: 'http',
    timestamp: Date.now(),
    level: 'info',
    type: 'xhr',
    data: {
      method: 'GET',
      url: 'dog',
      statusCode: 200,
      statusText: 'ok',
    },
  };
  filterHttpBreadcrumb(breadcrumb, {
    urlFilters: [(url) => url.replace('dog', 'cat')],
  });
  expect(breadcrumb.data?.url).toBe('cat');
});
