import LiveInstrument from "../model/LiveInstrument";
import inspector, {Runtime} from "inspector";
import SourceMapper from "../util/SourceMapper";
import ContextReceiver from "./ContextReceiver";
import LiveInstrumentType from "../model/LiveInstrumentType";
import LiveLog from "../model/instruments/LiveLog";
import LiveMeter from "../model/instruments/LiveMeter";
import EventBus from "@vertx/eventbus-bridge-client.js";
import LiveInstrumentCommand from "../model/command/LiveInstrumentCommand";
import CommandType from "../model/command/CommandType";
import VariableUtil from "../util/VariableUtil";

export interface VariableInfo {
    block: Runtime.PropertyDescriptor[]
    local: Runtime.PropertyDescriptor[]
    global: Runtime.PropertyDescriptor[]
}

interface CachedInstrument {
    instrument: LiveInstrument
    timeCached: number
}

export default class LiveInstrumentRemote {
    instruments: Map<string, LiveInstrument> = new Map<string, LiveInstrument>();
    session: inspector.Session;
    sourceMapper: SourceMapper;
    locationToBreakpointId: Map<string, string> = new Map<string, string>();
    breakpointIdToInstrumentIds: Map<string, string[]> = new Map<string, string[]>();
    instrumentCache: Map<string, CachedInstrument> = new Map<string, CachedInstrument>();
    eventBus: EventBus;
    pendingBreakpoints: Map<string, Promise<string>> = new Map<string, Promise<string>>();

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;

        this.session = new inspector.Session();

        try {
            this.session.connect();
        } catch (e) {
            console.log(e);
        }

        this.sourceMapper = new SourceMapper(this.scriptLoaded.bind(this));

        ContextReceiver.initialize();
    }

    async start(): Promise<void> {
        // Register this event before enabling the debugger so we receive all previously loaded scripts as well
        this.session.on('Debugger.scriptParsed', message => {
            this.sourceMapper.map(message.params.scriptId, message.params.url, message.params.sourceMapURL);
        });

        return new Promise<void>((resolve, reject) => {
            this.session.post("Debugger.enable", {}, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    this.enabled();
                    resolve();
                }
            });
        });
    }

    private enabled() {
        this.session.post("Debugger.setBreakpointsActive", {
            active: true
        });

        this.session.on('Debugger.paused', message => {
            // We only gather variable information for the top call frame
            let frame = message.params.callFrames[0];
            let variables = {}
            let promises = [];

            // Attempt to get variables from the top call frame
            for (let scope of frame.scopeChain) {
                if (scope.type === 'global') {
                    continue; // TODO: Ignore this until we have a better way of filtering out the hundreds of js properties
                }

                promises.push(this.getVariable(scope.object.objectId, 2)
                    .then(res => {
                        if (scope.type === 'local' || scope.type === 'block') {
                            variables['local'] = variables['local'] || [];
                            variables['local'].push(...res);
                        } else if (scope.type === 'closure') {
                            variables['field'] = res[0].value.value; // TODO: Ensure result[0] is always the class instance
                        } else if (scope.type === 'global') {
                            // Handle this once we have a better way of filtering out the hundreds of js properties
                        }
                    }));
            }

            message.params.hitBreakpoints.forEach(breakpointId => { // There should only be a single breakpoint, but handle multiple just in case
                let instrumentIds = this.breakpointIdToInstrumentIds.get(breakpointId);
                if (!instrumentIds) {
                    this.removeBreakpoint(message.params.hitBreakpoints[0]);
                    return;
                }

                let instruments = instrumentIds.map(id => this.instruments.get(id));
                let dataGathered = Promise.all(instruments.map(instrument => {
                    return new Promise<any>((resolve, reject) => {
                        this.session.post("Debugger.evaluateOnCallFrame", {
                            callFrameId: frame.callFrameId,
                            expression: instrument.createExpression(),
                            silent: false,           // In case of an exception, don't affect the program flow
                            throwOnSideEffect: true, // Disallow side effects
                            returnByValue: true      // Return the entire JSON object rather than just the remote id
                        }, (err, res) => {
                            if (err) {
                                this.handleConditionalFailed(instrument,
                                    `Error evaluating condition (${instrument.condition}): ${err}`);
                                resolve({success: false});
                            } else {
                                if (res.result.type === 'object' && res.result.subtype === 'error') {
                                    if (res.result.className === 'EvalError') {
                                        this.handleConditionalFailed(instrument,
                                            `Could not evaluate condition (${instrument.condition}) due to possible side effects`);
                                    } else {
                                        this.handleConditionalFailed(instrument,
                                            `Error evaluating condition (${instrument.condition}): ${res.result.description}`);
                                    }
                                    resolve({success: false});
                                } else if (res.result.type !== 'object') {
                                    this.handleConditionalFailed(instrument,
                                        `Invalid condition for instrument id: ${instrument.id}: ${instrument.condition}  ==>  ${res.result}`);
                                    resolve({success: false});
                                } else {
                                    resolve(res.result.value);
                                }
                            }
                        });
                    });
                }));

                Promise.all(promises).then(() => dataGathered)
                    .then(data => {
                        for (let i = 0; i < instruments.length; i++) {
                            if (data[i].success) {
                                let instrument = instruments[i];
                                if (!instrument) {
                                    continue;
                                }

                                if (instrument.type == LiveInstrumentType.BREAKPOINT) {
                                    ContextReceiver.applyBreakpoint(
                                        instrument.id,
                                        instrument.location.source,
                                        instrument.location.line,
                                        message.params.callFrames,
                                        variables
                                    );
                                } else if (instrument.type == LiveInstrumentType.LOG) {
                                    let logInstrument = <LiveLog>instrument;
                                    ContextReceiver.applyLog(
                                        instrument.id,
                                        logInstrument.logFormat,
                                        data[i].logArguments
                                    );
                                } else if (instrument.type == LiveInstrumentType.METER) {
                                    let meterInstrument = <LiveMeter>instrument;
                                    ContextReceiver.applyMeter(
                                        instrument.id,
                                        variables
                                    );
                                }
                                if (instrument.isFinished()) {
                                    this.removeBreakpoint(instrument.id);
                                }
                            }
                        }
                    });
            });
        });
    }

    private scriptLoaded(sourceLocation: string, scriptId: string) {
        this.instrumentCache.forEach(cachedInstrument => {
            if (cachedInstrument.instrument.location.source == sourceLocation) {
                this.instrumentCache.delete(cachedInstrument.instrument.id);
                this.addInstrument(cachedInstrument.instrument);
            }
        });
    }

    private getVariable(objectId: string, remainingDepth: number): Promise<Runtime.PropertyDescriptor[]> {
        return new Promise<any>((resolve, reject) => {
            this.session.post("Runtime.getProperties", {
                objectId: objectId,
                ownProperties: true
            }, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    let result: Runtime.PropertyDescriptor[] = res.result;

                    VariableUtil.processVariables(result)

                    if (remainingDepth <= 0)
                        return resolve(result);

                    let newRemainingDepth = remainingDepth - 1;

                    let promises = [];
                    for (let variable of result) {
                        if (!variable.value.objectId) continue;
                        promises.push(this.getVariable(variable.value.objectId, newRemainingDepth)
                            .then(res => variable.value.value = res));
                    }
                    Promise.all(promises).then(() => {
                        resolve(result)
                    });
                }
            });
        });
    }

    private async setBreakpoint(scriptId: string, line: number): Promise<string> {
        if (this.pendingBreakpoints.has(scriptId + ':' + line)) {
            return this.pendingBreakpoints.get(scriptId + ':' + line);
        }
        let promise = new Promise<string>((resolve, reject) => this.session.post("Debugger.setBreakpoint", {
            location: {
                scriptId: scriptId,
                lineNumber: line
            }
        }, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res.breakpointId);
            }
        }));
        this.pendingBreakpoints.set(scriptId + ':' + line, promise);
        return promise;
    }

    private removeBreakpoint(breakpointId: string) {
        this.breakpointIdToInstrumentIds.delete(breakpointId);
        this.locationToBreakpointId.forEach((value, key) => {
            if (value === breakpointId) {
                this.locationToBreakpointId.delete(key);
            }
        });
        this.session.post("Debugger.removeBreakpoint", {
            breakpointId: breakpointId
        });
    }

    async addInstrument(instrument: LiveInstrument): Promise<void> {
        if (this.instruments.get(instrument.id) || this.instrumentCache.get(instrument.id)) {
            return; // Instrument already exists or is in the cache
        }

        let location = this.sourceMapper.mapLocation(instrument.location);

        if (!location) {
            this.instrumentCache.set(instrument.id, {
                instrument: instrument,
                timeCached: Date.now()
            });
            return;
        }

        // Immediately add the instrument, so we don't try to add it again
        this.instruments.set(instrument.id, instrument);

        let breakpointId = this.locationToBreakpointId.get(location.scriptId + ":" + location.line);
        if (breakpointId) {
            this.breakpointIdToInstrumentIds.get(breakpointId).push(instrument.id);
            instrument.meta.breakpointId = breakpointId;
            this.eventBus.publish("spp.processor.status.live-instrument-applied", instrument.toJson())
            return;
        }

        return this.setBreakpoint(location.scriptId, location.line).then(breakpointId => {
            this.locationToBreakpointId.set(location.scriptId + ":" + location.line, breakpointId);
            this.breakpointIdToInstrumentIds.set(breakpointId, [instrument.id]);
            instrument.meta.breakpointId = breakpointId;
            this.eventBus.publish("spp.processor.status.live-instrument-applied", instrument.toJson())
        })
    }

    removeInstrument(instrumentId: string) {
        let instrument = this.instruments.get(instrumentId);

        if (!instrument) {
            // If the instrument is not enabled, try removing it from the cache
            this.instrumentCache.delete(instrumentId);
            return;
        }

        // Remove the instrument
        this.instruments.delete(instrumentId);

        // Get the breakpoint id
        let breakpointId = instrument.meta.breakpointId;
        if (!breakpointId) return;

        // Get the instruments corresponding to the breakpoint
        let instrumentIds = this.breakpointIdToInstrumentIds.get(breakpointId);
        if (!instrumentIds) return;

        // Remove the instrument id from the list
        let index = instrumentIds.indexOf(instrumentId);
        if (index === -1) return;
        instrumentIds.splice(index, 1);

        // If there are no more instruments for this breakpoint, remove it
        if (instrumentIds.length === 0) {
            this.removeBreakpoint(breakpointId);
        }

        this.breakpointIdToInstrumentIds.set(breakpointId, instrumentIds);

        // Remove the breakpoint id from the instrument meta (just in case)
        instrument.meta.breakpointId = null;
    }

    handleInstrumentCommand(command: LiveInstrumentCommand) {
        if (command.commandType === CommandType.ADD_LIVE_INSTRUMENT) {
            command.instruments.forEach(this.addInstrument.bind(this));
        } else if (command.commandType === CommandType.REMOVE_LIVE_INSTRUMENT) {
            command.instruments.forEach(inst => this.removeInstrument(inst.id));
            command.locations.forEach(location => {
                this.instruments.forEach(instrument => {
                    if (instrument.location.source == location.source && instrument.location.line == location.line) {
                        this.removeInstrument(instrument.id);
                    }
                })
            });
        }
    }

    handleConditionalFailed(instrument: LiveInstrument, error: string) {
        this.removeInstrument(instrument.id);
        this.eventBus.publish("spp.processor.status.live-instrument-removed", {
            occurredAt: Date.now(),
            instrument: JSON.stringify(instrument.toJson()),
            cause: `EventBusException:LiveInstrumentException[CONDITIONAL_FAILED]: ${error}`
        });
    }

    // TODO: Call this regularly to clean up old instruments
    // TODO: Ensure the cache doesn't get too large
    private cleanCache() {
        let now = Date.now();
        this.instrumentCache.forEach((value, key) => {
            if (now - value.timeCached > 1000 * 60 * 60) {
                this.instrumentCache.delete(key);
            }
        });
    }
}
