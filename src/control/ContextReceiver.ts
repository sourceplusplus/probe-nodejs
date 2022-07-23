// import LiveInstrumentRemote from "./LiveInstrumentRemote";
import {LogData, LogDataBody, LogTags, TextLog, TraceContext} from "skywalking-backend-js/lib/proto/logging/Logging_pb";
import {KeyStringValuePair} from "skywalking-backend-js/lib/proto/common/Common_pb";
import {ContextManager} from "skywalking-backend-js";
import config from "skywalking-backend-js/lib/config/AgentConfig";
import * as grpc from '@grpc/grpc-js';
import {LogReportServiceClient} from "skywalking-backend-js/lib/proto/logging/Logging_grpc_pb";
import {Debugger, Runtime} from "inspector";

namespace ContextReceiver {
    let logReport = new LogReportServiceClient(
        config.collectorAddress,
        config.secure ? grpc.credentials.createSsl() : grpc.credentials.createInsecure()
    );

    function tryFindVariable(varName, variables) {
        for (let scope in variables) {
            for (let variable of variables[scope]) {
                if (variable.name === varName) {
                    return variable;
                }
            }
        }
        return null;
    }

    function callFrameToString(frame: Debugger.CallFrame) {
        return `${frame.url} - ${frame.functionName}(${frame.location.lineNumber})`;
    }

    function encodeVariable(variable: Runtime.PropertyDescriptor) {
        if (!variable.value) {
            return JSON.stringify({
                '@class': "null",
                '@id': 'null',
                '@skip': 'Error: No variable value'
            });
        }
        let clazz, id, value;
        if (variable.value.type === 'object') {
            clazz = variable.value.className;
            id = variable.value.objectId;
            value = ""; // TODO: Include variable value
        } else if (variable.value.type === 'function') {
            // TODO: Correctly handle these, variable.value.description contains the entire class/function definition
            clazz = 'function';
            id = variable.value.objectId;
        } else {
            clazz = variable.value.type;
            id = ""; // Primitive types don't have an object id
            value = variable.value.value;
        }

        let obj = {
            '@class': clazz,
            '@id': id
        };
        obj[variable.name] = "";

        return JSON.stringify(obj);
    }

    export function test(variables) {
        console.log(tryFindVariable('i', variables));
    }

    export function applyMeter(liveMeterId: string, variables) {
        // TODO: implement
    }

    export function applyBreakpoint(breakpointId: string, source: string | undefined, line: number,
                                    frame: Debugger.CallFrame, variables) {
        let activeSpan = ContextManager.current.newLocalSpan(callFrameToString(frame));

        let localVars = variables['block'];

        let localFields = variables['local'];



        activeSpan.stop();
    }

    export function applyLog(liveLogId: string, logFormat: string, logArguments: string[], variables) {
        let logTags = new LogTags();
        // TODO: Javascript doesn't have normal threading, so we can't really specify the thread
        logTags.addData(new KeyStringValuePair().setKey('log_id').setValue(liveLogId));

        for (let varName of logArguments) {
            let variable = tryFindVariable(varName, variables);
            if (variable) {
                logTags.addData(new KeyStringValuePair().setKey(`argument.${varName}`).setValue(variable.value));
            }
        }

        let swContext = ContextManager.current;
        let logData = new LogData()
            .setTimestamp(Date.now())
            .setService("TODO") // TODO: Config
            .setServiceinstance("TODO") // TODO: Config
            .setBody(new LogDataBody()
                .setType("text")
                .setText(new TextLog().setText(logFormat))
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