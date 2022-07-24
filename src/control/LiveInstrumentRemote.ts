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
    instrumentCache: Map<string, CachedInstrument>;
    eventBus: EventBus;

    constructor(eventBus: EventBus) {
        this.eventBus = eventBus;

        this.session = new inspector.Session();

        try {
            this.session.connect();
        } catch (e) {
            console.log(e);
        }

        this.sourceMapper = new SourceMapper(this.scriptLoaded.bind(this));

        this.start();
    }

    private start() {
        // Register this event before enabling the debugger so we receive all previously loaded scripts as well
        this.session.on('Debugger.scriptParsed', message => {
            this.sourceMapper.map(message.params.scriptId, message.params.url, message.params.sourceMapURL);
        });

        this.session.post("Debugger.enable", {}, (err, res) => {
            if (err) {
                console.log(err);
            } else {
                this.enabled();
            }
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

            // Attempt to get variables from the
            for (let scope of frame.scopeChain) {
                promises.push(this.getVariable(scope.object.objectId, 2)
                    .then(res => variables[scope.type] = res.result));
            }

            this.session.post('Debugger.evaluateOnCallFrame', {
                callFrameId: frame.callFrameId,
                expression: "Object.keys(this).reduce((acc, current, _) => {acc[current] = this[current]; return acc}, {})",
            }, (err, res) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log(res.result);
                }
            })

            Promise.all(promises).then(() => {
                // Do stuff
                let instrumentIds = this.breakpointIdToInstrumentIds.get(message.params.hitBreakpoints[0]); // TODO: Handle multiple hit breakpoints
                if (!instrumentIds) {
                    this.removeBreakpoint(message.params.hitBreakpoints[0]);
                    return;
                }

                for (let instrumentId of instrumentIds) {
                    let instrument = this.instruments.get(instrumentId);
                    if (!instrument) {
                        continue;
                    }

                    if (instrument.type == LiveInstrumentType.BREAKPOINT) {
                        ContextReceiver.applyBreakpoint(
                            instrumentId,
                            instrument.location.source,
                            instrument.location.line,
                            frame,
                            variables
                        );
                    } else if (instrument.type == LiveInstrumentType.LOG) {
                        let logInstrument = <LiveLog>instrument;
                        ContextReceiver.applyLog(
                            instrumentId,
                            logInstrument.logFormat,
                            logInstrument.logArguments,
                            variables
                        );
                    } else if (instrument.type == LiveInstrumentType.METER) {
                        let meterInstrument = <LiveMeter>instrument;
                        ContextReceiver.applyMeter(
                            instrumentId,
                            variables
                        );
                    }
                }
            });

            // let frameId = message.params.callFrames[0].callFrameId;
            // session.post('Debugger.evaluateOnCallFrame', {
            //     callFrameId: frameId,
            //     expression: 'i++'
            // }, (err, res) => {
            //     if (err) {
            //         console.log(err);
            //     } else {
            //         console.log(res);
            //     }
            // });
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

    private getVariable(objectId: string, remainingDepth: number): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.session.post("Runtime.getProperties", {
                objectId: objectId,
                ownProperties: true
            }, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(res.result);
                    resolve(res.result);
                }
            });
        });
    }

    private setBreakpoint(scriptId: string, line: number): Promise<string> {
        return new Promise<string>((resolve, reject) => this.session.post("Debugger.setBreakpoint", {
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

    addInstrument(instrument: LiveInstrument) {
        let location = this.sourceMapper.mapLocation(instrument.location);

        if (!location) {
            this.instrumentCache.set(instrument.id, {
                instrument: instrument,
                timeCached: Date.now()
            });
            return;
        }

        let breakpointId = this.locationToBreakpointId.get(location.scriptId + ":" + location.line);
        if (breakpointId) {
            this.breakpointIdToInstrumentIds.get(breakpointId).push(instrument.id);
            this.instruments.set(instrument.id, instrument);
            instrument.meta.breakpointId = breakpointId;
            this.eventBus.publish("spp.processor.status.live-instrument-applied", instrument.toJson())
            return;
        }

        this.setBreakpoint(location.scriptId, location.line).then(breakpointId => {
            this.locationToBreakpointId.set(location.scriptId + ":" + location.line, breakpointId);
            this.breakpointIdToInstrumentIds.set(breakpointId, [instrument.id]);
            this.instruments.set(instrument.id, instrument);
            instrument.meta.breakpointId = breakpointId;
            this.eventBus.publish("spp.processor.status.live-instrument-applied", instrument.toJson())
        }).catch(err => {
            console.log(err);
        });
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
            command.instruments.forEach(this.removeInstrument.bind(this));
            command.locations.forEach(location => {
                this.instruments.forEach(instrument => {
                    if (instrument.location.source == location.source && instrument.location.line == location.line) {
                        this.removeInstrument(instrument.id);
                    }
                })
            });
        }
    }

    // TODO: Call this regularly to clean up old instruments
    private cleanCache() {
        let now = Date.now();
        this.instrumentCache.forEach((value, key) => {
            if (now - value.timeCached > 1000 * 60 * 60) {
                this.instrumentCache.delete(key);
            }
        });
    }

    test() {
        let location = this.sourceMapper.mapLocation({
            source: "src/test.ts",
            line: 10
        });

        if (!location) {
            setTimeout(this.test.bind(this), 500);
            return;
        }

        console.log(location);


        this.setBreakpoint(location.scriptId, location.line).then(breakpointId => {
            console.log(breakpointId);
        });
    }
}