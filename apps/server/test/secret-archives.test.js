const test = require("node:test");
const assert = require("node:assert/strict");
const { archivePayload, configuredPassword, credentialsMatch, expectedUsername, isSecretKey } = require("../secret-archives");

test("secret discovery accounts have their documented credentials", () => {
  assert.equal(expectedUsername("lumi_faeo3"), "xX_LumiLuvsYuri_Xx");
  assert.equal(configuredPassword("lumi_faeo3"), process.env.LUMI_FAEO3_PASSWORD || "crackship");
  assert.equal(expectedUsername("lumi_pixie"), "xX_LumiLuvsYuri_Xx");
  assert.equal(configuredPassword("lumi_pixie"), process.env.LUMI_PIXIE_PASSWORD || "donotpost");
  assert.equal(isSecretKey("not-a-secret"), false);
});

test("secret credentials accept the shared username case-insensitively", () => {
  assert.equal(credentialsMatch("lumi_faeo3", "xX_LumiLuvsYuri_Xx", process.env.LUMI_FAEO3_PASSWORD || "crackship"), true);
  assert.equal(credentialsMatch("lumi_pixie", "xX_LumiLuvsYuri_Xx", process.env.LUMI_PIXIE_PASSWORD || "donotpost"), true);
  assert.equal(credentialsMatch("lumi_faeo3", "XX_LUMILUVSYURI_XX", process.env.LUMI_FAEO3_PASSWORD || "crackship"), true);
  assert.equal(credentialsMatch("lumi_pixie", "xx_lumiluvsyuri_xx", process.env.LUMI_PIXIE_PASSWORD || "donotpost"), true);
});

test("secret credentials reject wrong usernames and passwords", () => {
  assert.equal(credentialsMatch("lumi_faeo3", "wrong", process.env.LUMI_FAEO3_PASSWORD || "crackship"), false);
  assert.equal(credentialsMatch("lumi_pixie", "wrong", process.env.LUMI_PIXIE_PASSWORD || "donotpost"), false);
  assert.equal(credentialsMatch("lumi_faeo3", "xX_LumiLuvsYuri_Xx", "wrong"), false);
  assert.equal(credentialsMatch("lumi_pixie", "xX_LumiLuvsYuri_Xx", "wrong"), false);
});

test("secret archives remain empty until approved content is supplied", () => {
  assert.deepEqual(archivePayload("lumi_faeo3"), { works: [] });
  assert.deepEqual(archivePayload("lumi_pixie"), { works: [] });
});
