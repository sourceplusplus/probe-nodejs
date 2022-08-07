const host = "http://localhost:12800";
const assert = require('assert');
const {default: axios} = require("axios");
const SourcePlusPlus = require("../dist/SourcePlusPlus");
const EventBus = require("@vertx/eventbus-bridge-client.js");

const tokenPromise = axios.get(`${host}/api/new-token?access_token=change-me`)
    .then(response => response.data);

let markerEventBus;

// Gather data before adding the probe
before(async function () {
    this.timeout(15000);

    await SourcePlusPlus.start().then(function () {
        console.log("SourcePlusPlus started");
    }).catch(function (err) {
        assert.fail(err);
    });

    markerEventBus = new EventBus(host + "/marker/eventbus");
    markerEventBus.enableReconnect(true);
    await new Promise((resolve, reject) => {
        markerEventBus.onopen = async function () {
            //send marker connected
            markerEventBus.send("spp.platform.status.marker-connected", {
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
                    markerEventBus.registerHandler("spp.service.live-instrument.subscriber:system", {
                        "auth-token": await tokenPromise
                    }, function (err, message) {
                        if (!err) {
                            if (markerListeners[message.body.eventType]) {
                                markerListeners[message.body.eventType]
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
});

// Stop the probe once we're done testing
after(async function () {
    await SourcePlusPlus.stop();
    markerEventBus.close();
});

describe('NodeJS Probe', function () {
    describe("test breakpoint", function () {
        function simplePrimitives() {
            let i = 1
            let c = 'h'
            let s = "hi"
            let f = 1.0
            let bool = true
            console.log("done")
        }

        it('add live breakpoint', async function () {
            await addLiveBreakpoint({
                "source": "test/SimplePrimitivesLiveInstrumentTest.js",
                "line": 72
            }, null, 1).then(function (res) {
                assert.equal(res.status, 200);
                simplePrimitives();
            }).catch(function (err) {
                assert.fail(err)
            });
        });

        it('verify breakpoint data', async function () {
            this.timeout(2000)
            let event = await awaitMarkerEvent("BREAKPOINT_HIT");
            assert.equal(event.stackTrace.elements[0].method, 'simplePrimitives');
            let variables = event.stackTrace.elements[0].variables;

            let iVar = locateVariable("i", variables);
            assert.equal(iVar.liveClazz, "number");
            assert.equal(iVar.value, 1);

            let cVar = locateVariable("c", variables);
            assert.equal(cVar.liveClazz, "string");
            assert.equal(cVar.value, "h");

            let sVar = locateVariable("s", variables);
            assert.equal(sVar.liveClazz, "string");
            assert.equal(sVar.value, "hi");

            let fVar = locateVariable("f", variables);
            assert.equal(fVar.liveClazz, "number");
            assert.equal(fVar.value, 1.0);

            let boolVar = locateVariable("bool", variables);
            //assert.equal(boolVar.liveClazz, "boolean"); //todo: this
            //assert.equal(boolVar.value, true); //todo: this
        });
    });
});

let markerListeners = {}

async function awaitMarkerEvent(eventName) {
    if (!markerListeners[eventName]) {
        markerListeners[eventName] = [];
    }
    return new Promise(resolve => markerListeners[eventName].push(data => resolve(data)));
}

async function addLiveBreakpoint(location, condition, hitLimit) {
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

function locateVariable(name, variables) {
    for (let variable of variables) {
        if (variable.name === name) {
            return variable;
        }
    }
}
