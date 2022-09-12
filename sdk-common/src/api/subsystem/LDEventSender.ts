export enum LDEventType {
  AnalyticsEvents,
  DiagnosticEvent,
}

export enum LDDeliveryStatus {
  Succeeded,
  Failed,
  FailedAndMustShutDown,
}

export interface LDEventSenderResult {
  status: LDDeliveryStatus,
  serverTime?: number,
  error?: any,
}

export default interface LDEventSender {
  sendEventData(type: LDEventType, data: any): Promise<LDEventSenderResult>;
}
