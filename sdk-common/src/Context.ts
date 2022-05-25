// eslint-disable-next-line max-classes-per-file
import {
  LDSingleKindContext, LDMultiKindContext, LDUser, LDContextCommon,
} from './api/context';
import { LDContext } from './api/LDContext';
import AttributeReference from './AttributeReference';
import { TypeValidators } from './validators';

// The general strategy for the context is to tranform the passed in context
// as little as possible. We do convert the legacy users to a single kind
// context, but we do not translate all passed contexts into a rigid structure.
// The context will have to be copied for events, but we want to avoid any
// copying that we can.
// So we validate that the information we are given is correct, and then we
// just proxy calls with a nicely typed interface.

// Validates a kind excluding check that it isn't "kind".
const KindValidator = TypeValidators.StringMatchingRegex(/^(\w|\.|-)+$/);

// The API allows for calling with an `LDContext` which is
// `LDUser | LDSingleKindContext | LDMultiKindContext`. When ingesting a context
// first the type must be determined to allow us to put it into a consistent type.

/**
 * Check if a context is a single kind context.
 * @param context
 * @returns frue if the context is a single kind context.
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
 * the compiler that is isn't the word multi.
 *
 * Because we do not allow top level values in a multi-kind context we can validate
 * that as well.
 */
function isContextCommon(kindOrContext: 'multi' | LDContextCommon): kindOrContext is LDContextCommon {
  return TypeValidators.Object.is(kindOrContext);
}

/**
 * Validate a context kind.
 * @param kind
 * @returns true if the kind is valid.
 */
function validKind(kind: string) {
  return KindValidator.is(kind) && kind !== 'kind';
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

/**
 * Convert a legacy user to a single kind context.
 * @param user
 * @returns A single kind context.
 */
function legacyToSingleKind(user: LDUser): LDSingleKindContext {
  const singleKindContext: LDSingleKindContext = {
    ...(user.custom || []),
    kind: 'user',
    key: user.key,
  };

  // For legacy users we never established a difference between null
  // and undefined for inputs. Because transient can be used in evaluations
  // we would want it to not possibly match true/false unless defined.
  // Which is different than treating implicit transient as `false`.
  if (user.anonymous !== undefined && user.anonymous !== null) {
    const transient = !!singleKindContext.anonymous;
    delete singleKindContext.anonymous;
    singleKindContext.transient = transient;
  }

  return singleKindContext;
}

/**
 * Container for a context/contexts. Because contexts come from external code
 * they must be thoroughly validated and then formed to comply with
 * the type system.
 */
export default class Context {
  private context?: LDSingleKindContext;

  private isMulti: boolean = false;

  private isUser: boolean = false;

  private contexts: Record<string, LDContextCommon> = {};

  private privateAttributes?: Record<string, AttributeReference[]>;

  public readonly kind: string;

  /**
   * Contexts should be created using the static factory method {@link Context.FromLDContext}.
   * @param kind The kind of the context.
   *
   * The factory methods are static functions within the class because they access private
   * implementation details, so they cannot be free functions.
   */
  private constructor(kind: string) {
    this.kind = kind;
  }

  private static FromMultiKindContext(context: LDMultiKindContext): Context | undefined {
    const kinds = Object.keys(context).filter((key) => key !== 'kind');
    const kindsValid = kinds.every(validKind);

    if (!kindsValid) {
      return undefined;
    }

    let contextsAreObjects = true;
    const contexts = kinds.reduce((acc: Record<string, LDContextCommon>, kind) => {
      const singleContext = context[kind];
      if (isContextCommon(singleContext)) {
        acc[kind] = singleContext;
      } else {
        // No early break isn't the most efficient, but it is an error condition.
        contextsAreObjects = false;
      }
      return acc;
    }, {});

    if (!contextsAreObjects) {
      return undefined;
    }

    if (!Object.values(contexts).every((part) => validKey(part.key))) {
      return undefined;
    }

    const created = new Context(context.kind);
    created.contexts = contexts;

    created.isMulti = true;
    return created;
  }

  private static FromSingleKindContext(context: LDSingleKindContext): Context | undefined {
    const { key, kind } = context;
    const kindValid = validKind(kind);
    const keyValid = validKey(key);

    if (keyValid && kindValid) {
      // The JSON interfaces uses dandling _.
      // eslint-disable-next-line no-underscore-dangle
      const privateAttributeReferences = processPrivateAttributes(context._meta?.privateAttributes);
      const created = new Context(kind);
      created.isUser = kind === 'user';
      created.context = context;
      created.privateAttributes = {
        [kind]: privateAttributeReferences,
      };
      return created;
    }
    return undefined;
  }

  private static FromLegacyUser(context: LDUser): Context | undefined {
    const keyValid = context.key !== undefined && context.key !== null;
    // For legacy users we allow empty keys.
    if (!keyValid) {
      return undefined;
    }
    const created = new Context('user');
    created.isUser = true;
    created.context = legacyToSingleKind(context);
    created.privateAttributes = {
      user: processPrivateAttributes(context.privateAttributeNames, true),
    };
    return created;
  }

  /**
   * Attempt to create a {@link Context} from an {@link LDContext}.
   * @param context The input context to create a Context from.
   * @returns a {@link Context} or `undefined` if one could not be created.
   */
  static FromLDContext(context: LDContext): Context | undefined {
    if (isSingleKind(context)) {
      return Context.FromSingleKindContext(context);
    } if (isMultiKind(context)) {
      return Context.FromMultiKindContext(context);
    } if (isLegacyUser(context)) {
      return Context.FromLegacyUser(context);
    }
    return undefined;
  }

  public get isMultiKind(): boolean {
    return this.isMulti;
  }

  public get canonicalKey(): string {
    if (this.isUser) {
      return this.context!.key;
    }
    if (this.isMulti) {
      return Object.keys(this.contexts).map((key) => `${key}:${encodeURIComponent(this.contexts[key].key)}`)
        .join(':');
    }
    return `${this.kind}:${encodeURIComponent(this.context!.key)}`;
  }

  public get kinds(): string[] {
    if (this.isMulti) {
      return Object.keys(this.contexts);
    }
    return [this.kind];
  }

  private static getValueFromContext(
    reference: AttributeReference,
    context?: LDContextCommon,
  ): any {
    if (!context || !reference.isValid) {
      return undefined;
    }

    return reference.get(context);
  }

  /**
   * Attempt to get a value for the given context kind using the given reference.
   * @param kind The kind of the context to get the value for.
   * @param reference The reference to the value to get.
   * @returns a value or `undefined` if one is not found.
   */
  public getValueForKind(kind: string, reference: AttributeReference): any | undefined {
    const context = this.isMulti ? this.contexts[kind] : this.context;
    return Context.getValueFromContext(reference, context);
  }
}
