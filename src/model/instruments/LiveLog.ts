import LiveInstrument from "../LiveInstrument";
import LiveSourceLocation from "../LiveSourceLocation";
import InstrumentThrottle from "../throttle/InstrumentThrottle";
import LiveInstrumentType from "../LiveInstrumentType";
import HitThrottle from "../throttle/HitThrottle";

export default class LiveLog extends LiveInstrument {
    type = LiveInstrumentType.LOG;
    logFormat: string
    logArguments: string[]
}