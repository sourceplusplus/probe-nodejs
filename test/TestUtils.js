const host = "http://localhost:12800";
const assert = require('assert');
const {default: axios} = require("axios");
const SourcePlusPlus = require("../dist/SourcePlusPlus");
const EventBus = require("@vertx/eventbus-bridge-client.js");

const tokenPromise = axios.get(`${host}/api/new-token?access_token=change-me`)
    .then(response => response.data);

class TestUtils {

    static lineLabels = {}
    static markerListeners = {}
    static markerEventBus;

    static async setupProbe() {
        this.timeout(15000);

        await SourcePlusPlus.start().then(function () {
            console.log("SourcePlusPlus started");
        }).catch(function (err) {
            assert.fail(err);
        });

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
                    "auth-token": await tokenPromise
                }, async (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        //listen for breakpoint events
                        TestUtils.markerEventBus.registerHandler("spp.service.live-instrument.subscriber:system", {
                            "auth-token": await tokenPromise
                        }, function (err, message) {
                            if (!err) {
                                if (TestUtils.markerListeners[message.body.eventType]) {
                                    TestUtils.markerListeners[message.body.eventType]
                                        .forEach(listener => listener(JSON.parse(message.body.data)));
                                }
                            }
                        });
                        resolve();
                    }
                });
            }
        });

        // Without waiting long enough, the spp.probe.command.live-instrument-remote counter isn't incremented
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    static async teardownProbe() {
        await SourcePlusPlus.stop();
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
            return new Error().stack.match(/([^ \n])*([a-z]*:\/\/\/?)*?[a-z0-9\/\\]*\.js/ig)[0]
        }
    }
}

module.exports = TestUtils;