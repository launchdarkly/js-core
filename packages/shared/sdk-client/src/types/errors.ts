// eslint-disable-next-line import/prefer-default-export
export class IdentifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentifyError';
  }
}
