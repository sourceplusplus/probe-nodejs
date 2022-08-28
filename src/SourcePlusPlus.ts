import YAML from 'yaml'
import * as fs from "fs";
import {randomUUID} from "crypto";
import config from "skywalking-backend-js/lib/config/AgentConfig";
import agent from "skywalking-backend-js/lib";
import EventBus from "@vertx/eventbus-bridge-client.js";
import LiveInstrumentRemote from "./control/LiveInstrumentRemote";
import LiveInstrumentCommand from "./model/command/LiveInstrumentCommand";
import SourcePlusPlusConfig from "./model/SourcePlusPlusConfig";

namespace SourcePlusPlus {
    function getConfigValue<T>(env: string, def: T | undefined, trueDef: T, parser: (str: string) => T): T {
        let env_value = process.env[env];
        if (env_value) {
            return parser(env_value);
        } else if (def !== undefined) {
            return def;
        } else {
            return trueDef;
        }
    }

    let getConfigValueString = (env, def, trueDef) =>
        getConfigValue<string>(env, def, trueDef, (str) => str);
    let getConfigValueBoolean = (env, def, trueDef) =>
        getConfigValue<boolean>(env, def, trueDef, (str) => Boolean(str));
    let getConfigValueNumber = (env, def, trueDef) =>
        getConfigValue<number>(env, def, trueDef, (str) => Number(str));

    export let probeConfig: SourcePlusPlusConfig;
    export let liveInstrumentRemote: LiveInstrumentRemote;

    let debug = false;
    let eventBus: EventBus;

    export async function start(config?: SourcePlusPlusConfig, paramDebug = false): Promise<void> {
        debug = paramDebug;

        let probeConfigFile = process.env.PROBE_CONFIG_FILE || 'spp-probe.yml';
        probeConfig = {}; // TODO: Make model for this?
        if (fs.existsSync(probeConfigFile)) {
            probeConfig = YAML.parse(fs.readFileSync(probeConfigFile, 'utf8'));
        }

        probeConfig.spp = probeConfig["spp-probe"] || {};
        probeConfig.skywalking = probeConfig.skywalking || {};
        probeConfig.skywalking.collector = probeConfig.skywalking.collector || {};
        probeConfig.skywalking.agent = probeConfig.skywalking.agent || {};

        probeConfig.spp.probe_id = getConfigValueString('SPP_PROBE_ID',
            probeConfig.spp.probe_id, randomUUID());
        probeConfig.spp.host = getConfigValueString('SPP_PLATFORM_HOST',
            probeConfig.spp.host, 'localhost');
        probeConfig.spp.grpc_port = getConfigValueNumber('SPP_PLATFORM_GRPC_PORT',
            probeConfig.spp.grpc_port, 11800);
        probeConfig.spp.rest_port = getConfigValueNumber('SPP_PLATFORM_REST_PORT',
            probeConfig.spp.rest_port, 12800);
        probeConfig.spp.verify_host = getConfigValueBoolean('SPP_TLS_VERIFY_HOST',
            probeConfig.spp.verify_host, true);
        probeConfig.spp.ssl_enabled = getConfigValueBoolean('SPP_HTTP_SSL_ENABLED',
            probeConfig.spp.ssl_enabled, true);
        probeConfig.skywalking.agent.service_name = getConfigValueString('SW_AGENT_SERVICE_NAME',
            probeConfig.skywalking.agent.service_name, 'spp-probe');

        probeConfig.skywalking.collector.backend_service = getConfigValueString("SW_COLLECTOR_BACKEND_SERVICE",
            probeConfig.skywalking.collector.backend_service, `${probeConfig.spp.host}:${probeConfig.spp.grpc_port}`);
        probeConfig.skywalking.agent.authentication = probeConfig.spp.authentication.tenant_id ?
            `${probeConfig.spp.authentication.client_id}:${probeConfig.spp.authentication.client_secret}:${probeConfig.spp.authentication.tenant_id}`
            : `${probeConfig.spp.authentication.client_id}:${probeConfig.spp.authentication.client_secret}`;

        // Copy given config
        Object.assign(probeConfig, config);

        debugLog("Loaded probe config:", probeConfig);

        return attach();
    }

    export async function stop(): Promise<void> {
        await agent.flush();
        eventBus.close();
    }

    async function attach(): Promise<void> {
        config.collectorAddress = probeConfig.skywalking.collector.backend_service;
        config.serviceName = probeConfig.skywalking.agent.service_name;
        config.authorization = probeConfig.skywalking.agent.authentication;
        // TODO: logReporterActive doesn't exist?
        config.secure = false; //todo: fix this and SW_RECEIVER_GRPC_SSL_ENABLED=false

        debugLog("Connecting to SkyWalking with config ", config);

        agent.start(config);

        debugLog("Connected");

        let caData;
        if (probeConfig.spp.ssl_enabled && probeConfig.spp.probe_certificate) {
            caData = `-----BEGIN CERTIFICATE-----\\n${probeConfig.spp.probe_certificate}\\n-----END CERTIFICATE-----`;
        }

        let url = `${probeConfig.spp.host}:${probeConfig.spp.rest_port}`;
        url = probeConfig.spp.ssl_enabled ? `https://${url}` : `http://${url}`;

        debugLog("Connecting to SourcePlusPlus with url:", url);

        // TODO: SSL context
        eventBus = new EventBus(url + "/probe/eventbus", {
            server: ""
        });
        eventBus.enableReconnect(true);

        // Add authentication headers
        eventBus.defaultHeaders = probeConfig.spp.authentication;

        return new Promise<void>((resolve, reject) => {
            eventBus.onopen = () => {
                debugLog("Connected to Source++ Platform");

                let promises = [];
                promises.push(sendConnected(eventBus));
                liveInstrumentRemote = new LiveInstrumentRemote(eventBus);
                promises.push(liveInstrumentRemote.start());

                Promise.all(promises).then(() => resolve(), reject);
            }
        });
    }

    async function sendConnected(eventBus: EventBus): Promise<void> {
        let probeMetadata = {
            language: 'nodejs',
            probe_version: '0.0.1', // TODO
            nodejs_version: process.version,
            service: config.serviceName,
            service_instance: config.serviceInstance,
        }

        if (probeConfig.spp.probe_metadata) {
            Object.assign(probeMetadata, probeConfig.spp.probe_metadata);
        }

        return new Promise<void>((resolve, reject) => {
            eventBus.send("spp.platform.status.probe-connected", {
                instanceId: probeConfig.spp.probe_id,
                connectionTime: Date.now(),
                meta: probeMetadata
            }, undefined, (err) => {
                if (err) {
                    reject(err);
                } else {
                    registerRemotes(eventBus);
                    resolve();
                }
            });
        });
    }

    function registerRemotes(eventBus: EventBus) {
        eventBus.registerHandler("spp.probe.command.live-instrument-remote", {}, (err, message) => {
            debugLog("Received probe-wide instrument command: " + JSON.stringify(message.body));
            liveInstrumentRemote.handleInstrumentCommand(
                LiveInstrumentCommand.fromJson(message.body));
        });
        eventBus.registerHandler(`spp.probe.command.live-instrument-remote:${probeConfig.spp.probe_id}`, {}, (err, message) => {
            debugLog("Received probe-specific instrument command: " + JSON.stringify(message.body));
            liveInstrumentRemote.handleInstrumentCommand(
                LiveInstrumentCommand.fromJson(message.body));
        });
    }

    export function debugLog(...args: any[]) {
        if (debug) {
            console.log(...args);
        }
    }
}

export default SourcePlusPlus;
module.exports = SourcePlusPlus; //todo: idk why this is needed for E2ETest.js to work
