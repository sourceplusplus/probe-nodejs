const assert = require('assert');
const TestUtils = require("./TestUtils.js");

module.exports = function () {
    function simpleCollections() {
        let ints = [1, -1]
        let strings = ['h', 'i']
        let doubles = [-1.0, 1.0]
        let booleans = [true, false]
        // let objects = [{}, {}]
        // let arrays = [[], []]
        // let maps = [new Map(), new Map()]
        // let sets = [new Set(), new Set()]
        TestUtils.addLineLabel("done", () => TestUtils.getLineNumber())
    }

    it('add live breakpoint', async function () {
        simpleCollections() //setup labels

        await TestUtils.addLiveBreakpoint({
            "source": TestUtils.getFilename()(),
            "line": TestUtils.getLineLabelNumber("done")
        }, null, 1).then(function (res) {
            assert.equal(res.status, 200);
            simpleCollections(); //trigger breakpoint
        }).catch(function (err) {
            assert.fail(err)
        });
    });

    it('verify breakpoint data', async function () {
        this.timeout(2000)
        let event = await TestUtils.awaitMarkerEvent("BREAKPOINT_HIT");
        let variables = event.stackTrace.elements[0].variables;

        let intsVar = TestUtils.locateVariable("ints", variables);
        // assert.equal(intsVar.liveClazz, "number");
        assert.deepEqual(
            [1, -1],
            [intsVar.value[0].value[0].value, intsVar.value[1].value[0].value]
        );

        let strings = TestUtils.locateVariable("strings", variables);
        // assert.equal(cVar.liveClazz, "string");
        assert.deepEqual(
            ['h', 'i'],
            [strings.value[0].value[0].value, strings.value[1].value[0].value]
        );

        let doubles = TestUtils.locateVariable("doubles", variables);
        // assert.equal(cVar.liveClazz, "string");
        assert.deepEqual(
            [-1.0, 1.0],
            [doubles.value[0].value[0].value, doubles.value[1].value[0].value]
        );

        let booleans = TestUtils.locateVariable("booleans", variables);
        // assert.equal(cVar.liveClazz, "string");
        // assert.deepEqual(
        //     [true, false],
        //     [booleans.value[0].value[0].value, booleans.value[1].value[0].value]
        // ); //todo: false shows up as "null"
    });
};
