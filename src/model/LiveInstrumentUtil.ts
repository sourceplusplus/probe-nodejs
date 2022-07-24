import LiveInstrumentType from "./LiveInstrumentType";
import LiveBreakpoint from "./instruments/LiveBreakpoint";
import LiveLog from "./instruments/LiveLog";
import LiveMeter from "./instruments/LiveMeter";
import MeterType from "./meter/MeterType";
import MetricValue from "./meter/MetricValue";
import LiveSpan from "./instruments/LiveSpan";
import LiveSourceLocation from "./LiveSourceLocation";
import HitThrottle from "./throttle/HitThrottle";
import LiveInstrument from "./LiveInstrument";

export default class LiveInstrumentUtil {
    static fromJson(json: any): LiveInstrument {
        let type = LiveInstrumentType[json.type];
        let instrument;
        if (type === LiveInstrumentType.BREAKPOINT) {
            instrument = new LiveBreakpoint();
        } else if (type === LiveInstrumentType.LOG) {
            instrument = new LiveLog();
            instrument.logFormat = json.logFormat;
            instrument.logArguments = json.logArguments;
        } else if (type === LiveInstrumentType.METER) {
            instrument = new LiveMeter();
            instrument.meterName = json.meterName;
            instrument.meterType = MeterType[MeterType[json.meterType]];
            instrument.metricValue = json.metricValue as MetricValue;
        } else {
            instrument = new LiveSpan();
            instrument.operationName = json.operationName;
        }

        instrument.location = json.location as LiveSourceLocation;
        instrument.condition = json.condition;
        instrument.expiresAt = json.expiresAt;
        instrument.hitLimit = json.hitLimit;
        instrument.id = json.id;
        instrument.type = LiveInstrumentType[json.type];
        instrument.applyImmediately = json.applyImmediately;
        instrument.applied = json.applied;
        instrument.pending = json.pending;
        if (json.throttle) {
            instrument.throttle = HitThrottle.fromJson(json.throttle);
        }
        instrument.meta = json.meta;
        return instrument;
    }
}
