const host = "http://localhost:12800";
const SYSTEM_JWT_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJkZXZlbG9wZXJfaWQiOiJzeXN0ZW0iLCJjcmVhdGVkX2F0IjoxNjU4NzM3Njc5NTIxLCJleHBpcmVzX2F0IjoxNjkwMjczNjc5NTIxLCJpYXQiOjE2NTg3Mzc2Nzl9.C70FjmmhLoG38x5LWa9LuzTMs1YnP0DRMfZxVuzBa6OzEp-dEvGIS5Y_k7LiZSRqjgXyaUGpXnDXzOUPigrpwj7Fx_IYrgkOwuw5l-Wv4hasI-RYQjx5MZLa-dmw_ObY8_AOHF_XNuElPVSKpKMpN6THRT2IfelXKz6OINgZr4pQzqgFlc4KnVhB87Rm9Ya-KbxvzREicp5mmVGo2Ca4_nf7SyM5ZLP1vYw4FOt_Eejioub859q-CCL1ZqwvPb3Kwmzga3USLyAzlk_R4vYZWDyZmq0qiOTBO2V97GleXbl8b4Xiw3Uxwlc76svDefNNH0VLtWM-mOPhRNnUPiUbcQHxNTCTuHF6jEhvvVbKaq5welGkINF7HLX7zGxcYwylsz6UVNa3c-LX89wfQbKlGr9pERJSwCvNtTMHq7oj_xI99e4A1cw7DX8LjAnp9zrUZgpo7OVT_TEVFXKtNQtKlKn6Pg48y6sFE3Wf48An6A5cIzrgHjfyOq1NWbDrQMon4acD_jPwcFYn21Or2YULRBRQR7hQCGBvkoIo5t24e-5ELm9h5PTcDeDLndKsik8DjzhPuLIqU9_gM0WMrr5sC0nh5eR2GMKfedcKULUU5Ql3Y_3Q0_hUx-wQ8ZT2LJez6bZF6vSgr9E6d6QpL5tfIg4vbsDYj-yqdhzB4R7XvUQ"
const assert = require('assert');
const {default: axios} = require("axios");

describe('Stats', function () {
    let response;
    describe('/stats', function () {
        before(function () {
            return axios.get(`${host}/stats`, {
                headers: {Authorization: 'Bearer ' + SYSTEM_JWT_TOKEN}
            }).then(function (res) {
                response = res;
            })
        });

        it('200 status code', function () {
            assert.equal(response.status, 200);
        })

        it('probe is connected', function () {
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
        before(function () {
            return axios.get(`${host}/clients`, {
                headers: {Authorization: 'Bearer ' + SYSTEM_JWT_TOKEN}
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
        before(function () {
            return SourcePlusPlus.start().then(function (spp) {
                console.log("SourcePlusPlus started");
            }).catch(function (err) {
                assert.fail(err);
            });
        });
        after(function () {
            return SourcePlusPlus.stop();
        });

        it('add live breakpoint', function () {
            addLiveBreakpoint({
                "source": "test.js",
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
                assert.equal(SourcePlusPlus.liveInstrumentRemote.instrumentCache.size, 1);
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

function addLiveBreakpoint(location, hitLimit) {
    const options = {
        method: 'POST',
        url: `${host}/graphql/spp`,
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + SYSTEM_JWT_TOKEN
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

function removeLiveInstrument(id) {
    const options = {
        method: 'POST',
        url: `${host}/graphql/spp`,
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + SYSTEM_JWT_TOKEN
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
