
export interface BrowserTelemetryInspector {
  type: 'flag-used' | 'flag-detail-changed';
  name: string;
  synchronous: boolean;
  method: (...args: any[]) => void;
}
