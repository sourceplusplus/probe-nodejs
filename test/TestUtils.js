const host = "http://localhost:12800";
const assert = require('assert');
const {default: axios} = require("axios");
const SourcePlusPlus = require("../dist/SourcePlusPlus");
const EventBus = require("@vertx/eventbus-bridge-client.js");
const path = require("path");

const tokenPromise = axios.get(`${host}/api/new-token?authorization_code=change-me`)
    .then(response => response.data);

class TestUtils {

    static lineLabels = {}
    static markerListeners = {}
    static markerEventBus;

    static async setupProbe() {
        this.timeout(15000);

        await SourcePlusPlus.start(null, true).then(function () {
            console.log("SourcePlusPlus started");
        }).catch(function (err) {
            assert.fail(err);
        });

        await TestUtils.setupMarker();

        // Without waiting long enough, the spp.probe.command.live-instrument-remote counter isn't incremented
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    static async setupMarker() {
        TestUtils.markerEventBus = new EventBus(host + "/marker/eventbus");
        TestUtils.markerEventBus.enableReconnect(true);
        await new Promise((resolve, reject) => {
            TestUtils.markerEventBus.onopen = async function () {
                //send marker connected
                TestUtils.markerEventBus.send("spp.platform.status.marker-connected", {
                    instanceId: "test-marker-id",
                    connectionTime: Date.now(),
                    meta: {}
                }, {
                    "access-token": await tokenPromise
                }, async (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        //listen for instrument events
                        TestUtils.markerEventBus.registerHandler("spp.service.live-instrument.subscriber:system", {
                            "access-token": await tokenPromise
                        }, function (err, message) {
                            console.log("Received event: " + JSON.stringify(message));
                            if (!err) {
                                if (TestUtils.markerListeners[message.body.eventType]) {
                                    TestUtils.markerListeners[message.body.eventType]
                                        .forEach(listener => listener(message.body));
                                }
                            }
                        });
                        resolve();
                    }
                });
            }
        });
    }

    static async teardownProbe() {
        await SourcePlusPlus.stop();
        TestUtils.markerEventBus.close();
    }

    static async teardownMarker() {
        TestUtils.markerEventBus.close();
    }

    static addLineLabel(label, lineNumberFunc) {
        TestUtils.lineLabels[label] = lineNumberFunc.call();
    }

    static getLineLabelNumber(label) {
        return TestUtils.lineLabels[label];
    }

    static awaitMarkerEvent(eventName) {
        if (!TestUtils.markerListeners[eventName]) {
            TestUtils.markerListeners[eventName] = [];
        }

        console.log("Awaiting event: " + eventName);
        return new Promise(resolve => TestUtils.markerListeners[eventName].push(data => resolve(data)));
    }

    static locateVariable(name, variables) {
        for (let variable of variables) {
            if (variable.name === name) {
                return variable;
            }
        }
    }

    static async addLiveBreakpoint(location, condition, hitLimit) {
        const options = {
            method: 'POST',
            url: `${host}/graphql/spp`,
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + await tokenPromise
            },
            data: {
                "query": "mutation ($input: LiveBreakpointInput!) { addLiveBreakpoint(input: $input) { id location { source line } condition expiresAt hitLimit applyImmediately applied pending throttle { limit step } } }",
                "variables": {
                    "input": {
                        "location": location,
                        "condition": condition,
                        "hitLimit": hitLimit,
                        "applyImmediately": true
                    }
                }
            }
        };
        return axios.request(options);
    }

    static async addLiveLog(location, condition, hitLimit, logFormat, logArguments) {
        const options = {
            method: 'POST',
            url: `${host}/graphql/spp`,
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + await tokenPromise
            },
            data: {
                "query": "mutation ($input: LiveLogInput!) { addLiveLog(input: $input) { id logFormat logArguments location { source line } condition expiresAt hitLimit applyImmediately applied pending throttle { limit step } } }",
                "variables": {
                    "input": {
                        "logFormat": logFormat,
                        "logArguments": logArguments,
                        "location": location,
                        "condition": condition,
                        "hitLimit": hitLimit,
                        "applyImmediately": true,
                    }
                }
            }
        };
        return axios.request(options);
    }

    static getLineNumber() {
        var e = new Error();
        if (!e.stack) try {
            // IE requires the Error to actually be thrown or else the Error's 'stack'
            // property is undefined.
            throw e;
        } catch (e) {
            if (!e.stack) {
                return 0; // IE < 10, likely
            }
        }
        var stack = e.stack.toString().split(/\r\n|\n/);
        // We want our caller's frame. It's index into |stack| depends on the
        // browser and browser version, so we need to search for the second frame:
        var frameRE = /:(\d+):(?:\d+)[^\d]*$/;
        do {
            var frame = stack.shift();
        } while (!frameRE.exec(frame) && stack.length);
        return frameRE.exec(stack.shift())[1];
    }

    static getFilename = () => {
        return () => {
            let basePath = process.cwd();
            let str = /at .* \(([a-z0-9\/\\\s\-:]*\.js):\d+:\d+\)/ig.exec(new Error().stack)[1];
            let relative = path.relative(basePath, str);
            return relative.replaceAll('\\', '/');
        }
    }
}

module.exports = TestUtils;