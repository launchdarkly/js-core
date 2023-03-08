import Context from '../../Context';

export default class InputEventBase {
  constructor(
    public readonly kind: string,
    public readonly creationDate: number,
    public readonly context: Context
  ) {}
}
