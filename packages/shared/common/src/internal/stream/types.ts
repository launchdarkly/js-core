import { LDStreamingError } from '../../errors';

export type ErrorFilterFunction = (err: { status: number; message: string }) => boolean;

export type StreamingErrorHandler = (err: LDStreamingError) => void;
