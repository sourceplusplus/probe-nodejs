import LiveSourceLocation from "./LiveSourceLocation";
import LiveInstrumentType from "./LiveInstrumentType";
import InstrumentThrottle from "./throttle/InstrumentThrottle";
import HitThrottle from "./throttle/HitThrottle";
import LiveBreakpoint from "./instruments/LiveBreakpoint";
import LiveInstrumentCommand from "./command/LiveInstrumentCommand";
import LiveLog from "./instruments/LiveLog";
import LiveMeter from "./instruments/LiveMeter";
import LiveSpan from "./instruments/LiveSpan";
import MeterType from "./meter/MeterType";
import MetricValue from "./meter/MetricValue";

export default class LiveInstrument {
    location: LiveSourceLocation
    condition?: string
    expiresAt?: number
    hitLimit: number
    id?: string
    type: LiveInstrumentType
    applyImmediately: boolean
    applied: boolean
    pending: boolean
    throttle?: HitThrottle
    meta: any

    isFinished(): boolean {
        if (this.expiresAt && this.expiresAt < Date.now()) {
            return true;
        }
        if (this.hitLimit > 0 && this.hitLimit <= this.throttle.totalHitCount) {
            return true;
        }
        return false;
    }

    toJson(): any {
        return {
            location: this.location,
            condition: this.condition,
            expiresAt: this.expiresAt,
            hitLimit: this.hitLimit,
            id: this.id,
            type: this.type,
            applyImmediately: this.applyImmediately,
            applied: this.applied,
            pending: this.pending,
            throttle: this.throttle ? this.throttle.toJson() : undefined,
            meta: this.meta
        };
    }

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