const SourcePlusPlus = require("sourceplusplus");

setTimeout(() => {
    SourcePlusPlus.start().then(() => {
        // Run tests
        console.log("Running tests...");
        // Keep running this method, so we can test breakpoints, logs, etc.
        (function test() {
            let i = 0;

            for (let j = 0; j < 10; j++) {
                if (j % 2 === 0) {
                    i++;
                }
            }

            setTimeout(test, 1000);
        })();

        setTimeout(() => console.log("Source mappings: ", Object.fromEntries(SourcePlusPlus.liveInstrumentRemote.sourceMapper.mapped)), 1000);
    });
}, 15000); // Wait for Source++ Platform to fully start