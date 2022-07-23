class TestClass {
    test: string
    test2

    constructor() {
        this.test = 'test';
        this.test2 = Object;
    }

    testMethod() {
        this.test = this.test + "more";
        return this.test;
    }
}

function testFunc() {
    let i = 0;

    new TestClass().testMethod();

    return "test" + i;
}

exports.testFunc = testFunc;