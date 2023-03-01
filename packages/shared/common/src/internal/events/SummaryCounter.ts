/**
 * @internal
 */
export default class SummaryCounter {
  public readonly default: any;

  constructor(
    public count: number,
    public key: string,
    public value: any,
    defValue: any,
    public version?: number,
    public variation?: number,
  ) {
    this.default = defValue;
  }

  increment() {
    this.count += 1;
  }
}
