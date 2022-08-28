const assert = require('assert');
const TestUtils = require("./TestUtils.js");

module.exports = function () {
    function simplePrimitives() {
        let i = 1
        let c = 'h'
        let s = "hi"
        let f = 1.0
        let bool = true
        TestUtils.addLineLabel("done", () => TestUtils.getLineNumber())
    }

    it('add live log', async function () {
        simplePrimitives() //setup labels

        await TestUtils.addLiveLog({
            "source": TestUtils.getFilename()(),
            "line": TestUtils.getLineLabelNumber("done")
        }, null, 1, "test log", []).then(function (res) {
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
        console.log(event);
        // assert.equal(event.stackTrace.elements[0].method, 'simplePrimitives');
        // let variables = event.stackTrace.elements[0].variables;
        //
        // let iVar = TestUtils.locateVariable("i", variables);
        // assert.equal(iVar.liveClazz, "number");
        // assert.equal(iVar.value, 1);
        //
        // let cVar = TestUtils.locateVariable("c", variables);
        // assert.equal(cVar.liveClazz, "string");
        // assert.equal(cVar.value, "h");
        //
        // let sVar = TestUtils.locateVariable("s", variables);
        // assert.equal(sVar.liveClazz, "string");
        // assert.equal(sVar.value, "hi");
        //
        // let fVar = TestUtils.locateVariable("f", variables);
        // assert.equal(fVar.liveClazz, "number");
        // assert.equal(fVar.value, 1.0);
        //
        // let boolVar = TestUtils.locateVariable("bool", variables);
        // assert.equal(boolVar.liveClazz, "boolean");
        // assert.equal(boolVar.value, true);
    });
};