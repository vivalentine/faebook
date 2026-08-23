const { createHash, timingSafeEqual } = require("node:crypto");

const SECRET_KEYS = Object.freeze({
  lumi_faeo3: "LUMI_FAEO3_PASSWORD",
});
const SECRET_ACCOUNTS = Object.freeze({
  lumi_faeo3: { username: "xX_LumiLuvsYuri_Xx", password: "crackship" },
});

const faeo3Works = [];

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
function archivePayload() {
  return { works: faeo3Works };
}
module.exports = { SECRET_KEYS, isSecretKey, configuredPassword, expectedUsername, credentialsMatch, archivePayload };
