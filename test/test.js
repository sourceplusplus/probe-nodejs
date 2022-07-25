const host = "http://localhost:12800";
const assert = require('assert');
const {default: axios} = require("axios");

const tokenPromise = axios.get(`${host}/api/new-token?access_token=change-me`)
    .then(response => response.data);

describe('Stats', function () {
    let response;
    describe('/stats', function () {
        before(async function () {
            return axios.get(`${host}/stats`, {
                headers: {Authorization: 'Bearer ' + await tokenPromise}
            }).then(function (res) {
                response = res;
            })
        });

        it('200 status code', function () {
            assert.equal(response.status, 200);
        })

        it('probe is connected', function () {
            console.log(response.data);
            assert.equal(
                response.data.platform["connected-probes"],
                1
            )
        });

        it('live-instrument-remote remote registered', function () {
            assert.equal(
                response.data.platform.services.probe["spp.probe.command.live-instrument-remote"],
                1
            )
        });
    });
});

describe('Clients', function () {
    let response;
    describe('/clients', function () {
        before(async function () {
            return axios.get(`${host}/clients`, {
                headers: {Authorization: 'Bearer ' + await tokenPromise}
            }).then(function (res) {
                response = res;
            })
        });

        it('200 status code', function () {
            assert.equal(response.status, 200);
        })

        it('contains nodejs probe', function () {
            assert.equal(
                response.data.probes[0].meta.language,
                "nodejs"
            )
        });

        it('live-instrument-remote remote registered', function () {
            assert.equal(
                response.data.probes[0].meta.remotes[0],
                "spp.probe.command.live-instrument-remote"
            )
        });
    });
});

describe('Add Live Breakpoint', function () {
    let response;
    describe('/graphql', function () {
        before(function () {
            return addLiveBreakpoint(
                {
                    "source": "test.js",
                    "line": 10
                },
                20
            ).then(function (res) {
                response = res;
            })
        });

        it('200 status code', function () {
            assert.equal(response.status, 200);
        })

        it('add has no errors', function () {
            assert.equal(
                response.data.errors,
                null
            )
        })

        it('verify location', function () {
            assert.equal(
                response.data.data.addLiveBreakpoint.location.source,
                "test.js"
            )
            assert.equal(
                response.data.data.addLiveBreakpoint.location.line,
                10
            )
        });

        it('verify hit limit', function () {
            assert.equal(
                response.data.data.addLiveBreakpoint.hitLimit,
                20
            )
        });

        it('remove breakpoint', function () {
            return removeLiveInstrument(response.data.data.addLiveBreakpoint.id).then(function (res) {
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

describe('NodeJS Probe', function () {
    const SourcePlusPlus = require("../dist/SourcePlusPlus.js");
    let instrumentId;
    let response;

    describe("connect test probe to platform", function () {
        before(async function () {
            return SourcePlusPlus.start().then(function () {
                console.log("SourcePlusPlus started");
            }).catch(function (err) {
                assert.fail(err);
            });
        });
        after(async function () {
            return SourcePlusPlus.stop();
        });

        it('add live breakpoint', async function () {
            await addLiveBreakpoint({
                "source": "test/test.js",
                "line": 10
            }, 20).then(function (res) {
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
