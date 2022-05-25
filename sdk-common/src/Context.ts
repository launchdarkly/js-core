
type MultiKind = {
  kind: 'multi',
  isMulti: true,
};

type SingleKind = {
  kind: string
  isMulti: false
};

type Kind = MultiKind | SingleKind;

export default class Context {
  public readonly kind: Kind;

  private contexts?: Context[];

  private attributes?: Record<string, any>;

  constructor(context: LDContext) {
    this.kind = {
      kind: context.kind,
      isMulti: context.kind === 'multi',
    };
  }
}
