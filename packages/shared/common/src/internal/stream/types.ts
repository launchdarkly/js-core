import { LDStreamingError } from '../../errors';

export type StreamingErrorHandler = (err: LDStreamingError) => void;
