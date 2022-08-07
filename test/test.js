const TestUtils = require("./TestUtils");

before(TestUtils.setupProbe);
after(TestUtils.teardownProbe);

describe("simple primitives", require("./SimplePrimitivesLiveInstrumentTest"));