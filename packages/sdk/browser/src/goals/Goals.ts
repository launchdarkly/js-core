export type GoalKind = 'click' | 'pageview';

export type MatcherKind = 'exact' | 'canonical' | 'substring' | 'regex';

export interface ExactMatcher {
  kind: 'exact';
  url: string;
}

export interface SubstringMatcher {
  kind: 'substring';
  substring: string;
}

export interface CanonicalMatcher {
  kind: 'canonical';
  url: string;
}

export interface RegexMatcher {
  kind: 'regex';
  pattern: string;
}

export type Matcher = ExactMatcher | SubstringMatcher | CanonicalMatcher | RegexMatcher;

export interface PageViewGoal {
  key: string;
  kind: 'pageview';
  urls?: Matcher[];
}

export interface ClickGoal {
  key: string;
  kind: 'click';
  urls?: Matcher[];
  selector: string;
}

export type Goal = PageViewGoal | ClickGoal;

export function isClick(goal: Goal): goal is ClickGoal {
  return goal.kind === 'click';
}
