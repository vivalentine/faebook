const { createHash, timingSafeEqual } = require("node:crypto");

const SECRET_KEYS = Object.freeze({
  lumi_faeo3: "LUMI_FAEO3_PASSWORD",
  lumi_pixie: "LUMI_PIXIE_PASSWORD",
});
const SECRET_ACCOUNTS = Object.freeze({
  lumi_faeo3: { username: "xX_LumiLuvsYuri_Xx", password: "crackship" },
  lumi_pixie: { username: "xX_LumiLuvsYuri_Xx", password: "donotpost" },
});

const faeo3Works = [];
const pixieWorks = [];

function isSecretKey(value) { return Object.prototype.hasOwnProperty.call(SECRET_KEYS, value); }
function configuredPassword(secretKey) { return process.env[SECRET_KEYS[secretKey]] || SECRET_ACCOUNTS[secretKey]?.password || ""; }
function expectedUsername(secretKey) { return SECRET_ACCOUNTS[secretKey]?.username || ""; }
function credentialsMatch(secretKey, usernameValue, passwordValue) {
  const username = String(usernameValue || "").trim().toLowerCase();
  const expected = expectedUsername(secretKey).trim().toLowerCase();
  const supplied = String(passwordValue || "");
  const expectedPassword = configuredPassword(secretKey);
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expectedPassword).digest();
  return username === expected
    && Boolean(expectedPassword)
    && supplied.length <= 200
    && timingSafeEqual(suppliedDigest, expectedDigest);
}
function archivePayload(secretKey) {
  return secretKey === "lumi_faeo3" ? { works: faeo3Works } : { works: pixieWorks };
}
module.exports = { SECRET_KEYS, isSecretKey, configuredPassword, expectedUsername, credentialsMatch, archivePayload };
