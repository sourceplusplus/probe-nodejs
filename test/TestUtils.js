const host = "http://localhost:12800";
const {default: axios} = require("axios");

const tokenPromise = axios.get(`${host}/api/new-token?access_token=change-me`)
    .then(response => response.data);

class TestUtils {

    static lineLabels = {}
    static markerListeners = {}

    static addLineLabel(label, lineNumberFunc) {
        TestUtils.lineLabels[label] = lineNumberFunc.call();
    }

    static getLineNumber(label) {
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
}

module.exports = TestUtils;