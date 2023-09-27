/**
 * Meta attributes are used to control behavioral aspects of the Context.
 * They cannot be addressed in targeting rules.
 */
interface LDContextMeta {
    /**
     *
     * Designate any number of Context attributes, or properties within them, as private: that is,
     * their values will not be sent to LaunchDarkly.
     *
     * Each parameter can be a simple attribute name, such as "email". Or, if the first character is
     * a slash, the parameter is interpreted as a slash-delimited path to a property within a JSON
     * object, where the first path component is a Context attribute name and each following
     * component is a nested property name: for example, suppose the attribute "address" had the
     * following JSON object value:
     *
     * ```
     * {"street": {"line1": "abc", "line2": "def"}}
     * ```
     *
     * Using ["/address/street/line1"] in this case would cause the "line1" property to be marked as
     * private. This syntax deliberately resembles JSON Pointer, but other JSON Pointer features
     * such as array indexing are not supported for Private.
     *
     * This action only affects analytics events that involve this particular Context. To mark some
     * (or all) Context attributes as private for all users, use the overall configuration for the
     * SDK.
     * See {@link LDOptions.allAttributesPrivate} and {@link LDOptions.privateAttributes}.
     *
     * The attributes "kind" and "key", and the "_meta" attributes cannot be made private.
     *
     * In this example, firstName is marked as private, but lastName is not:
     *
     * ```
     * const context = {
     *   kind: 'org',
     *   key: 'my-key',
     *   firstName: 'Pierre',
     *   lastName: 'Menard',
     *   _meta: {
     *     privateAttributes: ['firstName'],
     *   }
     * };
     * ```
     *
     * This is a metadata property, rather than an attribute that can be addressed in evaluations:
     * that is, a rule clause that references the attribute name "privateAttributes", will not use
     * this value, but would use a "privateAttributes" attribute set on the context.
     */
    privateAttributes?: string[];
}

interface LDContextCommon {
    /**
     * A unique string identifying a context.
     */
    key: string;
    /**
     * The context's name.
     *
     * You can search for contexts on the Contexts page by name.
     */
    name?: string;
    /**
     * Meta attributes are used to control behavioral aspects of the Context, such as private
     * private attributes. See {@link LDContextMeta.privateAttributes} as an example.
     *
     * They cannot be addressed in targeting rules.
     */
    _meta?: LDContextMeta;
    /**
     * If true, the context will _not_ appear on the Contexts page in the LaunchDarkly dashboard.
     */
    anonymous?: boolean;
    /**
     * Any additional attributes associated with the context.
     */
    [attribute: string]: any;
}

declare class AttributeReference {
    readonly isValid: boolean;
    /**
     * When redacting attributes this name can be directly added to the list of
     * redactions.
     */
    readonly redactionName: string;
    /**
     * For use as invalid references when deserializing Flag/Segment data.
     */
    static readonly invalidReference: AttributeReference;
    private readonly components;
    /**
     * Take an attribute reference string, or literal string, and produce
     * an attribute reference.
     *
     * Legacy user objects would have been created with names not
     * references. So, in that case, we need to use them as a component
     * without escaping them.
     *
     * e.g. A user could contain a custom attribute of `/a` which would
     * become the literal `a` if treated as a reference. Which would cause
     * it to no longer be redacted.
     * @param refOrLiteral The attribute reference string or literal string.
     * @param literal it true the value should be treated as a literal.
     */
    constructor(refOrLiteral: string, literal?: boolean);
    get(target: LDContextCommon): LDContextCommon | undefined;
    getComponent(depth: number): string;
    get depth(): number;
    get isKind(): boolean;
    compare(other: AttributeReference): boolean;
}

/**
 * A context which represents multiple kinds. Each kind having its own key and attributes.
 *
 * A multi-context must contain `kind: 'multi'` at the root.
 *
 * ```
 * const myMultiContext = {
 *   // Multi-contexts must be of kind 'multi'.
 *   kind: 'multi',
 *   // The context is namespaced by its kind. This is an 'org' kind context.
 *   org: {
 *     // Each component context has its own key and attributes.
 *     key: 'my-org-key',
 *     someAttribute: 'my-attribute-value',
 *   },
 *   user: {
 *     key: 'my-user-key',
 *     firstName: 'Bob',
 *     lastName: 'Bobberson',
 *     _meta: {
 *       // Each component context has its own _meta attributes. This will only apply the this
 *       // 'user' context.
 *       privateAttributes: ['firstName']
 *     }
 *   }
 * };
 * ```
 *
 * The above multi-context contains both an 'org' and a 'user'. Each with their own key,
 * attributes, and _meta attributes.
 */
interface LDMultiKindContext {
    /**
     * The kind of the context.
     */
    kind: 'multi';
    /**
     * The contexts which compose this multi-kind context.
     *
     * These should be of type LDContextCommon. "multi" is to allow
     * for the top level "kind" attribute.
     */
    [kind: string]: 'multi' | LDContextCommon;
}

/**
 * A context which represents a single kind.
 *
 * For a single kind context the 'kind' may not be 'multi'.
 *
 * ```
 * const myOrgContext = {
 *   kind: 'org',
 *   key: 'my-org-key',
 *   someAttribute: 'my-attribute-value'
 * };
 * ```
 *
 * The above context would be a single kind context representing an organization. It has a key
 * for that organization, and a single attribute 'someAttribute'.
 */
interface LDSingleKindContext extends LDContextCommon {
    /**
     * The kind of the context.
     */
    kind: string;
}

/**
 * A LaunchDarkly user object.
 *
 * @deprecated
 */
interface LDUser {
    /**
     * A unique string identifying a user.
     */
    key: string;
    /**
     * The user's name.
     *
     * You can search for users on the User page by name.
     */
    name?: string;
    /**
     * The user's first name.
     */
    firstName?: string;
    /**
     * The user's last name.
     */
    lastName?: string;
    /**
     * The user's email address.
     *
     * If an `avatar` URL is not provided, LaunchDarkly will use Gravatar
     * to try to display an avatar for the user on the Users page.
     */
    email?: string;
    /**
     * An absolute URL to an avatar image for the user.
     */
    avatar?: string;
    /**
     * The user's IP address.
     *
     * If you provide an IP, LaunchDarkly will use a geolocation service to
     * automatically infer a `country` for the user, unless you've already
     * specified one.
     */
    ip?: string;
    /**
     * The country associated with the user.
     */
    country?: string;
    /**
     * If true, the user will _not_ appear on the Users page in the LaunchDarkly dashboard.
     */
    anonymous?: boolean;
    /**
     * Any additional attributes associated with the user.
     */
    custom?: {
        [key: string]: string | boolean | number | Array<string | boolean | number>;
    };
    /**
     * Specifies a list of attribute names (either built-in or custom) which should be
     * marked as private, and not sent to LaunchDarkly in analytics events. This is in
     * addition to any private attributes designated in the global configuration
     * with {@link LDOptions.privateAttributes} or {@link LDOptions.allAttributesPrivate}.
     */
    privateAttributeNames?: Array<string>;
}

/**
 * A LaunchDarkly context object.
 */
type LDContext = LDUser | LDSingleKindContext | LDMultiKindContext;

/**
 * Container for a context/contexts. Because contexts come from external code
 * they must be thoroughly validated and then formed to comply with
 * the type system.
 */
declare class Context {
    private context?;
    private isMulti;
    private isUser;
    private wasLegacy;
    private contexts;
    private privateAttributeReferences?;
    readonly kind: string;
    /**
     * Is this a valid context. If a valid context cannot be created, then this flag will be true.
     * The validity of a context should be tested before it is used.
     */
    readonly valid: boolean;
    readonly message?: string;
    static readonly userKind: string;
    /**
     * Contexts should be created using the static factory method {@link Context.fromLDContext}.
     * @param kind The kind of the context.
     *
     * The factory methods are static functions within the class because they access private
     * implementation details, so they cannot be free functions.
     */
    private constructor();
    private static contextForError;
    private static getValueFromContext;
    private contextForKind;
    private static fromMultiKindContext;
    private static fromSingleKindContext;
    private static fromLegacyUser;
    /**
     * Attempt to create a {@link Context} from an {@link LDContext}.
     * @param context The input context to create a Context from.
     * @returns a {@link Context}, if the context was not valid, then the returned contexts `valid`
     * property will be false.
     */
    static fromLDContext(context: LDContext): Context;
    /**
     * Attempt to get a value for the given context kind using the given reference.
     * @param reference The reference to the value to get.
     * @param kind The kind of the context to get the value for.
     * @returns a value or `undefined` if one is not found.
     */
    valueForKind(reference: AttributeReference, kind?: string): any | undefined;
    /**
     * Attempt to get a key for the specified kind.
     * @param kind The kind to get a key for.
     * @returns The key for the specified kind, or undefined.
     */
    key(kind?: string): string | undefined;
    /**
     * True if this is a multi-kind context.
     */
    get isMultiKind(): boolean;
    /**
     * Get the canonical key for this context.
     */
    get canonicalKey(): string;
    /**
     * Get the kinds of this context.
     */
    get kinds(): string[];
    /**
     * Get the kinds, and their keys, for this context.
     */
    get kindsAndKeys(): Record<string, string>;
    /**
     * Get the attribute references.
     *
     * @param kind
     */
    privateAttributes(kind: string): AttributeReference[];
    /**
     * Get the underlying context objects from this context.
     *
     * This method is intended to be used in event generation.
     *
     * The returned objects should not be modified.
     */
    getContexts(): [string, LDContextCommon][];
    get legacy(): boolean;
}

declare class ContextFilter {
    private readonly allAttributesPrivate;
    private readonly privateAttributes;
    constructor(allAttributesPrivate: boolean, privateAttributes: AttributeReference[]);
    filter(context: Context): any;
    private getAttributesToFilter;
    private filterSingleKind;
}

/**
 * Logging levels that can be used with {@link basicLogger}.
 *
 * Set{@link BasicLoggerOptions.level} to one of these values to control what levels
 * of log messages are enabled. Going from lowest importance (and most verbose)
 * to most importance, the levels are `'debug'`, `'info'`, `'warn'`, and `'error'`.
 * You can also specify `'none'` instead to disable all logging.
 */
type LDLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

/**
 * Configuration for {@link basicLogger}.
 */
interface BasicLoggerOptions {
    /**
     * The lowest level of log message to enable.
     *
     * See {@link LDLogLevel} for a list of possible levels. Setting a level here causes
     * all lower-importance levels to be disabled: for instance, if you specify
     * `'warn'`, then `'debug'` and `'info'` are disabled.
     *
     * If not specified, the default is `'info'` (meaning that `'debug'` is disabled).
     */
    level?: LDLogLevel;
    /**
     * Name to use for the log entires. The default name is `LaunchDarkly`.
     */
    name?: string;
    /**
     * An optional function to use to print each log line.
     *
     * If this is specified, `basicLogger` calls it to write each line of output. The
     * argument is a fully formatted log line, not including a linefeed. The function
     * is only called for log levels that are enabled.
     *
     * If not specified, the default is `console.error`.
     *
     * Setting this property to anything other than a function will cause SDK
     * initialization to fail.
     */
    destination?: (line: string) => void;
    /**
     * An optional formatter to use. The formatter should be compatible
     * with node-style format strings like those used with `util.format`.
     *
     * If not specified, then a default implementation will be used.
     * But using a node-specific implementation, for instance, would
     * have performance and quality benefits.
     */
    formatter?: (...args: any[]) => string;
}

/**
 * The LaunchDarkly client logger interface.
 *
 * The {@link LDOptions.logger} property accepts any object that conforms to this
 * interface. The SDK only uses four logging levels: `error`, `warn`, `info`, and
 * `debug`. It will call the corresponding method of the `LDLogger` either with a
 * single string argument, or with a format string and variable arguments in the
 * format used by Node's `util.format()`.
 *
 * The [Winston](https://github.com/winstonjs/winston) logging package provides a
 * logger that conforms to this interface, so if you have created a logger with
 * Winston, you can simply put it into the {@link LDOptions.logger} property.
 *
 * If you do not provide a logger object, the SDK uses the {@link basicLogger}
 * implementation with a minimum level of `info`.
 */
interface LDLogger {
    /**
     * The error logger.
     *
     * @param args
     *   A sequence of any JavaScript values.
     */
    error(...args: any[]): void;
    /**
     * The warning logger.
     *
     * @param args
     *   A sequence of any JavaScript values.
     */
    warn(...args: any[]): void;
    /**
     * The info logger.
     *
     * @param args
     *   A sequence of any JavaScript values.
     */
    info(...args: any[]): void;
    /**
     * The debug logger.
     *
     * @param args
     *   A sequence of any JavaScript values.
     */
    debug(...args: any[]): void;
}

/**
 * Describes the reason that a flag evaluation produced a particular value. This is
 * part of the {@link LDEvaluationDetail} object returned by `LDClient.variationDetail`.
 */
interface LDEvaluationReason {
    /**
     * The general category of the reason:
     *
     * - `'OFF'`: The flag was off and therefore returned its configured off value.
     * - `'FALLTHROUGH'`: The flag was on but the context did not match any targets or rules.
     * - `'TARGET_MATCH'`: The context key was specifically targeted for this flag.
     * - `'RULE_MATCH'`: the context matched one of the flag's rules.
     * - `'PREREQUISITE_FAILED'`: The flag was considered off because it had at least one
     *   prerequisite flag that either was off or did not return the desired variation.
     * - `'ERROR'`: The flag could not be evaluated, e.g. because it does not exist or due
     *   to an unexpected error.
     */
    kind: string;
    /**
     * A further description of the error condition, if the kind was `'ERROR'`.
     */
    errorKind?: string;
    /**
     * The index of the matched rule (0 for the first), if the kind was `'RULE_MATCH'`.
     */
    ruleIndex?: number;
    /**
     * The unique identifier of the matched rule, if the kind was `'RULE_MATCH'`.
     */
    ruleId?: string;
    /**
     * The key of the failed prerequisite flag, if the kind was `'PREREQUISITE_FAILED'`.
     */
    prerequisiteKey?: string;
    /**
     * Whether the evaluation was part of an experiment.
     *
     * This is true if the evaluation resulted in an experiment rollout and served one of
     * the variations in the experiment. Otherwise it is false or undefined.
     */
    inExperiment?: boolean;
    /**
     * Describes the validity of Big Segment information, if and only if the flag evaluation
     * required querying at least one Big Segment.
     *
     * - `'HEALTHY'`: The Big Segment query involved in the flag evaluation was successful, and
     *   the segment state is considered up to date.
     * - `'STALE'`: The Big Segment query involved in the flag evaluation was successful, but
     *   the segment state may not be up to date
     * - `'NOT_CONFIGURED'`: Big Segments could not be queried for the flag evaluation because
     *   the SDK configuration did not include a Big Segment store.
     * - `'STORE_ERROR'`: The Big Segment query involved in the flag evaluation failed, for
     *   instance due to a database error.
     */
    bigSegmentsStatus?: 'HEALTHY' | 'STALE' | 'NOT_CONFIGURED' | 'STORE_ERROR';
}

/**
 * The types of values a feature flag can have.
 *
 * Flags can have any JSON-serializable value.
 */
type LDFlagValue = any;

/**
 * An object that combines the result of a feature flag evaluation with information about
 * how it was calculated.
 *
 * This is the result of calling `LDClient.variationDetail`.
 *
 * For more information, see the [SDK reference guide](https://docs.launchdarkly.com/sdk/features/evaluation-reasons#nodejs-server-side).
 */
interface LDEvaluationDetail {
    /**
     * The result of the flag evaluation. This will be either one of the flag's variations or
     * the default value that was passed to `LDClient.variationDetail`.
     */
    value: LDFlagValue;
    /**
     * The index of the returned value within the flag's list of variations, e.g. 0 for the
     * first variation-- or `null` if the default value was returned.
     */
    variationIndex?: number | null;
    /**
     * An object describing the main factor that influenced the flag evaluation value.
     */
    reason: LDEvaluationReason;
}

/**
 * A map of feature flags from their keys to their values.
 */
interface LDFlagSet {
    [key: string]: LDFlagValue;
}

/**
 * Interface implemented by platform provided hasher.
 *
 * The hash implementation must support 'sha256' and 'sha1'.
 *
 * The has implementation must support digesting to 'hex' or 'base64'.
 */
interface Hasher {
    update(data: string): Hasher;
    digest(encoding: string): string;
}
/**
 * Interface implemented by platform provided hmac.
 *
 * The hash implementation must support 'sha256'.
 *
 * The has implementation must support digesting to 'hex'.
 */
interface Hmac extends Hasher {
    update(data: string): Hasher;
    digest(encoding: string): string;
}
/**
 * Interface provided by the platform for doing cryptographic operations.
 */
interface Crypto {
    createHash(algorithm: string): Hasher;
    createHmac(algorithm: string, key: string): Hmac;
    randomUUID(): string;
}

interface WatchHandle {
    /**
     * Stop watching.
     */
    close(): void;
}
/**
 * Interface for doing filesystem operations on the platform.
 */
interface Filesystem {
    /**
     * The time, in ms since POSIX epoch, that the file was last modified.
     * @param path The path to get a timestamp for.
     *
     * @returns A promise which will resolve to a timestamp if successful, or be
     * rejected if the operation fails.
     */
    getFileTimestamp(path: string): Promise<number>;
    /**
     * Read a file into a utf8 encoded string.
     * @param path The path of the file to read.
     *
     * @returns A promise which will resolve to utf8 encoded file content, or be
     * rejected if the operation fails.
     */
    readFile(path: string): Promise<string>;
    /**
     * Watch for changes to the specified path.
     *
     * The implementation of this methods should be non-persistent. Meaning that
     * it should not keep the containing process running as long as it is
     * executing. For node this means setting the persistent option to false.
     *
     * @param path The path to watch.
     *
     * @returns An async iterator that watches for changes to `path`.
     */
    watch(path: string, callback: (eventType: string, filename: string) => void): WatchHandle;
}

/**
 * Information about the platform of the SDK and the environment it is executing.
 */
interface PlatformData {
    /**
     * Information about the OS on which the SDK is running. Should be populated
     * when available. Not all platforms will make this data accessible.
     */
    os?: {
        /**
         * The architecture. Ideally at runtime, but may be build time if that is
         * a constraint.
         */
        arch?: string;
        /**
         * The name of the OS. "MacOS", "Windows", or "Linux". If not one of those,
         * then use the value provided by the OS.
         */
        name?: string;
        /** The version of the OS. */
        version?: string;
    };
    /**
     * The name of the platform the SDK is running on. For instance 'Node'.
     */
    name?: string;
    /**
     * Any additional attributes associated with the platform.
     */
    additional?: Record<string, string>;
}
interface SdkData {
    /**
     * The name of the SDK. e.g. "node-server-sdk"
     */
    name?: string;
    /**
     * The version of the SDK.
     */
    version?: string;
    /**
     * If this is a top-level (not a wrapper) SDK this will be used to create the user agent string.
     * It will take the form 'userAgentBase/version`.
     */
    userAgentBase?: string;
    /**
     * Name of the wrapper SDK if present.
     */
    wrapperName?: string;
    /**
     * Version of the wrapper if present.
     */
    wrapperVersion?: string;
}
/**
 * Interface for getting information about the SDK or the environment it is
 * executing in.
 */
interface Info {
    /**
     * Get information about the platform.
     */
    platformData(): PlatformData;
    /**
     * Get information about the SDK implementation.
     */
    sdkData(): SdkData;
}

type EventName = 'delete' | 'patch' | 'ping' | 'put';
type EventListener = (event?: {
    data?: any;
}) => void;
type ProcessStreamResponse = {
    deserializeData: (data: string) => any;
    processJson: (json: any) => void;
};
interface EventSource {
    onclose: (() => void) | undefined;
    onerror: (() => void) | undefined;
    onopen: (() => void) | undefined;
    onretrying: ((e: {
        delayMillis: number;
    }) => void) | undefined;
    addEventListener(type: EventName, listener: EventListener): void;
    close(): void;
}
interface EventSourceInitDict {
    errorFilter: (err: {
        status: number;
        message: string;
    }) => boolean;
    headers: {
        [key: string]: string | string[];
    };
    initialRetryDelayMillis: number;
    readTimeoutMillis: number;
    retryResetIntervalMillis: number;
}

/**
 * Interface for headers that are part of a fetch response.
 */
interface Headers {
    /**
     * Get a header by name.
     *
     * https://developer.mozilla.org/en-US/docs/Web/API/Headers/get
     *
     * @param name The name of the header to get.
     */
    get(name: string): string | null;
    /**
     * Returns an iterator allowing iteration of all the keys contained
     * in this object.
     *
     * https://developer.mozilla.org/en-US/docs/Web/API/Headers/keys
     *
     */
    keys(): Iterable<string>;
    /**
     * Returns an iterator allowing iteration of all the values contained
     * in this object.
     *
     * https://developer.mozilla.org/en-US/docs/Web/API/Headers/values
     */
    values(): Iterable<string>;
    /**
     * Returns an iterator allowing iteration of all the key-value pairs in
     * the object.
     *
     * https://developer.mozilla.org/en-US/docs/Web/API/Headers/entries
     */
    entries(): Iterable<[string, string]>;
    /**
     * Returns true if the header is present.
     * @param name The name of the header to check.
     */
    has(name: string): boolean;
}
/**
 * Interface for fetch responses.
 */
interface Response {
    headers: Headers;
    status: number;
    /**
     * Read the response and provide it as a string.
     */
    text(): Promise<string>;
    /**
     * Read the response and provide it as decoded json.
     */
    json(): Promise<any>;
}
interface Options {
    headers?: Record<string, string>;
    method?: string;
    body?: string;
    timeout?: number;
}
interface Requests {
    fetch(url: string, options?: Options): Promise<Response>;
    createEventSource(url: string, eventSourceInitDict: EventSourceInitDict): EventSource;
    /**
     * Returns true if a proxy is configured.
     */
    usingProxy?(): boolean;
    /**
     * Returns true if the proxy uses authentication.
     */
    usingProxyAuth?(): boolean;
}

interface Platform {
    /**
     * The interface for getting information about the platform and the execution
     * environment.
     */
    info: Info;
    /**
     * The interface for performing file system operations. If the platform does
     * not support filesystem access, then this may be undefined.
     */
    fileSystem?: Filesystem;
    /**
     * The interface for performing cryptographic operations.
     */
    crypto: Crypto;
    /**
     * The interface for performing http/https requests.
     */
    requests: Requests;
}

/**
 * Specifies the base service URIs used by SDK components.
 */
interface LDServiceEndpoints {
}
/**
 * The most basic properties of the SDK client that are available to all SDK component factories.
 */
interface LDBasicConfiguration {
    /**
     * The configured SDK key.
     */
    sdkKey: string;
    /**
     * Defines the base service URIs used by SDK components.
     */
    serviceEndpoints: LDServiceEndpoints;
    /**
     * True if the SDK was configured to be completely offline.
     */
    offline?: boolean;
    logger?: LDLogger;
    tags?: {
        value?: string;
    };
}
/**
 * Factory methods receive this class as a parameter.
 *
 * Its public properties provide information about the SDK configuration and environment. The SDK
 * may also include non-public properties that are relevant only when creating one of the built-in
 * component types and are not accessible to custom components.
 */
interface LDClientContext {
    /**
     * The SDK's basic global properties.
     */
    basicConfiguration: LDBasicConfiguration;
    /**
     * Interfaces providing platform specific information and functionality.
     */
    platform: Platform;
}

/**
 * Interface for a strategy for removing duplicate contexts from the event stream.
 * Client side event processors do not do this de-duplication, so the implementation
 * is not part of the default event processor.
 */
interface LDContextDeduplicator {
    /**
     * The interval, if any, at which the event processor should call flush.
     */
    readonly flushInterval?: number;
    /**
     * Updates the internal state if necessary to reflect that we have seen the given context.
     * Returns true if it is time to insert an index event for this context into the event output.
     *
     * Client implementations may always return true.
     */
    processContext(context: Context): boolean;
    /**
     * Forgets any cached user information, so all subsequent contexts will be treated as new.
     */
    flush(): void;
}

declare class InputCustomEvent {
    readonly key: string;
    readonly data?: any;
    readonly metricValue?: number | undefined;
    readonly kind = "custom";
    readonly creationDate: number;
    readonly context: Context;
    constructor(context: Context, key: string, data?: any, metricValue?: number | undefined);
}

declare class InputEvalEvent {
    readonly key: string;
    readonly kind = "feature";
    readonly creationDate: number;
    readonly context: Context;
    readonly default: any;
    readonly trackEvents?: boolean;
    readonly debugEventsUntilDate?: number;
    readonly prereqOf?: string;
    readonly reason?: LDEvaluationReason;
    readonly value: any;
    readonly variation?: number;
    readonly version?: number;
    constructor(withReasons: boolean, context: Context, key: string, defValue: any, // default is a reserved keyword in this context.
    detail: LDEvaluationDetail, version?: number, variation?: number, trackEvents?: boolean, prereqOf?: string, reason?: LDEvaluationReason, debugEventsUntilDate?: number);
}

declare class InputIdentifyEvent {
    readonly kind = "identify";
    readonly creationDate: number;
    readonly context: Context;
    constructor(context: Context);
}

type InputEvent = InputEvalEvent | InputCustomEvent | InputIdentifyEvent;

interface LDEventProcessor {
    close(): void;
    flush(): Promise<void>;
    sendEvent(inputEvent: InputEvent): void;
}

declare enum LDEventType {
    AnalyticsEvents = 0,
    DiagnosticEvent = 1
}
declare enum LDDeliveryStatus {
    Succeeded = 0,
    Failed = 1,
    FailedAndMustShutDown = 2
}
interface LDEventSenderResult {
    status: LDDeliveryStatus;
    serverTime?: number;
    error?: any;
}
interface LDEventSender {
    sendEventData(type: LDEventType, data: any): Promise<LDEventSenderResult>;
}

/**
 * The LaunchDarkly client stream processor
 *
 * The client uses this internally to retrieve updates from LaunchDarkly.
 *
 * @ignore
 */
interface LDStreamProcessor {
    start: () => void;
    stop: () => void;
    close: () => void;
}

type index$1_LDContextDeduplicator = LDContextDeduplicator;
type index$1_LDDeliveryStatus = LDDeliveryStatus;
declare const index$1_LDDeliveryStatus: typeof LDDeliveryStatus;
type index$1_LDEventProcessor = LDEventProcessor;
type index$1_LDEventSender = LDEventSender;
type index$1_LDEventSenderResult = LDEventSenderResult;
type index$1_LDEventType = LDEventType;
declare const index$1_LDEventType: typeof LDEventType;
type index$1_LDStreamProcessor = LDStreamProcessor;
declare namespace index$1 {
  export {
    index$1_LDContextDeduplicator as LDContextDeduplicator,
    index$1_LDDeliveryStatus as LDDeliveryStatus,
    index$1_LDEventProcessor as LDEventProcessor,
    index$1_LDEventSender as LDEventSender,
    index$1_LDEventSenderResult as LDEventSenderResult,
    index$1_LDEventType as LDEventType,
    index$1_LDStreamProcessor as LDStreamProcessor,
  };
}

/**
 * Interface for type validation.
 */
interface TypeValidator {
    is(u: unknown): boolean;
    getType(): string;
}
/**
 * Validate a factory or instance.
 */
declare class FactoryOrInstance implements TypeValidator {
    is(factoryOrInstance: unknown): boolean;
    getType(): string;
}
/**
 * Validate a basic type.
 */
declare class Type<T> implements TypeValidator {
    private typeName;
    protected typeOf: string;
    constructor(typeName: string, example: T);
    is(u: unknown): u is T;
    getType(): string;
}
/**
 * Validate an array of the specified type.
 *
 * This does not validate instances of types. All class instances
 * of classes will simply objects.
 */
declare class TypeArray<T> implements TypeValidator {
    private typeName;
    protected typeOf: string;
    constructor(typeName: string, example: T);
    is(u: unknown): u is T;
    getType(): string;
}
/**
 * Validate a value is a number and is greater or eval than a minimum.
 */
declare class NumberWithMinimum extends Type<number> {
    readonly min: number;
    constructor(min: number);
    is(u: unknown): u is number;
}
/**
 * Validate a value is a string and it matches the given expression.
 */
declare class StringMatchingRegex extends Type<string> {
    readonly expression: RegExp;
    constructor(expression: RegExp);
    is(u: unknown): u is string;
}
/**
 * Validate a value is a function.
 */
declare class Function implements TypeValidator {
    is(u: unknown): u is (...args: any[]) => void;
    getType(): string;
}
declare class NullableBoolean implements TypeValidator {
    is(u: unknown): boolean;
    getType(): string;
}
/**
 * Validate a value is a date. Values which are numbers are treated as dates and any string
 * which if compliant with `time.RFC3339Nano` is a date.
 */
declare class DateValidator implements TypeValidator {
    is(u: unknown): boolean;
    getType(): string;
}
/**
 * A set of standard type validators.
 */
declare class TypeValidators {
    static readonly String: Type<string>;
    static readonly Number: Type<number>;
    static readonly ObjectOrFactory: FactoryOrInstance;
    static readonly Object: Type<object>;
    static readonly StringArray: TypeArray<string>;
    static readonly Boolean: Type<boolean>;
    static readonly Function: Function;
    static createTypeArray<T>(typeName: string, example: T): TypeArray<T>;
    static numberWithMin(min: number): NumberWithMinimum;
    static stringMatchingRegex(expression: RegExp): StringMatchingRegex;
    static readonly Date: DateValidator;
    static readonly NullableBoolean: NullableBoolean;
}

/**
 * A basic logger which handles filtering by level.
 *
 * With the default options it will write to `console.error`
 * and it will use the formatting provided by `console.error`.
 * If the destination is overwritten, then it will use an included
 * formatter similar to `util.format`.
 *
 * If a formatter is available, then that should be overridden
 * as well for performance.
 */
declare class BasicLogger implements LDLogger {
    private logLevel;
    private name;
    private destination?;
    private formatter?;
    /**
     * This should only be used as a default fallback and not as a convenient
     * solution. In most cases you should construct a new instance with the
     * appropriate options for your specific needs.
     */
    static get(): BasicLogger;
    constructor(options: BasicLoggerOptions);
    private tryFormat;
    private tryWrite;
    private log;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
    debug(...args: any[]): void;
}

/**
 * The safeLogger logic exists because we allow the application to pass in a custom logger, but
 * there is no guarantee that the logger works correctly and if it ever throws exceptions there
 * could be serious consequences (e.g. an uncaught exception within an error event handler, due
 * to the SDK trying to log the error, can terminate the application). An exception could result
 * from faulty logic in the logger implementation, or it could be that this is not a logger at
 * all but some other kind of object; the former is handled by a catch block that logs an error
 * message to the SDK's default logger, and we can at least partly guard against the latter by
 * checking for the presence of required methods at configuration time.
 */
declare class SafeLogger implements LDLogger {
    private logger;
    private fallback;
    /**
     * Construct a safe logger with the specified logger.
     * @param logger The logger to use.
     * @param fallback A fallback logger to use in case an issue is  encountered using
     * the provided logger.
     */
    constructor(logger: LDLogger, fallback: LDLogger);
    private log;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
    debug(...args: any[]): void;
}

declare const createSafeLogger: (logger?: LDLogger) => BasicLogger | SafeLogger;

/**
 * Class for managing tags.
 */
declare class ApplicationTags {
    readonly value?: string;
    constructor(options: {
        application?: {
            id?: string;
            version?: string;
        };
        logger?: LDLogger;
    });
}

/**
 * Specifies the base service URIs used by SDK components.
 */
declare class ServiceEndpoints {
    static DEFAULT_EVENTS: string;
    readonly streaming: string;
    readonly polling: string;
    readonly events: string;
    constructor(streaming: string, polling: string, events?: string);
}

/**
 * Basic configuration applicable to many SDK components for both server and
 * client SDKs.
 */
interface BasicConfiguration {
    tags?: ApplicationTags;
    logger?: LDLogger;
    /**
     * True if the SDK was configured to be completely offline.
     */
    offline?: boolean;
    /**
     * The configured SDK key.
     */
    sdkKey: string;
    /**
     * Defines the base service URIs used by SDK components.
     */
    serviceEndpoints: ServiceEndpoints;
    /**
     * Sets the initial reconnect delay for the streaming connection, in seconds.
     */
    streamInitialReconnectDelay?: number;
}
/**
 * The client context provides basic configuration and platform support which are required
 * when building SDK components.
 */
declare class ClientContext implements LDClientContext {
    readonly platform: Platform;
    basicConfiguration: BasicConfiguration;
    constructor(sdkKey: string, configuration: {
        logger?: LDLogger;
        offline?: boolean;
        serviceEndpoints: ServiceEndpoints;
        tags?: ApplicationTags;
    }, platform: Platform);
}

/**
 * Messages for issues which can be encountered from processing the configuration options.
 */
declare class OptionMessages {
    static deprecated(oldName: string, newName: string): string;
    static optionBelowMinimum(name: string, value: number, min: number): string;
    static unknownOption(name: string): string;
    static wrongOptionType(name: string, expectedType: string, actualType: string): string;
    static wrongOptionTypeBoolean(name: string, actualType: string): string;
    static invalidTagValue(name: string): string;
    static tagValueTooLong(name: string): string;
    static partialEndpoint(name: string): string;
}

declare function secondsToMillis(sec: number): number;

type LDHeaders = {
    authorization: string;
    'user-agent': string;
    'x-launchdarkly-wrapper'?: string;
    'x-launchdarkly-tags'?: string;
};
declare function defaultHeaders(sdkKey: string, info: Info, tags?: ApplicationTags): LDHeaders;
declare function httpErrorMessage(err: {
    status: number;
    message: string;
}, context: string, retryMessage?: string): string;

declare const _default: () => void;

declare const sleep: (delayMillis?: number) => Promise<unknown>;

type VoidFunction = () => void;

interface DiagnosticPlatformData {
    name?: string;
    osArch?: string;
    osName?: string;
    osVersion?: string;
    /**
     * Platform specific identifiers.
     * For instance `nodeVersion`
     */
    [key: string]: string | undefined;
}
interface DiagnosticSdkData {
    name?: string;
    wrapperName?: string;
    wrapperVersion?: string;
}
interface DiagnosticConfigData {
    customBaseURI: boolean;
    customStreamURI: boolean;
    customEventsURI: boolean;
    eventsCapacity: number;
    connectTimeoutMillis: number;
    socketTimeoutMillis: number;
    eventsFlushIntervalMillis: number;
    pollingIntervalMillis: number;
    reconnectTimeMillis: number;
    streamingDisabled: boolean;
    usingRelayDaemon: boolean;
    offline: boolean;
    allAttributesPrivate: boolean;
    contextKeysCapacity: number;
    contextKeysFlushIntervalMillis: number;
    usingProxy: boolean;
    usingProxyAuthenticator: boolean;
    diagnosticRecordingIntervalMillis: number;
    dataStoreType: string;
}
interface DiagnosticId {
    diagnosticId: string;
    sdkKeySuffix: string;
}
interface DiagnosticInitEvent {
    kind: 'diagnostic-init';
    id: DiagnosticId;
    creationDate: number;
    sdk: DiagnosticSdkData;
    configuration: DiagnosticConfigData;
    platform: DiagnosticPlatformData;
}
interface StreamInitData {
    timestamp: number;
    failed: boolean;
    durationMillis: number;
}
interface DiagnosticStatsEvent {
    kind: 'diagnostic';
    id: DiagnosticId;
    creationDate: number;
    dataSinceDate: number;
    droppedEvents: number;
    deduplicatedUsers: number;
    eventsInLastBatch: number;
    streamInits: StreamInitData[];
}

declare class DiagnosticsManager {
    private readonly platform;
    private readonly diagnosticInitConfig;
    private readonly startTime;
    private streamInits;
    private readonly id;
    private dataSinceDate;
    constructor(sdkKey: string, platform: Platform, diagnosticInitConfig: any);
    /**
     * Creates the initial event that is sent by the event processor when the SDK starts up. This will
     * not be repeated during the lifetime of the SDK client.
     */
    createInitEvent(): DiagnosticInitEvent;
    /**
     * Records a stream connection attempt (called by the stream processor).
     *
     * @param timestamp Time of the *beginning* of the connection attempt.
     * @param failed True if the connection failed, or we got a read timeout before receiving a "put".
     * @param durationMillis Elapsed time between starting timestamp and when we either gave up/lost
     * the connection or received a successful "put".
     */
    recordStreamInit(timestamp: number, failed: boolean, durationMillis: number): void;
    /**
     * Creates a periodic event containing time-dependent stats, and resets the state of the manager
     * with regard to those stats.
     *
     * Note: the reason droppedEvents, deduplicatedUsers, and eventsInLastBatch are passed into this
     * function, instead of being properties of the DiagnosticsManager, is that the event processor is
     * the one who's calling this function and is also the one who's tracking those stats.
     */
    createStatsEventAndReset(droppedEvents: number, deduplicatedUsers: number, eventsInLastBatch: number): DiagnosticStatsEvent;
}

interface EventProcessorOptions {
    allAttributesPrivate: boolean;
    privateAttributes: string[];
    eventsCapacity: number;
    flushInterval: number;
    diagnosticRecordingInterval: number;
}
declare class EventProcessor implements LDEventProcessor {
    private readonly contextDeduplicator?;
    private readonly diagnosticsManager?;
    private eventSender;
    private summarizer;
    private queue;
    private lastKnownPastTime;
    private droppedEvents;
    private deduplicatedUsers;
    private exceededCapacity;
    private eventsInLastBatch;
    private shutdown;
    private capacity;
    private logger?;
    private contextFilter;
    private diagnosticsTimer;
    private flushTimer;
    private flushUsersTimer;
    constructor(config: EventProcessorOptions, clientContext: ClientContext, contextDeduplicator?: LDContextDeduplicator | undefined, diagnosticsManager?: DiagnosticsManager | undefined);
    private postDiagnosticEvent;
    close(): void;
    flush(): Promise<void>;
    sendEvent(inputEvent: InputEvent): void;
    private makeOutputEvent;
    private enqueue;
    private shouldDebugEvent;
    private tryPostingEvents;
}

declare class NullEventProcessor implements LDEventProcessor {
    close(): void;
    flush(): Promise<void>;
    sendEvent(): void;
}

declare class LDFileDataSourceError extends Error {
    constructor(message: string);
}
declare class LDPollingError extends Error {
    readonly status?: number;
    constructor(message: string, status?: number);
}
declare class LDStreamingError extends Error {
    readonly code?: number;
    constructor(message: string, code?: number);
}
declare class LDUnexpectedResponseError extends Error {
    constructor(message: string);
}
declare class LDClientError extends Error {
    constructor(message: string);
}
declare function isHttpRecoverable(status: number): boolean;

type StreamingErrorHandler = (err: LDStreamingError) => void;

declare class StreamingProcessor implements LDStreamProcessor {
    private readonly listeners;
    private readonly diagnosticsManager?;
    private readonly errorHandler?;
    private readonly streamInitialReconnectDelay;
    private readonly headers;
    private readonly streamUri;
    private readonly logger?;
    private eventSource?;
    private requests;
    private connectionAttemptStartTime?;
    constructor(sdkKey: string, clientContext: ClientContext, listeners: Map<EventName, ProcessStreamResponse>, diagnosticsManager?: DiagnosticsManager | undefined, errorHandler?: StreamingErrorHandler | undefined, streamInitialReconnectDelay?: number);
    private logConnectionStarted;
    private logConnectionResult;
    start(): void;
    stop(): void;
    close(): void;
}

type index_DiagnosticsManager = DiagnosticsManager;
declare const index_DiagnosticsManager: typeof DiagnosticsManager;
type index_EventProcessor = EventProcessor;
declare const index_EventProcessor: typeof EventProcessor;
type index_InputCustomEvent = InputCustomEvent;
declare const index_InputCustomEvent: typeof InputCustomEvent;
type index_InputEvalEvent = InputEvalEvent;
declare const index_InputEvalEvent: typeof InputEvalEvent;
type index_InputEvent = InputEvent;
type index_InputIdentifyEvent = InputIdentifyEvent;
declare const index_InputIdentifyEvent: typeof InputIdentifyEvent;
type index_NullEventProcessor = NullEventProcessor;
declare const index_NullEventProcessor: typeof NullEventProcessor;
type index_StreamingErrorHandler = StreamingErrorHandler;
type index_StreamingProcessor = StreamingProcessor;
declare const index_StreamingProcessor: typeof StreamingProcessor;
declare namespace index {
  export {
    index_DiagnosticsManager as DiagnosticsManager,
    index_EventProcessor as EventProcessor,
    index_InputCustomEvent as InputCustomEvent,
    index_InputEvalEvent as InputEvalEvent,
    index_InputEvent as InputEvent,
    index_InputIdentifyEvent as InputIdentifyEvent,
    index_NullEventProcessor as NullEventProcessor,
    index_StreamingErrorHandler as StreamingErrorHandler,
    index_StreamingProcessor as StreamingProcessor,
  };
}

export { ApplicationTags, AttributeReference, BasicLogger, BasicLoggerOptions, ClientContext, Context, ContextFilter, Crypto, DateValidator, EventListener, EventName, EventSource, EventSourceInitDict, FactoryOrInstance, Filesystem, Function, Hasher, Headers, Hmac, Info, LDClientContext, LDClientError, LDContext, LDContextCommon, LDContextMeta, LDEvaluationDetail, LDEvaluationReason, LDFileDataSourceError, LDFlagSet, LDFlagValue, LDHeaders, LDLogLevel, LDLogger, LDMultiKindContext, LDPollingError, LDSingleKindContext, LDStreamingError, LDUnexpectedResponseError, LDUser, NullableBoolean, NumberWithMinimum, OptionMessages, Options, Platform, PlatformData, ProcessStreamResponse, Requests, Response, SafeLogger, SdkData, ServiceEndpoints, StringMatchingRegex, Type, TypeArray, TypeValidator, TypeValidators, VoidFunction, WatchHandle, createSafeLogger, defaultHeaders, httpErrorMessage, index as internal, isHttpRecoverable, _default as noop, secondsToMillis, sleep, index$1 as subsystem };
