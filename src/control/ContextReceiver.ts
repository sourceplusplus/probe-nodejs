import {LogData, LogDataBody, LogTags, TextLog, TraceContext} from "skywalking-backend-js/lib/proto/logging/Logging_pb";
import {KeyStringValuePair} from "skywalking-backend-js/lib/proto/common/Common_pb";
import {ContextManager} from "skywalking-backend-js";
import config from "skywalking-backend-js/lib/config/AgentConfig";
import * as grpc from '@grpc/grpc-js';
import {LogReportServiceClient} from "skywalking-backend-js/lib/proto/logging/Logging_grpc_pb";
import {Debugger} from "inspector";
import VariableUtil from "../util/VariableUtil";
import ProbeMemory from "../ProbeMemory";
import SourcePlusPlus from "../SourcePlusPlus";
import LiveLog from "../model/instruments/LiveLog";

const debugLog = (...args: any[]) => SourcePlusPlus.debugLog(args);

namespace ContextReceiver {
    let logReport;

    export function initialize() {
        logReport = new LogReportServiceClient(
            config.collectorAddress,
            config.secure ? grpc.credentials.createSsl() : grpc.credentials.createInsecure()
        );
    }

    function tryFindVariable(varName, variables) {
        for (let scope in variables) {
            for (let variable of variables[scope]) {
                if (variable.name === varName) {
                    return variable.value?.value;
                }
            }
        }
        return null;
    }

    function callFrameToString(frame: Debugger.CallFrame) {
        // Ensure the location string is compatible with the platform
        let location = frame.url.replace('file://', '')
            .replace(':', '');

        return `at ${frame.functionName} (${location}:${frame.location.lineNumber}:${frame.location.columnNumber})`;
    }

    export function applyMeter(liveMeterId: string, variables) {
        let liveMeter = ProbeMemory[`spp.live-meter:${liveMeterId}`];
        let baseMeter = ProbeMemory[`spp.base-meter:${liveMeter.baseMeterId}`];
        if (!baseMeter) {
            ProbeMemory[`spp.base-meter:${liveMeterId}`] = baseMeter = null;
        }

        // TODO: implement (there does not appear to be meters in the nodejs version of skywalking)
    }

    export function applyBreakpoint(breakpointId: string, source: string | undefined, line: number,
                                    frames: Debugger.CallFrame[], variables) {
        debugLog(`applyBreakpoint: ${breakpointId} ${source} ${line}`);

        let liveBreakpoint = SourcePlusPlus.liveInstrumentRemote.instruments.get(breakpointId);
        if (liveBreakpoint.throttle.isRateLimited()) {
            return;
        } else {
            //todo: eval condition
        }

        let activeSpan = ContextManager.current.newLocalSpan(callFrameToString(frames[0]));
        activeSpan.start();

        let localVars = variables['local'];
        let fieldVars = variables['field'];

        for (let value of localVars) {
            activeSpan.tag({
                key: `spp.local-variable:${breakpointId}:${value.name}`,
                overridable: false,
                val: JSON.stringify(VariableUtil.encodeVariable(value))
            });
        }
        // for (let value of fieldVars) {
        //     if (value.name == undefined) {
        //         console.log(`Warning: field variable has no name: ${JSON.stringify(value)}`);
        //         return;
        //     }
        //     console.log("got field variable: " + value.name);
        //
        //     activeSpan.tag({
        //         key: `spp.field:${breakpointId}:${value.name}`,
        //         overridable: false,
        //         val: JSON.stringify(VariableUtil.encodeVariable(value))
        //     });
        // }

        activeSpan.tag({
            key: `spp.stack-trace:${breakpointId}`,
            overridable: false,
            val: frames.map(callFrameToString).join('\n')
        })

        activeSpan.tag({
            key: `spp.breakpoint:${breakpointId}`,
            overridable: false,
            val: JSON.stringify({source, line})
        })

        activeSpan.stop();

        if (liveBreakpoint.isFinished()) {
            debugLog(`Finished breakpoint: ${breakpointId}`);
            SourcePlusPlus.liveInstrumentRemote.removeInstrument(breakpointId);

            SourcePlusPlus.liveInstrumentRemote.eventBus.publish("spp.processor.status.live-instrument-removed", {
                instrument: JSON.stringify(liveBreakpoint.toJson()),
                occurredAt: Date.now()
            })
        }
    }

    export function applyLog(liveLog: LiveLog, variables) {
        debugLog(`applyLog: ${liveLog.id} ${liveLog.logFormat}`);

        if (liveLog.throttle.isRateLimited()) {
            return;
        } else {
            //todo: eval condition
        }

        let logTags = new LogTags();
        logTags.addData(new KeyStringValuePair().setKey('log_id').setValue(liveLog.id));
        logTags.addData(new KeyStringValuePair().setKey('level').setValue('Live'));
        logTags.addData(new KeyStringValuePair().setKey('thread').setValue('n/a'));

        if (liveLog.logArguments) {
            for (const varIndex in liveLog.logArguments) {
                logTags.addData(new KeyStringValuePair()
                    .setKey(`argument.${varIndex}`)
                    .setValue(tryFindVariable(liveLog.logArguments[varIndex], variables).toString() || 'undefined'));
            }
        }

        let swContext = ContextManager.current;
        let logData = new LogData()
            .setTimestamp(Date.now())
            .setService("TODO") // TODO: Config
            .setServiceinstance("TODO") // TODO: Config
            .setBody(new LogDataBody()
                .setType("text")
                .setText(new TextLog().setText(liveLog.logFormat))
            )
            .setTracecontext(new TraceContext()
                .setTraceid(swContext.segment.relatedTraces[0].toString())
                .setTracesegmentid(swContext.segment.segmentId.toString())
                .setSpanid(ContextManager.currentSpan.id || -1)
            )
            .setTags(logTags);

        const stream = logReport.collect((err, res) => {
            if (err) {
                console.log(err);
            } else {
                console.log(res);
            }
        });

        stream.write(logData);

        stream.end();
    }
}

export default ContextReceiver;