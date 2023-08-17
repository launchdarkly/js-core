import { LDContextDeduplicator } from '../../api/subsystem';
import { Context } from '../../index';

export default class ContextDeduplicator implements LDContextDeduplicator {
  flushInterval?: number | undefined = 0.1;

  seen: string[] = [];

  processContext(context: Context): boolean {
    if (this.seen.indexOf(context.canonicalKey) >= 0) {
      return false;
    }
    this.seen.push(context.canonicalKey);
    return true;
  }

  flush(): void {}
}
