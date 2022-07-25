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

    export async function start(config?: SourcePlusPlusConfig, paramDebug = false): Promise<void> {
        debug = paramDebug;

        let probeConfigFile = process.env.PROBE_CONFIG_FILE || 'spp-probe.yml';
        probeConfig = {}; // TODO: Make model for this?
        if (fs.existsSync(probeConfigFile)) {
            probeConfig = YAML.parse(fs.readFileSync(probeConfigFile, 'utf8'));
        }

        probeConfig.spp = probeConfig.spp || {};
        probeConfig.skywalking = probeConfig.skywalking || {};
        probeConfig.skywalking.collector = probeConfig.skywalking.collector || {};
        probeConfig.skywalking.agent = probeConfig.skywalking.agent || {};

        probeConfig.spp.probe_id = getConfigValueString('SPP_PROBE_ID',
            probeConfig.spp.probe_id, randomUUID());
        probeConfig.spp.platform_host = getConfigValueString('SPP_PLATFORM_HOST',
            probeConfig.spp.platform_host, 'localhost');
        probeConfig.spp.platform_port = getConfigValueNumber('SPP_PLATFORM_PORT',
            probeConfig.spp.platform_port, 5450);
        probeConfig.spp.verify_host = getConfigValueBoolean('SPP_TLS_VERIFY_HOST',
            probeConfig.spp.verify_host, true);
        probeConfig.spp.ssl_enabled = getConfigValueBoolean('SPP_HTTP_SSL_ENABLED',
            probeConfig.spp.ssl_enabled, true);
        probeConfig.skywalking.agent.service_name = getConfigValueString('SKYWALKING_AGENT_SERVICE_NAME',
            probeConfig.skywalking.agent.service_name, 'spp-probe');

        let skywalkingHost = getConfigValueString('SPP_OAP_HOST', 'localhost', 'localhost');
        let skywalkingPort = getConfigValueNumber('SPP_OAP_PORT', 11800, 11800);

        probeConfig.skywalking.collector.backend_service = getConfigValueString("SPP_SKYWALKING_BACKEND_SERVICE",
            probeConfig.skywalking.collector.backend_service, `${skywalkingHost}:${skywalkingPort}`);

        // Copy given config
        Object.assign(probeConfig, config);

        debugLog("Loaded probe config:", probeConfig);

        return attach();
    }

    async function attach(): Promise<void> {
        config.collectorAddress = probeConfig.skywalking.collector.backend_service;
        config.serviceName = probeConfig.skywalking.agent.service_name;
        // TODO: logReporterActive doesn't exist?
        config.secure = false; //todo: fix this and SW_RECEIVER_GRPC_SSL_ENABLED=false

        debugLog("Connecting to SkyWalking with config ", config);

        agent.start(config);

        debugLog("Connected");

        let caData;
        if (probeConfig.spp.ssl_enabled && probeConfig.spp.probe_certificate) {
            caData = `-----BEGIN CERTIFICATE-----\\n${probeConfig.spp.probe_certificate}\\n-----END CERTIFICATE-----`;
        }

        let url = `${probeConfig.spp.platform_host}:12800`; //todo: configurable port
        url = probeConfig.spp.ssl_enabled ? `https://${url}` : `http://${url}`;

        debugLog("Connecting to SourcePlusPlus with url:", url);


        // TODO: SSL context
        let eventBus = new EventBus(url + "/probe/eventbus", {
            server: ""
        });
        eventBus.enableReconnect(true);

        return new Promise<void>((resolve, reject) => {
            eventBus.onopen = () => {
                debugLog("Connected to SourcePlusPlus");

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
            probe_version: '1.0.0', // TODO
            nodejs_version: process.version,
            service: config.serviceName,
            service_instance: config.serviceInstance,
        }

        if (probeConfig.spp.probe_metadata) {
            Object.assign(probeMetadata, probeConfig.spp.probe_metadata);
        }

        let replyAddress = randomUUID();
        return new Promise<void>((resolve, reject) => {
            eventBus.send("spp.platform.status.probe-connected", {
                instanceId: probeConfig.spp.probe_id,
                connectionTime: Date.now(),
                meta: probeMetadata
            }, undefined, (err, reply) => {
                if (err) {
                    reject(err);
                } else {
                    registerRemotes(eventBus, replyAddress, reply.body);
                    resolve();
                }
            });
        });
    }

    function registerRemotes(eventBus: EventBus, replyAddress: string, status) {
        eventBus.registerHandler("spp.probe.command.live-instrument-remote", {}, (err, message) => {
            liveInstrumentRemote.handleInstrumentCommand(
                LiveInstrumentCommand.fromJson(message.body));
        });
        eventBus.registerHandler(`spp.probe.command.live-instrument-remote:${probeConfig.spp.probe_id}`, {}, (err, message) => {
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
