import type {
  LDAutoEnv,
  LDContext,
  LDContextCommon,
  LDMultiKindContext,
  LDSingleKindContext,
  LDUser,
} from './api';
import AttributeReference from './AttributeReference';
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
 * Check if a context is a single kind context.
 * @param context
 * @returns true if the context is a single kind context.
 */
function isSingleKind(context: LDContext): context is LDSingleKindContext {
  if ('kind' in context) {
    return TypeValidators.String.is(context.kind) && context.kind !== 'multi';
  }
  return false;
}

/**
 * Check if a context is a multi-kind context.
 * @param context
 * @returns true if it is a multi-kind context.
 */
function isMultiKind(context: LDContext): context is LDMultiKindContext {
  if ('kind' in context) {
    return TypeValidators.String.is(context.kind) && context.kind === 'multi';
  }
  return false;
}

/**
 * Check if a context is a legacy user context.
 * @param context
 * @returns true if it is a legacy user context.
 */
function isLegacyUser(context: LDContext): context is LDUser {
  return !('kind' in context) || context.kind === null || context.kind === undefined;
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
  kindOrContext: 'multi' | LDContextCommon | undefined,
): kindOrContext is LDContextCommon {
  return !!kindOrContext && TypeValidators.Object.is(kindOrContext);
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

  // We are not pulling private attributes over because we will serialize
  // those from attribute references for events.

  return singleKindContext;
}

function createAutoEnv({ ld_application, ld_device }: LDContext) {
  return { ld_application, ld_device };
}

/**
 * Container for a context/contexts. Because contexts come from external code
 * they must be thoroughly validated and then formed to comply with
 * the type system.
 */
export default class Context {
  private context?: LDContextCommon;

  private isMulti: boolean = false;

  private isUser: boolean = false;

  private wasLegacy: boolean = false;

  private contexts: Record<string, LDContextCommon> = {};

  private privateAttributeReferences?: Record<string, AttributeReference[]>;

  public readonly kind: string;

  /**
   * Is this a valid context. If a valid context cannot be created, then this flag will be true.
   * The validity of a context should be tested before it is used.
   */
  public readonly valid: boolean;

  public readonly message?: string;

  public autoEnv?: LDAutoEnv;

  static readonly userKind: string = DEFAULT_KIND;

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

  private static contextForError(kind: string, message: string) {
    return new Context(false, kind, message);
  }

  private static getValueFromContext(
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

  private contextForKind(kind: string): LDContextCommon | undefined {
    if (this.isMulti) {
      return this.contexts[kind];
    }
    if (this.kind === kind) {
      return this.context;
    }
    return undefined;
  }

  private static fromMultiKindContext(context: LDMultiKindContext): Context {
    const kinds = Object.keys(context).filter((key) => key !== 'kind');
    const kindsValid = kinds.every(validKind);

    if (!kinds.length) {
      return Context.contextForError(
        'multi',
        'A multi-kind context must contain at least one kind',
      );
    }

    if (!kindsValid) {
      return Context.contextForError('multi', 'Context contains invalid kinds');
    }

    const privateAttributes: Record<string, AttributeReference[]> = {};
    let contextsAreObjects = true;
    const contexts = kinds.reduce((acc: Record<string, LDContextCommon>, kind) => {
      const singleContext = context[kind];
      if (isContextCommon(singleContext)) {
        acc[kind] = singleContext;
        // eslint-disable-next-line no-underscore-dangle
        privateAttributes[kind] = processPrivateAttributes(singleContext._meta?.privateAttributes);
      } else {
        // No early break isn't the most efficient, but it is an error condition.
        contextsAreObjects = false;
      }
      return acc;
    }, {});

    if (!contextsAreObjects) {
      return Context.contextForError('multi', 'Context contained contexts that were not objects');
    }

    if (!Object.values(contexts).every((part) => validKey(part.key))) {
      return Context.contextForError('multi', 'Context contained invalid keys');
    }

    // There was only a single kind in the multi-kind context.
    // So we can just translate this to a single-kind context.
    if (kinds.length === 1) {
      const kind = kinds[0];
      const created = new Context(true, kind);
      created.context = contexts[kind];
      created.autoEnv = createAutoEnv(context);
      created.privateAttributeReferences = privateAttributes;
      created.isUser = kind === 'user';
      return created;
    }

    const created = new Context(true, context.kind);
    created.contexts = contexts;
    created.autoEnv = createAutoEnv(context);
    created.privateAttributeReferences = privateAttributes;
    created.isMulti = true;
    return created;
  }

  private static fromSingleKindContext(context: LDSingleKindContext): Context {
    const { key, kind } = context;
    const kindValid = validKind(kind);
    const keyValid = validKey(key);

    if (!kindValid) {
      return Context.contextForError(kind ?? 'unknown', 'The kind was not valid for the context');
    }

    if (!keyValid) {
      return Context.contextForError(kind, 'The key for the context was not valid');
    }

    // The JSON interfaces uses dangling _.
    // eslint-disable-next-line no-underscore-dangle
    const privateAttributeReferences = processPrivateAttributes(context._meta?.privateAttributes);
    const created = new Context(true, kind);
    created.isUser = kind === 'user';
    created.context = context;
    created.autoEnv = createAutoEnv(context);
    created.privateAttributeReferences = {
      [kind]: privateAttributeReferences,
    };
    return created;
  }

  private static fromLegacyUser(context: LDUser): Context {
    const keyValid = context.key !== undefined && context.key !== null;
    // For legacy users we allow empty keys.
    if (!keyValid) {
      return Context.contextForError('user', 'The key for the context was not valid');
    }
    const created = new Context(true, 'user');
    created.autoEnv = createAutoEnv(context);
    created.isUser = true;
    created.wasLegacy = true;
    created.context = legacyToSingleKind(context);
    created.privateAttributeReferences = {
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
      return Context.contextForError('unknown', 'No context specified. Returning default value');
    }
    if (isSingleKind(context)) {
      return Context.fromSingleKindContext(context);
    }
    if (isMultiKind(context)) {
      return Context.fromMultiKindContext(context);
    }
    if (isLegacyUser(context)) {
      return Context.fromLegacyUser(context);
    }

    return Context.contextForError('unknown', 'Context was not of a valid kind');
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
    return Context.getValueFromContext(reference, this.contextForKind(kind));
  }

  /**
   * Attempt to get a key for the specified kind.
   * @param kind The kind to get a key for.
   * @returns The key for the specified kind, or undefined.
   */
  public key(kind: string = DEFAULT_KIND): string | undefined {
    return this.contextForKind(kind)?.key;
  }

  /**
   * True if this is a multi-kind context.
   */
  public get isMultiKind(): boolean {
    return this.isMulti;
  }

  /**
   * Get the canonical key for this context.
   */
  public get canonicalKey(): string {
    if (this.isUser) {
      return this.context!.key;
    }
    if (this.isMulti) {
      return Object.keys(this.contexts)
        .sort()
        .map((key) => `${key}:${encodeKey(this.contexts[key].key)}`)
        .join(':');
    }
    return `${this.kind}:${encodeKey(this.context!.key)}`;
  }

  /**
   * Get the kinds of this context.
   */
  public get kinds(): string[] {
    if (this.isMulti) {
      return Object.keys(this.contexts);
    }
    return [this.kind];
  }

  /**
   * Get the kinds, and their keys, for this context.
   */
  public get kindsAndKeys(): Record<string, string> {
    if (this.isMulti) {
      return Object.entries(this.contexts).reduce(
        (acc: Record<string, string>, [kind, context]) => {
          acc[kind] = context.key;
          return acc;
        },
        {},
      );
    }
    return { [this.kind]: this.context!.key };
  }

  /**
   * Get the attribute references.
   *
   * @param kind
   */
  public privateAttributes(kind: string): AttributeReference[] {
    return this.privateAttributeReferences?.[kind] || [];
  }

  /**
   * Get the underlying context objects from this context.
   *
   * This method is intended to be used in event generation.
   *
   * The returned objects should not be modified.
   */
  public getContexts(): [string, LDContextCommon][] {
    if (this.isMulti) {
      return Object.entries(this.contexts);
    }
    return [[this.kind, this.context!]];
  }

  public get legacy(): boolean {
    return this.wasLegacy;
  }
}
