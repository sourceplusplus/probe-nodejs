const assert = require('assert');
const TestUtils = require("./TestUtils.js");

module.exports = function () {
    function simplePrimitives() {
        let i = 1
        TestUtils.addLineLabel("done", () => TestUtils.getLineNumber())
    }

    it('add live log with args', async function () {
        simplePrimitives() //setup labels

        await TestUtils.addLiveLog({
            "source": TestUtils.getFilename()(),
            "line": TestUtils.getLineLabelNumber("done")
        }, null, 1, "arg i = {}", ["i"]).then(function (res) {
            assert.equal(res.status, 200);
            simplePrimitives(); //trigger breakpoint
        }).catch(function (err) {
            assert.fail(err)
        });
    });

    it('verify log data', async function () {
        this.timeout(2000)

        setTimeout(() => simplePrimitives(), 1000);

        let event = await TestUtils.awaitMarkerEvent("LOG_HIT");
        let logResult = event.logResult
        assert.notEqual(logResult, undefined);

        let logs = logResult.logs
        assert.notEqual(logs, undefined);
        assert.equal(logs.length, 1);

        let log = logs[0]
        assert.notEqual(log, undefined);
        assert.equal(log.content, "arg i = {}");

        let args = log.arguments
        assert.notEqual(args, undefined);
        assert.equal(args.length, 1);

        let arg = args[0]
        assert.equal(arg, "1");
    });
};