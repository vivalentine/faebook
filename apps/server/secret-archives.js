const SECRET_KEYS = Object.freeze({
  lumi_faeo3: "LUMI_FAEO3_PASSWORD",
  lumi_pixie: "LUMI_PIXIE_PASSWORD",
});

const faeo3Works = [
  {
    id: "48291", slug: "the-moon-kept-her-name", title: "The Moon Kept Her Name",
    summary: "A knight follows a stolen name through three moonlit courts.", rating: "Teen Dewdrops",
    relationships: ["The Knight/The Thorn Witch"], characters: ["The Knight", "The Thorn Witch", "A Very Suspicious Moth"],
    charms: ["yearning", "moon bargains", "enemies to reluctant co-conspirators"], warnings: ["No archive warnings apply"],
    cycle: "Names Borrowed in Moonlight", status: "complete",
    authorNotes: "i wrote this instead of sleeping. the moth is important, obviously.",
    body: "The moon had misplaced her name again.\n\nAt the edge of the briar court, the Knight found it caught on a thorn: three silver syllables trembling like rain. She should have returned them. Instead, she closed her gauntlet around the light.\n\nThe Thorn Witch was waiting beneath the oldest arch. **‘You took your time,’** she said, as though the Knight had not crossed a forest that rearranged itself whenever she blinked.\n\nSome bargains begin with a kiss. The dangerous ones begin with directions.",
    createdAt: "2026-05-03T19:12:00.000Z", updatedAt: "2026-05-09T01:44:00.000Z", sortOrder: 1,
    pixieSlug: "moon-name-study",
  },
  {
    id: "49702", slug: "seven-ways-to-hide-a-crown", title: "Seven Ways to Hide a Crown",
    summary: "Six terrible plans and one that might work.", rating: "Mature Moonlight",
    relationships: ["Princess & Her Catastrophic Decisions"], characters: ["The Briar Princess", "Glasswing"],
    charms: ["unreliable narrator", "court intrigue", "draft", "someone gets stabbed eventually"], warnings: ["Creator chose not to use warnings"],
    status: "draft", authorNotes: "DRAFT. do not perceive the bracketed bit. i mean it.",
    body: "First: beneath the lake, where every drowned promise grows a pearl.\n\nSecond: inside the royal portrait, behind the painted version of her smile.\n\nThird: **[LUMI FIX THIS PART]**\n\nGlasswing knocked the crown from the table with one immaculate paw. Perhaps, the princess thought, there were eight ways.",
    createdAt: "2026-06-14T22:08:00.000Z", updatedAt: "2026-06-15T00:17:00.000Z", sortOrder: 2,
  },
];

const pixieWorks = [
  {
    id: "px-101", slug: "moon-name-study", title: "moon-name costume study", description: "color notes for the thorn-arch scene.",
    type: "illustration", tags: ["original", "costume study", "moonlight"], faeo3Slug: "the-moon-kept-her-name",
    images: [{ src: "/api/secrets/lumi_pixie/assets/moon-name-study.svg", alt: "A moonlit figure beneath a thorn arch", caption: "silver ink experiment; the cloak shape finally works" }],
    createdAt: "2026-05-07T20:10:00.000Z", sortOrder: 1,
  },
  {
    id: "px-102", slug: "crown-disaster-panels", title: "crown disaster — rough panels", description: "page blocking. read right to left if you want but i haven't decided yet.",
    type: "panel-draft", tags: ["panel draft", "Glasswing", "rough"], faeo3Slug: "seven-ways-to-hide-a-crown",
    images: [
      { src: "/api/secrets/lumi_pixie/assets/crown-panels-1.svg", alt: "Rough comic page showing a princess and a crown", caption: "page 1 — crown enters, dignity exits" },
      { src: "/api/secrets/lumi_pixie/assets/crown-panels-2.svg", alt: "Rough comic page showing a cat knocking over a crown", caption: "page 2 — Glasswing improves the plan" },
      { src: "/api/secrets/lumi_pixie/assets/crown-panels-3.svg", alt: "Rough comic page with a dramatic reaction", caption: "page 3 — reaction needs more panic" },
    ],
    createdAt: "2026-06-15T00:21:00.000Z", sortOrder: 2,
  },
];

function isSecretKey(value) { return Object.prototype.hasOwnProperty.call(SECRET_KEYS, value); }
function configuredPassword(secretKey) { return process.env[SECRET_KEYS[secretKey]] || ""; }
function archivePayload(secretKey) {
  return secretKey === "lumi_faeo3" ? { works: faeo3Works } : { works: pixieWorks };
}
module.exports = { SECRET_KEYS, isSecretKey, configuredPassword, archivePayload };
