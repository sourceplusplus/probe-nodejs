const SourcePlusPlus = require("../../dist/SourcePlusPlus.js");
SourcePlusPlus.start({}, true).then(() => {
    let testarray = ["this", "is", "an", "array"];

    console.log("test");

    SourcePlusPlus.liveInstrumentRemote.test();

    let i = 2;
});