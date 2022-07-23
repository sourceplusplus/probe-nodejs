import LiveInstrument from "../LiveInstrument";
import LiveInstrumentType from "../LiveInstrumentType";

export default class LiveSpan extends LiveInstrument {
    type = LiveInstrumentType.SPAN;
    operationName: string
}