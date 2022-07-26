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
