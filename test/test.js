const SYSTEM_JWT_TOKEN =
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJkZXZlbG9wZXJfaWQiOiJzeXN0ZW0iLCJjcmVhdGVkX2F0IjoxNjIyNDIxMzY0ODY4" +
    "LCJleHBpcmVzX2F0IjoxNjUzOTU3MzY0ODY4LCJpYXQiOjE2MjI0MjEzNjR9.ZVHtxQkfCF7KM_dyDOgawbwpEAsmnCWB4c8I" +
    "52svPvVc-SlzkEe0SYrNufNPniYZeM3IF0Gbojl_DSk2KleAz9CLRO3zfegciXKeEEvGjsNOqfQjgU5yZtBWmTimVXq5QoZME" +
    "GuAojACaf-m4J0H7o4LQNGwrDVA-noXVE0Eu84A5HxkjrRuFlQWv3fzqSRC_-lI0zRKuFGD-JkIfJ9b_wP_OjBWT6nmqkZn_J" +
    "mK7UwniTUJjocszSA2Ma3XLx2xVPzBcz00QWyjhIyiftxNQzgqLl1XDVkRtzXUIrHnFCR8BcgR_PsqTBn5nH7aCp16zgmkkbO" +
    "pmJXlNpDSVz9zUY4NOrB1jTzDB190COrfCXddb7JO6fmpet9_Zd3kInJx4XsT3x7JfBSWr9FBqFoUmNkgIWjkbN1TpwMyizXA" +
    "Sp1nOmwJ64FDIbSpfpgUAqfSWXKZYhSisfnBLEyHCjMSPzVmDh949w-W1wU9q5nGFtrx6PTOxK_WKOiWU8_oeTjL0pD8pKXqJ" +
    "MaLW-OIzfrl3kzQNuF80YT-nxmNtp5PrcxehprlPmqSB_dyTHccsO3l63d8y9hiIzfRUgUjTJbktFn5t41ADARMs_0WMpIGZJ" +
    "yxcVssstt4J1Gj8WUFOdqPsIKigJZMn3yshC5S-KY-7S0dVd0VXgvpPqmpb9Q9Uho"

const assert = require('assert');
describe('verify-probe-connected', function () {
    it('should return true', function () {
        const axios = require('axios').default;
        const bearerToken = 'Bearer ' + SYSTEM_JWT_TOKEN;
        const url = 'http://localhost:12800/stats';
        return axios.get(url, {
            headers: {
                Authorization: bearerToken
            }
        }).then(function (response) {
            assert.equal(response.status, 200);
        }).catch(function (error) {
            assert.equal(error.response.status, 401);
        });
    });
});
