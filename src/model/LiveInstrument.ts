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
}
