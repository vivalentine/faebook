const test = require("node:test");
const assert = require("node:assert/strict");
const { configuredPassword, expectedUsername, isSecretKey } = require("../secret-archives");

test("secret discovery accounts have their documented credentials", () => {
  assert.equal(expectedUsername("lumi_faeo3"), "faeo3");
  assert.equal(configuredPassword("lumi_faeo3"), process.env.LUMI_FAEO3_PASSWORD || "crackship");
  assert.equal(expectedUsername("lumi_pixie"), "pixie");
  assert.equal(configuredPassword("lumi_pixie"), process.env.LUMI_PIXIE_PASSWORD || "donotpost");
  assert.equal(isSecretKey("not-a-secret"), false);
});
