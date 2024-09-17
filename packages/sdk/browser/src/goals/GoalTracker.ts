import escapeStringRegexp from 'escape-string-regexp';

import { ClickGoal, Goal, Matcher } from './Goals';

type EventHandler = (goal: Goal) => void;

export function matchesUrl(matcher: Matcher, href: string, search: string, hash: string) {
  /**
   * Hash fragments are included when they include forward slashes to allow for applications that
   * use path-like hashes. (http://example.com/url/path#/additional/path)
   *
   * When they do not include a forward slash they are considered anchors and are not included
   * in matching.
   */
  const keepHash = (matcher.kind === 'substring' || matcher.kind === 'regex') && hash.includes('/');
  // For most matching purposes we want the "canonical" URL, which in this context means the
  // excluding the query parameters and hash (unless the hash is path-like).
  const canonicalUrl = (keepHash ? href : href.replace(hash, '')).replace(search, '');

  switch (matcher.kind) {
    case 'exact':
      return new RegExp(`^${escapeStringRegexp(matcher.url)}/?$`).test(href);
    case 'canonical':
      return new RegExp(`^${escapeStringRegexp(matcher.url)}/?$`).test(canonicalUrl);
    case 'substring':
      return new RegExp(`.*${escapeStringRegexp(matcher.substring)}.*$`).test(canonicalUrl);
    case 'regex':
      return new RegExp(matcher.pattern).test(canonicalUrl);
    default:
      return false;
  }
}

function findGoalsForClick(event: Event, clickGoals: ClickGoal[]) {
  const matches: ClickGoal[] = [];

  clickGoals.forEach((goal) => {
    let target: Node | null = event.target as Node;
    const { selector } = goal;
    const elements = document.querySelectorAll(selector);

    // Traverse from the target of the event up the page hierarchy.
    // If there are no element that match the selector, then no need to check anything.
    while (target && elements.length) {
      // The elements are a NodeList, so it doesn't have the array functions. For performance we
      // do not convert it to an array.
      for (let elementIndex = 0; elementIndex < elements.length; elementIndex += 1) {
        if (target === elements[elementIndex]) {
          matches.push(goal);
          // The same element should not be in the list multiple times.
          // Multiple objects in the hierarchy can match the selector, so we don't break the outer
          // loop.
          break;
        }
      }
      target = target.parentNode as Node;
    }
  });

  return matches;
}

/**
 * Tracks the goals on an individual "page" (combination of route, query params, and hash).
 */
export default class GoalTracker {
  private clickHandler?: (event: Event) => void;
  constructor(goals: Goal[], onEvent: EventHandler) {
    const pageviewGoals = goals.filter((goal) => goal.kind === 'pageview');
    const clickGoals = goals.filter((goal) => goal.kind === 'click');

    pageviewGoals.forEach((goal) => {
      const urlMatchers = goal.urls ?? [];
      urlMatchers.forEach((matcher) => {
        if (
          matchesUrl(matcher, window.location.href, window.location.search, window.location.hash)
        ) {
          onEvent(goal);
        }
      });
    });

    if (clickGoals.length) {
      // Click handler is not a member function in order to avoid having to bind it for the event
      // handler and then track a reference to that bound handler.
      this.clickHandler = (event: Event) => {
        findGoalsForClick(event, clickGoals).forEach((clickGoal) => {
          onEvent(clickGoal);
        });
      };
      document.addEventListener('click', this.clickHandler);
    }
  }

  /**
   * Close the tracker which stops listening to any events.
   */
  close() {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
  }
}
