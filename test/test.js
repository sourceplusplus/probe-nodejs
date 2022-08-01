const host = "http://localhost:12800";
const assert = require('assert');
const {default: axios} = require("axios");
const SourcePlusPlus = require("../dist/SourcePlusPlus");

const tokenPromise = axios.get(`${host}/api/new-token?access_token=change-me`)
    .then(response => response.data);

let oldStatsResponse;
let oldClientsResponse;

// Gather data before adding the probe
before(async function () {
    this.timeout(15000);

    oldStatsResponse = await axios.get(`${host}/stats`, {
        headers: {
            Authorization: 'Bearer ' + await tokenPromise
        }
    });

    if (oldStatsResponse.status !== 200) {
        throw new Error("Failed to get original stats");
    }

    oldClientsResponse = await axios.get(`${host}/clients`, {
        headers: {
            Authorization: 'Bearer ' + await tokenPromise
        }
    });

    if (oldClientsResponse.status !== 200) {
        throw new Error("Failed to get original clients");
    }

    await SourcePlusPlus.start().then(function () {
        console.log("SourcePlusPlus started");
    }).catch(function (err) {
        assert.fail(err);
    });

    // Without waiting long enough, the spp.probe.command.live-instrument-remote counter isn't incremented
    await new Promise(resolve => setTimeout(resolve, 10000));
});

// Stop the probe once we're done testing
after(async function () {
    await SourcePlusPlus.stop();
});

describe('Stats', function () {
    let response;
    describe('/stats', function () {
        before(async function () {
            response = await axios.get(`${host}/stats`, {
                headers: {Authorization: 'Bearer ' + await tokenPromise}
            });
        });

        it('200 status code', function () {
            assert.equal(response.status, 200);
        })

        it('probe is connected', function () {
            assert.equal(
                response.data.platform["connected-probes"],
                oldStatsResponse.data.platform["connected-probes"] + 1
            )
        });

        it('live-instrument-remote remote registered', function () {
            assert.equal(
                response.data.platform.services.probe["spp.probe.command.live-instrument-remote"],
                oldStatsResponse.data.platform.services.probe["spp.probe.command.live-instrument-remote"] + 1
            )
        });
    });
});

describe('Clients', function () {
    let response;
    let probe;
    describe('/clients', function () {
        before(async function () {
            response = await axios.get(`${host}/clients`, {
                headers: {Authorization: 'Bearer ' + await tokenPromise}
            });
        });

        it('200 status code', function () {
            assert.equal(response.status, 200);
        })

        it('contains nodejs probe', function () {
            let probes = response.data.probes;
            probes = probes.filter(p => oldClientsResponse.data.probes.find(op => op.id === p.id) === undefined);
            assert.equal(probes.length, 1);
            probe = probes[0];

            assert.equal(
                probe.meta.language,
                "nodejs"
            )
        });

        it('live-instrument-remote remote registered', function () {
            assert.equal(
                probe.meta.remotes[0],
                "spp.probe.command.live-instrument-remote"
            )
        });
    });
});

describe('NodeJS Probe', function () {
    let instrumentId;
    let response;
    let liveInstrumentTest;

    describe("test breakpoint", function () {
        before(async function () {
            liveInstrumentTest = require("./LiveInstrumentTest.js");
        });
        after(async function () {
            liveInstrumentTest.stop();
        });

        it('add live breakpoint', async function () {
            await addLiveBreakpoint({
                "source": "test/LiveInstrumentTest.js",
                "line": 8
            }, 10).then(function (res) {
                assert.equal(res.status, 200);
                instrumentId = res.data.data.addLiveBreakpoint.id;
            }).catch(function (err) {
                assert.fail(err)
            });
        });

        it('verify probe is aware of breakpoint', function (done) {
            this.timeout(6000)

            setTimeout(function () {
                assert.equal(SourcePlusPlus.liveInstrumentRemote.instruments.size, 1);
                done();
            }, 5000);
        });

        it('remove breakpoint', function () {
            return removeLiveInstrument(instrumentId).then(function (res) {
                response = res;
            })
        });

        it('200 status code', function () {
            assert.equal(response.status, 200);
        })

        it('remove has no errors', function () {
            assert.equal(
                response.data.errors,
                null
            )
        })
    });
});

async function addLiveBreakpoint(location, hitLimit) {
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
                    "hitLimit": hitLimit
                }
            }
        }
    };
    return axios.request(options);
}

async function removeLiveInstrument(id) {
    const options = {
        method: 'POST',
        url: `${host}/graphql/spp`,
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + await tokenPromise
        },
        data: {
            "query": "mutation ($id: String!) { removeLiveInstrument(id: $id) { id } }",
            "variables": {
                "id": id
            }
        }
    };
    return axios.request(options);
}
