const assert = require('assert');
const TestUtils = require("./TestUtils.js");

module.exports = function () {
    function simplePrimitives() {
        let i = undefined;
        let i2 = null;
        TestUtils.addLineLabel("done", () => TestUtils.getLineNumber())
    }

    it('add live log with undefined args', async function () {
        simplePrimitives() //setup labels

        await TestUtils.addLiveLog({
            "source": TestUtils.getFilename()(),
            "line": TestUtils.getLineLabelNumber("done")
        }, null, 1, "arg i = {}, i2 = {}, i3 = {}", ["i", "i2", "i3"]).then(function (res) {
            assert.equal(res.status, 200);

            //trigger log (after listener is registered)
            setTimeout(() => simplePrimitives(), 500);
        }).catch(function (err) {
            assert.fail(err)
        });
    });

    it('verify log data', async function () {
        this.timeout(200000)

        let event = await TestUtils.awaitMarkerEvent("LOG_HIT");
        let logResult = event.logResult
        assert.notEqual(logResult, undefined);

        let logs = logResult.logs
        assert.notEqual(logs, undefined);
        assert.equal(logs.length, 1);

        let log = logs[0]
        assert.notEqual(log, undefined);
        assert.equal(log.content, "arg i = {}, i2 = {}, i3 = {}");

        let args = log.arguments
        assert.notEqual(args, undefined);
        assert.equal(args.length, 3);

        assert.equal(args[0], "undefined");
        assert.equal(args[1], "undefined");
        assert.equal(args[2], "undefined");
    });
};