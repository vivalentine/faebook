const SECRET_KEYS = Object.freeze({
  lumi_faeo3: "LUMI_FAEO3_PASSWORD",
  lumi_pixie: "LUMI_PIXIE_PASSWORD",
});
const SECRET_ACCOUNTS = Object.freeze({
  lumi_faeo3: { username: "faeO3", password: "crackship" },
  lumi_pixie: { username: "pixie", password: "donotpost" },
});

const faeo3Works = [];
const pixieWorks = [];

function isSecretKey(value) { return Object.prototype.hasOwnProperty.call(SECRET_KEYS, value); }
function configuredPassword(secretKey) { return process.env[SECRET_KEYS[secretKey]] || SECRET_ACCOUNTS[secretKey]?.password || ""; }
function expectedUsername(secretKey) { return SECRET_ACCOUNTS[secretKey]?.username || ""; }
function archivePayload(secretKey) {
  return secretKey === "lumi_faeo3" ? { works: faeo3Works } : { works: pixieWorks };
}
module.exports = { SECRET_KEYS, isSecretKey, configuredPassword, expectedUsername, archivePayload };
