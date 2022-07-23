import LiveInstrument from "../LiveInstrument";
import MetricValue from "../meter/MetricValue";
import MeterType from "../meter/MeterType";
import LiveSourceLocation from "../LiveSourceLocation";
import InstrumentThrottle from "../throttle/InstrumentThrottle";
import LiveInstrumentType from "../LiveInstrumentType";

export default class LiveMeter extends LiveInstrument {
    type = LiveInstrumentType.METER;
    meterName: string
    meterType: MeterType
    metricValue: MetricValue
}