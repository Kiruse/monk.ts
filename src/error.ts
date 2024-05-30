export class MonkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidDocumentError extends MonkError {
  constructor(public readonly document: any) {
    super('Invalid document (see `document` property`)');
  }
}
