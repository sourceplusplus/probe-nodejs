import ThrottleStep from "./ThrottleStep";

export default interface InstrumentThrottle {
    limit: number
    step: ThrottleStep
}