import LiveInstrument from "../LiveInstrument";
import LiveInstrumentType from "../LiveInstrumentType";

export default class LiveLog extends LiveInstrument {
    type = LiveInstrumentType.LOG;
    logFormat: string
    logArguments: string[]

    toJson(): any {
        return {
            ...super.toJson(),
            logFormat: this.logFormat,
            logArguments: this.logArguments
        };
    }
}