/* eslint-disable no-underscore-dangle */
// eslint-disable-next-line max-classes-per-file
import type {
  Crypto,
  LDContext,
  LDContextCommon,
  LDMultiKindContext,
  LDSingleKindContext,
  LDUser,
} from './api';
import AttributeReference from './AttributeReference';
import { isLegacyUser, isMultiKind, isSingleKind } from './internal/context';
import { TypeValidators } from './validators';

// The general strategy for the context is to transform the passed in context
// as little as possible. We do convert the legacy users to a single kind
// context, but we do not translate all passed contexts into a rigid structure.
// The context will have to be copied for events, but we want to avoid any
// copying that we can.
// So we validate that the information we are given is correct, and then we
// just proxy calls with a nicely typed interface.
// This is to reduce work on the hot-path. Later, for event processing, deeper
// cloning of the context will be done.

// When no kind is specified, then this kind will be used.
const DEFAULT_KIND = 'user';

// The API allows for calling with an `LDContext` which is
// `LDUser | LDSingleKindContext | LDMultiKindContext`. When ingesting a context
// first the type must be determined to allow us to put it into a consistent type.

/**
 * The partial URL encoding is needed because : is a valid character in context keys.
 *
 * Partial encoding is the replacement of all colon (:) characters with the URL
 * encoded equivalent (%3A) and all percent (%) characters with the URL encoded
 * equivalent (%25).
 * @param key The key to encode.
 * @returns Partially URL encoded key.
 */
function encodeKey(key: string): string {
  if (key.includes('%') || key.includes(':')) {
    return key.replace(/%/g, '%25').replace(/:/g, '%3A');
  }
  return key;
}

/**
 * Check if the given value is a LDContextCommon.
 * @param kindOrContext
 * @returns true if it is an LDContextCommon
 *
 * Due to a limitation in the expressiveness of these highly polymorphic types any field
 * in a multi-kind context can either be a context or 'kind'. So we need to re-assure
 * the compiler that it isn't the word multi.
 *
 * Because we do not allow top level values in a multi-kind context we can validate
 * that as well.
 */
function isContextCommon(
  kindOrContext: 'multi' | LDContextCommon,
): kindOrContext is LDContextCommon {
  return kindOrContext && TypeValidators.Object.is(kindOrContext);
}

/**
 * Validate a context kind.
 * @param kind
 * @returns true if the kind is valid.
 */
function validKind(kind: string) {
  return TypeValidators.Kind.is(kind);
}

/**
 * Validate a context key.
 * @param key
 * @returns true if the key is valid.
 */
function validKey(key: string) {
  return TypeValidators.String.is(key) && key !== '';
}

function processPrivateAttributes(
  privateAttributes?: string[],
  literals: boolean = false,
): AttributeReference[] {
  if (privateAttributes) {
    return privateAttributes.map(
      (privateAttribute) => new AttributeReference(privateAttribute, literals),
    );
  }
  return [];
}

function defined(value: any) {
  return value !== null && value !== undefined;
}

/**
 * Convert a legacy user to a single kind context.
 * @param user
 * @returns A single kind context.
 */
function legacyToSingleKind(user: LDUser): LDSingleKindContext {
  const singleKindContext: LDSingleKindContext = {
    // Key was coerced to a string for eval and events, so we can do that up-front.
    ...(user.custom || []),
    kind: 'user',
    key: String(user.key),
  };

  // For legacy users we never established a difference between null
  // and undefined for inputs. Because anonymous can be used in evaluations
  // we would want it to not possibly match true/false unless defined.
  // Which is different than coercing a null/undefined anonymous as `false`.
  if (defined(user.anonymous)) {
    const anonymous = !!user.anonymous;
    delete singleKindContext.anonymous;
    singleKindContext.anonymous = anonymous;
  }

  if (user.name !== null && user.name !== undefined) {
    singleKindContext.name = user.name;
  }
  if (user.ip !== null && user.ip !== undefined) {
    singleKindContext.ip = user.ip;
  }
  if (user.firstName !== null && user.firstName !== undefined) {
    singleKindContext.firstName = user.firstName;
  }
  if (user.lastName !== null && user.lastName !== undefined) {
    singleKindContext.lastName = user.lastName;
  }
  if (user.email !== null && user.email !== undefined) {
    singleKindContext.email = user.email;
  }
  if (user.avatar !== null && user.avatar !== undefined) {
    singleKindContext.avatar = user.avatar;
  }
  if (user.country !== null && user.country !== undefined) {
    singleKindContext.country = user.country;
  }
  if (user.privateAttributeNames !== null && user.privateAttributeNames !== undefined) {
    singleKindContext._meta = {
      privateAttributes: user.privateAttributeNames,
    };
  }

  // We are not pulling private attributes over because we will serialize
  // those from attribute references for events.

  return singleKindContext;
}

/**
 * Container for a context/contexts. Because contexts come from external code
 * they must be thoroughly validated and then formed to comply with
 * the type system.
 */
export default class Context {
  private _context?: LDContextCommon;

  private _isMulti: boolean = false;

  private _isUser: boolean = false;

  private _wasLegacy: boolean = false;

  private _contexts: Record<string, LDContextCommon> = {};

  private _privateAttributeReferences?: Record<string, AttributeReference[]>;

  public readonly kind: string;

  /**
   * Is this a valid context. If a valid context cannot be created, then this flag will be true.
   * The validity of a context should be tested before it is used.
   */
  public readonly valid: boolean;

  public readonly message?: string;

  static readonly UserKind: string = DEFAULT_KIND;

  /**
   * Contexts should be created using the static factory method {@link Context.fromLDContext}.
   * @param kind The kind of the context.
   *
   * The factory methods are static functions within the class because they access private
   * implementation details, so they cannot be free functions.
   */
  private constructor(valid: boolean, kind: string, message?: string) {
    this.kind = kind;
    this.valid = valid;
    this.message = message;
  }

  private static _contextForError(kind: string, message: string) {
    return new Context(false, kind, message);
  }

  private static _getValueFromContext(
    reference: AttributeReference,
    context?: LDContextCommon,
  ): any {
    if (!context || !reference.isValid) {
      return undefined;
    }

    if (reference.depth === 1 && reference.getComponent(0) === 'anonymous') {
      return !!context?.anonymous;
    }
    return reference.get(context);
  }

  private _contextForKind(kind: string): LDContextCommon | undefined {
    if (this._isMulti) {
      return this._contexts[kind];
    }
    if (this.kind === kind) {
      return this._context;
    }
    return undefined;
  }

  private static _fromMultiKindContext(context: LDMultiKindContext): Context {
    const kinds = Object.keys(context).filter((key) => key !== 'kind');
    const kindsValid = kinds.every(validKind);

    if (!kinds.length) {
      return Context._contextForError(
        'multi',
        'A multi-kind context must contain at least one kind',
      );
    }

    if (!kindsValid) {
      return Context._contextForError('multi', 'Context contains invalid kinds');
    }

    const privateAttributes: Record<string, AttributeReference[]> = {};
    let contextsAreObjects = true;
    const contexts = kinds.reduce((acc: Record<string, LDContextCommon>, kind) => {
      const singleContext = context[kind];
      if (isContextCommon(singleContext)) {
        acc[kind] = singleContext;
        privateAttributes[kind] = processPrivateAttributes(singleContext._meta?.privateAttributes);
      } else {
        // No early break isn't the most efficient, but it is an error condition.
        contextsAreObjects = false;
      }
      return acc;
    }, {});

    if (!contextsAreObjects) {
      return Context._contextForError('multi', 'Context contained contexts that were not objects');
    }

    if (!Object.values(contexts).every((part) => validKey(part.key))) {
      return Context._contextForError('multi', 'Context contained invalid keys');
    }

    // There was only a single kind in the multi-kind context.
    // So we can just translate this to a single-kind context.
    if (kinds.length === 1) {
      const kind = kinds[0];
      const created = new Context(true, kind);
      created._context = { ...contexts[kind], kind };
      created._privateAttributeReferences = privateAttributes;
      created._isUser = kind === 'user';
      return created;
    }

    const created = new Context(true, context.kind);
    created._contexts = contexts;
    created._privateAttributeReferences = privateAttributes;

    created._isMulti = true;
    return created;
  }

  private static _fromSingleKindContext(context: LDSingleKindContext): Context {
    const { key, kind } = context;
    const kindValid = validKind(kind);
    const keyValid = validKey(key);

    if (!kindValid) {
      return Context._contextForError(kind ?? 'unknown', 'The kind was not valid for the context');
    }

    if (!keyValid) {
      return Context._contextForError(kind, 'The key for the context was not valid');
    }

    // The JSON interfaces uses dangling _.
    // eslint-disable-next-line no-underscore-dangle
    const privateAttributeReferences = processPrivateAttributes(context._meta?.privateAttributes);
    const created = new Context(true, kind);
    created._isUser = kind === 'user';
    created._context = context;
    created._privateAttributeReferences = {
      [kind]: privateAttributeReferences,
    };
    return created;
  }

  private static _fromLegacyUser(context: LDUser): Context {
    const keyValid = context.key !== undefined && context.key !== null;
    // For legacy users we allow empty keys.
    if (!keyValid) {
      return Context._contextForError('user', 'The key for the context was not valid');
    }
    const created = new Context(true, 'user');
    created._isUser = true;
    created._wasLegacy = true;
    created._context = legacyToSingleKind(context);
    created._privateAttributeReferences = {
      user: processPrivateAttributes(context.privateAttributeNames, true),
    };
    return created;
  }

  /**
   * Attempt to create a {@link Context} from an {@link LDContext}.
   * @param context The input context to create a Context from.
   * @returns a {@link Context}, if the context was not valid, then the returned contexts `valid`
   * property will be false.
   */
  public static fromLDContext(context: LDContext): Context {
    if (!context) {
      return Context._contextForError('unknown', 'No context specified. Returning default value');
    }
    if (isSingleKind(context)) {
      return Context._fromSingleKindContext(context);
    }
    if (isMultiKind(context)) {
      return Context._fromMultiKindContext(context);
    }
    if (isLegacyUser(context)) {
      return Context._fromLegacyUser(context);
    }

    return Context._contextForError('unknown', 'Context was not of a valid kind');
  }

  /**
   * Creates a {@link LDContext} from a {@link Context}.
   * @param context to be converted
   * @returns an {@link LDContext} if input was valid, otherwise undefined
   */
  public static toLDContext(context: Context): LDContext | undefined {
    if (!context.valid) {
      return undefined;
    }

    const contexts = context.getContexts();
    if (!context._isMulti) {
      return contexts[0][1];
    }
    const result: LDMultiKindContext = {
      kind: 'multi',
    };
    contexts.forEach((kindAndContext) => {
      const kind = kindAndContext[0];
      const nestedContext = kindAndContext[1];
      result[kind] = nestedContext;
    });
    return result;
  }

  /**
   * Attempt to get a value for the given context kind using the given reference.
   * @param reference The reference to the value to get.
   * @param kind The kind of the context to get the value for.
   * @returns a value or `undefined` if one is not found.
   */
  public valueForKind(reference: AttributeReference, kind: string = DEFAULT_KIND): any | undefined {
    if (reference.isKind) {
      return this.kinds;
    }
    return Context._getValueFromContext(reference, this._contextForKind(kind));
  }

  /**
   * Attempt to get a key for the specified kind.
   * @param kind The kind to get a key for.
   * @returns The key for the specified kind, or undefined.
   */
  public key(kind: string = DEFAULT_KIND): string | undefined {
    return this._contextForKind(kind)?.key;
  }

  /**
   * True if this is a multi-kind context.
   */
  public get isMultiKind(): boolean {
    return this._isMulti;
  }

  /**
   * Get the canonical key for this context.
   */
  public get canonicalKey(): string {
    if (this._isUser) {
      return this._context!.key;
    }
    if (this._isMulti) {
      return Object.keys(this._contexts)
        .sort()
        .map((key) => `${key}:${encodeKey(this._contexts[key].key)}`)
        .join(':');
    }
    return `${this.kind}:${encodeKey(this._context!.key)}`;
  }

  /**
   * Get the kinds of this context.
   */
  public get kinds(): string[] {
    if (this._isMulti) {
      return Object.keys(this._contexts);
    }
    return [this.kind];
  }

  /**
   * Get the kinds, and their keys, for this context.
   */
  public get kindsAndKeys(): Record<string, string> {
    if (this._isMulti) {
      return Object.entries(this._contexts).reduce(
        (acc: Record<string, string>, [kind, context]) => {
          acc[kind] = context.key;
          return acc;
        },
        {},
      );
    }
    return { [this.kind]: this._context!.key };
  }

  /**
   * Get the attribute references.
   *
   * @param kind
   */
  public privateAttributes(kind: string): AttributeReference[] {
    return this._privateAttributeReferences?.[kind] || [];
  }

  /**
   * Get the underlying context objects from this context.
   *
   * This method is intended to be used in event generation.
   *
   * The returned objects should not be modified.
   */
  public getContexts(): [string, LDContextCommon][] {
    if (this._isMulti) {
      return Object.entries(this._contexts);
    }
    return [[this.kind, this._context!]];
  }

  public get legacy(): boolean {
    return this._wasLegacy;
  }

  public async hash(crypto: Crypto): Promise<string | undefined> {
    if (!this.valid) {
      return undefined;
    }

    const hasher = crypto.createHash('sha256');

    const stack: {
      target: any;
      visited: any[];
    }[] = [];

    const kinds = this.kinds.sort();

    kinds.forEach((kind) => {
      hasher.update(kind);
      const context = this._contextForKind(kind)!;
      Object.getOwnPropertyNames(context)
        .sort()
        .forEach((key) => {
          // Handled using private attributes.
          if (key === '_meta') {
            return;
          }
          hasher.update(key);
          stack.push({
            target: context[key],
            visited: [context],
          });
        });

      const sortedAttributes = this.privateAttributes(kind)
        .map((attr) => attr.components.join('/'))
        .sort();
      sortedAttributes.forEach((attr) => hasher.update(attr));
    });

    while (stack.length > 0) {
      const { target, visited } = stack.pop()!;
      if (visited.includes(target)) {
        return undefined;
      }
      visited.push(target);
      if (typeof target === 'object' && target !== null && target !== undefined) {
        Object.getOwnPropertyNames(target)
          .sort()
          .forEach((key) => {
            hasher.update(key);
            stack.push({
              target: target[key],
              visited: [...visited, target],
            });
          });
      } else {
        hasher.update(String(target));
      }
    }

    if (hasher.digest) {
      return hasher.digest('hex');
    }

    // The hasher must have either digest or asyncDigest.
    const digest = await hasher.asyncDigest!('hex');
    return digest;
  }
}
