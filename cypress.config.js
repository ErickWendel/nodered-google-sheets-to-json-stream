const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:1880',
    // testIsolation: false,
    supportFile: false,
  },
});
