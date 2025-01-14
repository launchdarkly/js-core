import { ErrorData } from './ErrorData';
import { SessionData } from './SessionData';

// Each type of event should be added to this union.
export type EventData = ErrorData | SessionData;
