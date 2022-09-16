const TestUtils = require("./TestUtils");

before(TestUtils.setupProbe);
after(TestUtils.teardownProbe);

describe("test breakpoint after breakpoint", require("./BreakpointAfterBreakpointTest"));
describe("test simple primitives", require("./SimplePrimitivesLiveInstrumentTest"));
describe("test simple collections", require("./SimpleCollectionsLiveInstrumentTest"));
describe("test live log", require("./LiveLogTest"));
describe("test hit limit", require("./HitLimitTest"));