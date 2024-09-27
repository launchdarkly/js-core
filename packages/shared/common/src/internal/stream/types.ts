import { LDStreamingError } from '../../datasource/errors';

export type StreamingErrorHandler = (err: LDStreamingError) => void;
