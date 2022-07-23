import InstrumentThrottle from "./InstrumentThrottle";
import ThrottleStep from "./ThrottleStep";

export default class HitThrottle implements InstrumentThrottle {
    limit: number;
    step: ThrottleStep;

    lastReset: number = -1;
    hitCount: number = 0;
    totalHitCount: number = 0;
    totalLimitedCount: number = 0;

    isRateLimited(): boolean {
        if (this.hitCount++ < this.limit) {
            this.totalHitCount++;
            return false;
        }
        if (Date.now() - this.lastReset > this.step) {
            this.lastReset = Date.now();
            this.hitCount = 0;
            this.totalLimitedCount++;
            return false;
        }
        this.totalLimitedCount++;
        return true;
    }
}