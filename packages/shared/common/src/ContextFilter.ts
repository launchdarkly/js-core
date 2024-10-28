// _meta is part of the specification.

/* eslint-disable no-underscore-dangle */
import { LDContextCommon } from './api';
import AttributeReference from './AttributeReference';
import Context from './Context';

// These attributes cannot be removed via a private attribute.
const protectedAttributes = ['key', 'kind', '_meta', 'anonymous'].map(
  (str) => new AttributeReference(str, true),
);

// Attributes that should be stringified for legacy users.
const legacyTopLevelCopyAttributes = [
  'name',
  'ip',
  'firstName',
  'lastName',
  'email',
  'avatar',
  'country',
];

function compare(a: AttributeReference, b: string[]) {
  return a.depth === b.length && b.every((value, index) => value === a.getComponent(index));
}

function cloneWithRedactions(target: LDContextCommon, references: AttributeReference[]): any {
  const stack: {
    key: string;
    ptr: string[];
    source: any;
    parent: any;
    visited: any[];
  }[] = [];
  const cloned: any = {};
  const excluded: string[] = [];

  stack.push(
    ...Object.keys(target).map((key) => ({
      key,
      ptr: [key],
      source: target,
      parent: cloned,
      visited: [target],
    })),
  );

  while (stack.length) {
    const item = stack.pop()!;
    const redactRef = references.find((ref) => compare(ref, item.ptr));
    if (!redactRef) {
      const value = item.source[item.key];

      // Handle null because it overlaps with object, which we will want to handle later.
      if (value === null) {
        item.parent[item.key] = value;
      } else if (Array.isArray(value)) {
        item.parent[item.key] = [...value];
      } else if (typeof value === 'object') {
        // Arrays and null must already be handled.

        // Prevent cycles by not visiting the same object
        // with in the same branch. Different branches
        // may contain the same object.
        //
        // Same object visited twice in different branches.
        // A -> B -> D
        //   -> C -> D
        // This is fine, which is why it doesn't just check if the object
        // was visited ever.
        if (!item.visited.includes(value)) {
          item.parent[item.key] = {};

          stack.push(
            ...Object.keys(value).map((key) => ({
              key,
              ptr: [...item.ptr, key],
              source: value,
              parent: item.parent[item.key],
              visited: [...item.visited, value],
            })),
          );
        }
      } else {
        item.parent[item.key] = value;
      }
    } else {
      excluded.push(redactRef.redactionName);
    }
  }
  return { cloned, excluded: excluded.sort() };
}

export default class ContextFilter {
  constructor(
    private readonly _allAttributesPrivate: boolean,
    private readonly _privateAttributes: AttributeReference[],
  ) {}

  filter(context: Context, redactAnonymousAttributes: boolean = false): any {
    const contexts = context.getContexts();
    if (contexts.length === 1) {
      return this._filterSingleKind(
        context,
        contexts[0][1],
        contexts[0][0],
        redactAnonymousAttributes,
      );
    }
    const filteredMulti: any = {
      kind: 'multi',
    };
    contexts.forEach(([kind, single]) => {
      filteredMulti[kind] = this._filterSingleKind(
        context,
        single,
        kind,
        redactAnonymousAttributes,
      );
    });
    return filteredMulti;
  }

  private _getAttributesToFilter(
    context: Context,
    single: LDContextCommon,
    kind: string,
    redactAllAttributes: boolean,
  ) {
    return (
      redactAllAttributes
        ? Object.keys(single).map((k) => new AttributeReference(k, true))
        : [...this._privateAttributes, ...context.privateAttributes(kind)]
    ).filter((attr) => !protectedAttributes.some((protectedAttr) => protectedAttr.compare(attr)));
  }

  private _filterSingleKind(
    context: Context,
    single: LDContextCommon,
    kind: string,
    redactAnonymousAttributes: boolean,
  ): any {
    const redactAllAttributes =
      this._allAttributesPrivate || (redactAnonymousAttributes && single.anonymous === true);
    const { cloned, excluded } = cloneWithRedactions(
      single,
      this._getAttributesToFilter(context, single, kind, redactAllAttributes),
    );

    if (context.legacy) {
      legacyTopLevelCopyAttributes.forEach((name) => {
        if (name in cloned) {
          cloned[name] = String(cloned[name]);
        }
      });
    }

    if (excluded.length) {
      if (!cloned._meta) {
        cloned._meta = {};
      }
      cloned._meta.redactedAttributes = excluded;
    }
    if (cloned._meta) {
      delete cloned._meta.privateAttributes;
      if (Object.keys(cloned._meta).length === 0) {
        delete cloned._meta;
      }
    }

    return cloned;
  }
}
