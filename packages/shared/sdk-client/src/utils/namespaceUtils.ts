import { Crypto } from "@launchdarkly/js-sdk-common";

export type Namespace = 'LaunchDarkly' | 'AnonymousKeys' | 'ContextKeys' | 'ContextIndex';
export type NamespaceV1Compat = 'LaunchDarkly' | 'anonymous' | 'context' | 'index';

export const concatNamespacesAndValues = (crypto: Crypto, parts: {value: Namespace | string, hashIt: boolean}[]) => {
    let processedParts : string[] = []
    parts.forEach(part => {
        if (part.hashIt) {
            processedParts.push(hashValue(crypto, part.value))
        } else {
            processedParts.push(part.value)
        }
    });
    
    return processedParts.join('_')
}

/**
 * Hashes the input and encodes it as hex
 */
const hashValue = (crypto: Crypto, input: string): string => {
    // TODO: verify this achieves correct utf8 encoding
    return crypto.createHash('sha256').update(input).digest('hex')
}