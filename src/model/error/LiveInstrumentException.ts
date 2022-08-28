export class LiveInstrumentException {
    type: ErrorType;
    message: string;

    toEventBusString(): string {
        return `EventBusException:LiveInstrumentException[${ErrorType[this.type]}]: ${this.message}`;
    }
}

export enum ErrorType {
    CLASS_NOT_FOUND,
    CONDITIONAL_FAILED
}
