const assert = require('assert');
const TestUtils = require("./TestUtils.js");

module.exports = function () {
    function hitBreakpoint() {
        TestUtils.addLineLabel("done", () => TestUtils.getLineNumber())
    }

    it('add first live breakpoint', async function () {
        hitBreakpoint() //setup labels

        await TestUtils.addLiveBreakpoint({
            "source": TestUtils.getFilename()(),
            "line": TestUtils.getLineLabelNumber("done")
        }, null, 1).then(function (res) {
            assert.equal(res.status, 200);
            hitBreakpoint(); //trigger breakpoint
        }).catch(function (err) {
            assert.fail(err)
        });
    });

    it('verify first breakpoint hit', async function () {
        this.timeout(2000)
        let event = await TestUtils.awaitMarkerEvent("BREAKPOINT_HIT");
        assert.notEqual(event, null);
    });

    it('add second live breakpoint', async function () {
        await TestUtils.addLiveBreakpoint({
            "source": TestUtils.getFilename()(),
            "line": TestUtils.getLineLabelNumber("done")
        }, null, 1).then(function (res) {
            assert.equal(res.status, 200);
            hitBreakpoint(); //trigger breakpoint
        }).catch(function (err) {
            assert.fail(err)
        });
    });

    it('verify second breakpoint hit', async function () {
        this.timeout(2000)
        let event = await TestUtils.awaitMarkerEvent("BREAKPOINT_HIT");
        assert.notEqual(event, null);
    });
};