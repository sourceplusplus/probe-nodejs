import LiveInstrument from "../LiveInstrument";
import LiveInstrumentType from "../LiveInstrumentType";
import InstrumentThrottle from "../throttle/InstrumentThrottle";
import LiveSourceLocation from "../LiveSourceLocation";
import HitThrottle from "../throttle/HitThrottle";

export default class LiveBreakpoint extends LiveInstrument {
    type = LiveInstrumentType.BREAKPOINT;
}