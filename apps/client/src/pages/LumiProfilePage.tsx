import { useEffect, useState, type ReactNode } from "react";
import NpcPortrait from "../components/NpcPortrait";
<<<<<<< HEAD
import LumiSticker from "../features/lumi/LumiSticker";
import { LUMI_POST_ASSETS } from "../features/lumi/lumiAssets";
import { apiFetch } from "../lib/api";
import type { Npc } from "../types";

const topEight = [
  { label: "Lyra Glimmerthirst", src: "/lumi/top-8/lyra_top8.webp" },
  { label: "Aoife Gealach", src: "/lumi/top-8/aoife_top8.webp" },
  { label: "Usaq", src: "/lumi/top-8/usaq_top8.webp" },
  { label: "Rin Tatari", src: "/lumi/top-8/rin_top8.webp" },
  { label: "Mimi Xiao", src: "/lumi/top-8/mimi_top8.webp" },
  { label: "Terry", src: "/lumi/top-8/terry_top8.webp" },
  { label: "Hilton", src: "/lumi/top-8/hilton_top8.webp" },
  { label: "Lirael Moonthorn", src: "/lumi/top-8/lirael_top8.webp" },
] as const;

function TopEightPortrait({ label, src }: { label: string; src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="lumi-top-eight-media">
      {!failed ? (
        <img
          src={src}
          alt={label}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="lumi-broken-portrait"
          role="img"
          aria-label={`${label} image unavailable`}
        >
          <span>▧ ×</span>
          <small>{label}</small>
        </div>
      )}
    </div>
  );
}
=======
import { apiFetch, apiUrl } from "../lib/api";
import type { Npc } from "../types";

const topEightNames = [
  "Lyra Glimmerthirst",
  "Aoife Gealach",
  "Rin",
  "Mimi",
  "Usaq",
  "Terry",
  "Hilton",
  "Sable",
];
>>>>>>> origin/main

type PostProps = {
  children: ReactNode;
  className?: string;
  tags: string[];
<<<<<<< HEAD
  posted:
    | "posted 3:14 AM"
    | "posted 1:07 AM"
    | "posted 4:42 AM"
    | "posted 12:31 AM"
    | "posted 2:18 AM";
=======
  posted: "posted 3:14 AM" | "posted 1:07 AM" | "posted 4:42 AM" | "posted 12:31 AM" | "posted 2:18 AM";
>>>>>>> origin/main
  edited?: "edited 3:16 AM" | "edited again 3:19 AM" | "last edited 4:51 AM";
  notes: "7 notes" | "17 notes" | "23 notes" | "42 notes" | "69 notes";
};

<<<<<<< HEAD
function BlogPost({
  children,
  className = "",
  tags,
  posted,
  edited,
  notes,
}: PostProps) {
  return (
    <article className={`lumi-post ${className}`.trim()}>
      {children}
      <div className="lumi-tags">
        {tags.map((tag) => (
          <span
            className={tag === "#GET DOWN FROM THERE" ? "lumi-loud-tag" : ""}
            key={tag}
          >
            {tag}
          </span>
        ))}
      </div>
      <footer className="lumi-post-meta">
        <span>{posted}</span>
        {edited && <span>{edited}</span>}
        <span>{notes}</span>
      </footer>
    </article>
  );
=======
function BlogPost({ children, className = "", tags, posted, edited, notes }: PostProps) {
  return <article className={`lumi-post ${className}`.trim()}>
    {children}
    <div className="lumi-tags">{tags.map((tag) => <span className={tag === "#GET DOWN FROM THERE" ? "lumi-loud-tag" : ""} key={tag}>{tag}</span>)}</div>
    <footer className="lumi-post-meta"><span>{posted}</span>{edited && <span>{edited}</span>}<span>{notes}</span></footer>
  </article>;
>>>>>>> origin/main
}

export default function LumiProfilePage() {
  const [npc, setNpc] = useState<Npc | null>(null);
<<<<<<< HEAD
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/npcs/lumi-turnleaf")
      .then(async (lumiResponse) => {
        if (!lumiResponse.ok)
          throw new Error(`Failed to load NPC: ${lumiResponse.status}`);
        setNpc(await lumiResponse.json());
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Failed to load NPC.",
        ),
      );
  }, []);

  if (error)
    return (
      <div className="app-shell">
        <div className="state-card error-card">
          <p>{error}</p>
        </div>
      </div>
    );
  if (!npc)
    return (
      <div className="app-shell">
        <div className="state-card">
          <p>Loading NPC page...</p>
        </div>
      </div>
    );

  return (
    <div className="app-shell lumi-page-shell">
      <main className="lumi-profile">
        <header className="lumi-masthead">
          <LumiSticker
            sticker="big-pink-heart"
            size={42}
            rotate={-9}
            className="lumi-masthead-sticker lumi-masthead-heart"
          />
          <LumiSticker
            sticker="cyan-sparkle"
            size={34}
            rotate={8}
            animated
            duration={0.8}
            className="lumi-masthead-sticker lumi-masthead-sparkle"
          />
          <LumiSticker
            sticker="black-star"
            size={26}
            rotate={-6}
            animated
            duration={1.4}
            className="lumi-masthead-sticker lumi-masthead-star"
          />
          <h1>~*~ LUMI TURNLEAF IS VERY NORMAL ~*~</h1>
          <p className="lumi-subtitle">yes i changed the css. no you can't.</p>
          <div className="lumi-system">
            <span>profile permissions: don't worry about it</span>
            <span>last updated: whenever i wanted</span>
          </div>
        </header>

        <div
          className="lumi-marquee"
          aria-label="welcome 2 my page ★ behave badly but interestingly"
        >
          <span>welcome 2 my page ★ please behave badly</span>
        </div>
        <div className="lumi-glitter-divider" aria-hidden="true">
          <span>★</span> ✦ <span>♥</span> ✦ <span>★</span>
        </div>

        <div className="lumi-layout">
          <aside className="lumi-sidebar" aria-label="Lumi's profile sidebar">
            <section className="lumi-profile-card">
              <LumiSticker
                sticker="purple-heart"
                size={30}
                rotate={7}
                className="lumi-profile-sticker lumi-profile-heart"
              />
              <div className="lumi-portrait">
                <NpcPortrait npc={npc} variant="detail" />
              </div>
              <h2>Lumi Turnleaf</h2>
              <p className="lumi-handle">@lumi_turnleaf</p>
              <p className="lumi-online">● online probably</p>
              <p>
                hi!!!! i'm lumi. i write things and draw things and know things i
                probably shouldn't. don't judge my tastes. i have mommy issues.
              </p>
            </section>

            <section className="lumi-widget lumi-now-playing">
              <LumiSticker
                sticker="kazoo"
                size={42}
                rotate={6}
                className="lumi-widget-sticker lumi-now-kazoo"
              />
              <LumiSticker
                sticker="cyan-sparkle"
                size={24}
                rotate={8}
                animated
                duration={1.1}
                className="lumi-widget-sticker lumi-now-sparkle"
              />
              <h2>NOW PLAYING</h2>
              <strong>Lyra Glimmerthirst</strong>
              <p>volume: irresponsible</p>
              <p>repeat: obviously</p>
            </section>
            <section className="lumi-widget lumi-mood">
              <LumiSticker
                sticker="big-pink-heart"
                size={36}
                rotate={5}
                className="lumi-widget-sticker lumi-mood-face"
              />
              <h2>MOOD</h2>
              <p>(✿ ♥‿♥) experiencing art normally</p>
            </section>
            <section className="lumi-widget">
              <h2>CURRENTLY</h2>
              <p>currently obsessed with: Lyra Glimmerthirst</p>
              <p>currently writing: NONE OF YOUR BUSINESS</p>
              <p>currently drawing: ALSO NONE OF YOUR BUSINESS</p>
            </section>
            <section className="lumi-widget lumi-art-folder">
              <h2>CURRENT ART FOLDER</h2>
              <code>~/art/donotpost/</code>
              <small>seriously.</small>
            </section>
            <p className="lumi-elsewhere">
              find me elsewhere: xX_LumiLuvsYuri_Xx
            </p>
            <section className="lumi-widget lumi-top-eight">
              <LumiSticker
                sticker="pink-flower"
                size={28}
                rotate={-9}
                className="lumi-widget-sticker lumi-top-flower"
              />
              <LumiSticker
                sticker="black-star"
                size={24}
                rotate={7}
                animated
                duration={1.4}
                className="lumi-widget-sticker lumi-top-star"
              />
              <h2>TOP 8</h2>
              <ol>
                {topEight.map((entry) => (
                  <li key={entry.label}>
                    <TopEightPortrait label={entry.label} src={entry.src} />
                    <span>{entry.label}</span>
                  </li>
                ))}
              </ol>
              <p>
                ranking is legally nonbinding and subject to dramatic revision
              </p>
            </section>
          </aside>

          <section className="lumi-main-column" aria-label="Lumi's blog feed">
            <h2 className="sr-only">Lumi's blog feed</h2>
            <BlogPost
              tags={["#fanfic", "#shipping", "#crackship", "#i can explain"]}
              posted="posted 3:14 AM"
              edited="edited again 3:19 AM"
              notes="69 notes"
            >
              <p>
                okay but saying "crackship" at all is so weak. if the chemistry
                works, the chemistry works. i'm just saying.
              </p>
            </BlogPost>

            <BlogPost
              className="lumi-image-post lumi-lyra-post"
              tags={[
                "#lyra glimmerthirst",
                "#divine muse of summer",
                "#normal amount of admiration",
                "#i am looking respectfully",
                "#lying",
              ]}
              posted="posted 1:07 AM"
              edited="last edited 4:51 AM"
              notes="42 notes"
            >
              <LumiSticker
                sticker="big-pink-heart"
                size={46}
                rotate={-8}
                className="lumi-post-sticker lumi-post-sticker-right"
              />
              <LumiSticker
                sticker="cyan-sparkle"
                size={28}
                rotate={7}
                animated
                duration={0.8}
                className="lumi-post-sticker lumi-post-sticker-left"
              />
              <strong className="lumi-repost-label">reposted</strong>
              <p>important cultural preservation work happening on this blog</p>
              <img
                className="lumi-post-media"
                src={LUMI_POST_ASSETS.lyra}
                alt="Fan art of Lyra Glimmerthirst"
                loading="lazy"
              />
              <p className="lumi-image-caption">look at her. LOOK AT HER.</p>
            </BlogPost>

            <BlogPost
              tags={["#usaq", "#bardposting", "#the kazoo has seen things"]}
              posted="posted 4:42 AM"
              notes="17 notes"
            >
              <p>
                usaq owns a kazoo and somehow this has never stopped her
                from being taken seriously as a musician.
              </p>
              <p>incredible and inspirational tbh.</p>
            </BlogPost>
            <BlogPost
              className="lumi-hilton-post"
              tags={["#hilton", "#GET DOWN FROM THERE", "#you have legs"]}
              posted="posted 12:31 AM"
              notes="23 notes"
            >
              <p>
                every time hilton starts flying again an angel loses its
                patience
              </p>
            </BlogPost>
            <BlogPost
              tags={[
                "#terry",
                "#tactical genius",
                "#give him the antler",
                "#fly king",
              ]}
              posted="posted 2:18 AM"
              edited="edited 3:16 AM"
              notes="7 notes"
            >
              <p>
                watching the party squander terry's abilities drives me a lil crazy sometimes
              </p>
              <p>justice for terry</p>
            </BlogPost>

            <BlogPost
              className="lumi-image-post"
              tags={[
                "#rin",
                "#mimi",
                "#yuri goggles permanently installed",
                "#research",
              ]}
              posted="posted 3:14 AM"
              notes="17 notes"
            >
              <LumiSticker
                sticker="purple-heart"
                size={34}
                rotate={7}
                className="lumi-post-sticker lumi-post-sticker-right"
              />
              <LumiSticker
                sticker="heart-bubble"
                size={38}
                rotate={-6}
                className="lumi-post-sticker lumi-post-sticker-left"
              />
              <strong className="lumi-repost-label">reposted</strong>
              <img
                className="lumi-post-media"
                src={LUMI_POST_ASSETS.rinAndMimi}
                alt="Fan art of Rin and Mimi together"
                loading="lazy"
              />
              <p className="lumi-image-caption">
                girls can literally just sit next to each other and suddenly i
                have seventeen tabs open
              </p>
            </BlogPost>

            <BlogPost
              className="lumi-reaction-post"
              tags={[
                "#aoife gealach",
                "#summer court",
                "#girlboss derogatory",
                "#girlboss affectionate",
              ]}
              posted="posted 1:07 AM"
              notes="42 notes"
            >
              <img
                className="lumi-post-media"
                src={LUMI_POST_ASSETS.aoife}
                alt="Fan art of Aoife Gealach"
                loading="lazy"
              />
              <p>
                aoife has the energy of someone who would kick open the door to
                her own coronation fifteen minutes late
              </p>
              <p>this is a compliment.</p>
            </BlogPost>
            <BlogPost
              className="lumi-image-post"
              tags={[]}
              posted="posted 3:14 AM"
              notes="17 notes"
            >
              <LumiSticker
                sticker="question"
                size={34}
                rotate={-6}
                className="lumi-post-sticker lumi-post-sticker-right"
              />
              <img
                className="lumi-post-media"
                src={LUMI_POST_ASSETS.thalanorAndPip}
                alt="Fan art of Thalanor and Pip"
                loading="lazy"
              />
            </BlogPost>
            <BlogPost
              className="lumi-image-post"
              tags={[]}
              posted="posted 1:07 AM"
              notes="42 notes"
            >
              <LumiSticker
                sticker="angry"
                size={38}
                rotate={7}
                className="lumi-post-sticker lumi-post-sticker-right"
              />
              <img
                className="lumi-post-media"
                src={LUMI_POST_ASSETS.titaniaAndWinterQueen}
                alt="Human alternate-universe fan art of Titania and the Winter Queen"
                loading="lazy"
              />
            </BlogPost>
            <BlogPost
              className="lumi-ask-post"
              tags={["#asks", "#faebook", "#skill issue"]}
              posted="posted 4:42 AM"
              notes="23 notes"
            >
              <div className="lumi-question">
                <strong>anonymous asked:</strong>
                <p>why do you have access to the production stylesheet</p>
              </div>
              <p className="lumi-answer">
                because nobody stopped me early enough
              </p>
            </BlogPost>
            <BlogPost
              className="lumi-personal-post"
              tags={["#personal", "#don't worry about it"]}
              posted="posted 12:31 AM"
              notes="7 notes"
            >
              <p>
                sometimes you learn things about your family and think "wow this
                explains a lot"
              </p>
              <p>and then unfortunately it explains WAY too much</p>
            </BlogPost>
            <BlogPost
              className="lumi-chain-post"
              tags={["#reblog bait", "#100% real curse", "#probably"]}
              posted="posted 2:18 AM"
              notes="69 notes"
            >
              <h2>REPOST IF U SUPPORT WOMEN'S WRONGS</h2>
              <p>
                nothing better than beautiful women doing the
                worst things you can imagine
              </p>
            </BlogPost>
          </section>
        </div>
      </main>
    </div>
  );
=======
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/api/npcs/lumi-turnleaf"), apiFetch("/api/npcs")])
      .then(async ([lumiResponse, npcsResponse]) => {
        if (!lumiResponse.ok) throw new Error(`Failed to load NPC: ${lumiResponse.status}`);
        setNpc(await lumiResponse.json());
        if (npcsResponse.ok) setNpcs(await npcsResponse.json());
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Failed to load NPC."));
  }, []);

  if (error) return <div className="app-shell"><div className="state-card error-card"><p>{error}</p></div></div>;
  if (!npc) return <div className="app-shell"><div className="state-card"><p>Loading NPC page...</p></div></div>;

  const findNpc = (name: string) => npcs.find((entry) => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  const lyra = findNpc("Lyra Glimmerthirst");
  const rin = findNpc("Rin");
  const mimi = findNpc("Mimi");

  return <div className="app-shell lumi-page-shell">
    <main className="lumi-profile">
      <header className="lumi-masthead">
        <h1>~*~ LUMI TURNLEAF'S EXTREMELY NORMAL FAEBOOK PAGE ~*~</h1>
        <p className="lumi-subtitle">yes i changed the css. no you can't.</p>
        <div className="lumi-system"><span>profile permissions: don't worry about it</span><span>last updated: whenever i wanted</span></div>
      </header>

      <div className="lumi-marquee" aria-label="welcome 2 my page ★ behave badly but interestingly"><span>welcome 2 my page ★ behave badly but interestingly</span></div>

      <div className="lumi-layout">
        <aside className="lumi-sidebar" aria-label="Lumi's profile sidebar">
          <section className="lumi-profile-card">
            <div className="lumi-portrait"><NpcPortrait npc={npc} variant="detail" /></div>
            <h2>Lumi Turnleaf</h2>
            <p className="lumi-handle">@lumi_turnleaf</p>
            <p className="lumi-online">● online probably</p>
            <p>hi!!!! i'm lumi. i write things, draw things, know things i probably shouldn't, and have been informed that "editing the production stylesheet for fun" is not an acceptable hobby. rude.</p>
          </section>

          <section className="lumi-widget lumi-now-playing">
            <h2>NOW PLAYING</h2><strong>Lyra Glimmerthirst</strong><p>volume: irresponsible</p><p>repeat: obviously</p>
          </section>
          <section className="lumi-widget lumi-mood"><h2>MOOD</h2><p>(✿ ♥‿♥) experiencing art normally</p></section>
          <section className="lumi-widget">
            <h2>CURRENTLY</h2>
            <p>currently obsessed with: Lyra Glimmerthirst</p>
            <p>currently writing: NONE OF YOUR BUSINESS</p>
            <p>currently drawing: ALSO NONE OF YOUR BUSINESS</p>
          </section>
          <section className="lumi-widget lumi-art-folder">
            <h2>CURRENT ART FOLDER</h2><code>~/art/DO_NOT_POST/</code><small>seriously.</small>
          </section>
          <p className="lumi-elsewhere">find me elsewhere: xX_LumiLuvsYuri_Xx</p>
          <section className="lumi-widget lumi-top-eight">
            <h2>TOP 8</h2>
            <ol>{topEightNames.map((name) => {
              const friend = findNpc(name);
              return <li key={name}>{friend?.portrait_path && <img src={apiUrl(friend.portrait_path)} alt={name} />}<span>{name}</span></li>;
            })}</ol>
            <p>ranking is legally nonbinding and subject to dramatic revision</p>
          </section>
        </aside>

        <section className="lumi-main-column" aria-label="Lumi's blog feed">
          <h2 className="sr-only">Lumi's blog feed</h2>
          <BlogPost tags={["#fanfic", "#shipping", "#crackship", "#i can explain"]} posted="posted 3:14 AM" edited="edited again 3:19 AM" notes="69 notes">
            <p>okay but "crack ship" is a coward's phrase. if the chemistry works, the chemistry works. i'm just saying.</p>
          </BlogPost>

          {lyra?.portrait_path && <BlogPost className="lumi-image-post lumi-lyra-post" tags={["#lyra glimmerthirst", "#divine muse of summer", "#normal amount of admiration", "#i am looking respectfully", "#lying"]} posted="posted 1:07 AM" edited="last edited 4:51 AM" notes="42 notes">
            <strong className="lumi-repost-label">reposted</strong><p>important cultural preservation work happening on this blog</p>
            <img src={apiUrl(lyra.portrait_path)} alt="Lyra Glimmerthirst" /><p className="lumi-image-caption">look at her. LOOK AT HER.</p>
          </BlogPost>}

          <BlogPost tags={["#usaq", "#bardposting", "#the kazoo has seen things"]} posted="posted 4:42 AM" notes="17 notes">
            <p>usaq owns a kazoo and somehow this has never once stopped him from being taken seriously as a musician.</p><p>incredible. inspirational. devastating for the rest of us.</p>
          </BlogPost>
          <BlogPost className="lumi-hilton-post" tags={["#hilton", "#GET DOWN FROM THERE", "#you have legs"]} posted="posted 12:31 AM" notes="23 notes">
            <p>every time hilton starts flying again an angel loses its patience</p>
          </BlogPost>
          <BlogPost tags={["#terry", "#tactical genius", "#debatable", "#fly behavior"]} posted="posted 2:18 AM" edited="edited 3:16 AM" notes="7 notes">
            <p>watching terry solve problems is like watching someone shake a locked door for ten minutes and then turn into a fly</p><p>and the worst part is sometimes this works</p>
          </BlogPost>

          {rin?.portrait_path && mimi?.portrait_path && <BlogPost className="lumi-image-post" tags={["#rin", "#mimi", "#yuri goggles permanently installed", "#research"]} posted="posted 3:14 AM" notes="17 notes">
            <strong className="lumi-repost-label">reposted</strong><div className="lumi-paired-art"><img src={apiUrl(rin.portrait_path)} alt="Rin" /><img src={apiUrl(mimi.portrait_path)} alt="Mimi" /></div>
            <p className="lumi-image-caption">girls can literally just stand next to each other and suddenly i have seventeen tabs open</p>
          </BlogPost>}

          <BlogPost tags={["#aoife gealach", "#summer court", "#girlboss derogatory affectionate"]} posted="posted 1:07 AM" notes="42 notes">
            <p>aoife has the energy of someone who would kick open the door to her own coronation fifteen minutes late with blood on her shirt and immediately ask who wants a drink</p><p>this is a compliment.</p>
          </BlogPost>
          <BlogPost className="lumi-ask-post" tags={["#asks", "#faebook", "#skill issue"]} posted="posted 4:42 AM" notes="23 notes">
            <div className="lumi-question"><strong>anonymous asked:</strong><p>why do you have access to the production stylesheet</p></div><p className="lumi-answer">because nobody stopped me early enough</p>
          </BlogPost>
          <BlogPost className="lumi-personal-post" tags={["#personal", "#don't worry about it"]} posted="posted 12:31 AM" notes="7 notes">
            <p>sometimes you learn things about your family and think "wow this explains a lot"</p><p>and then unfortunately it explains WAY too much</p>
          </BlogPost>
          <BlogPost className="lumi-chain-post" tags={["#reblog bait", "#100% real curse", "#probably"]} posted="posted 2:18 AM" notes="69 notes">
            <h2>REPOST IF U SUPPORT WOMEN'S WRONGS</h2><p>ignore for 7 petals and a beautiful woman will make an extremely questionable decision in your vicinity</p>
          </BlogPost>
        </section>
      </div>
    </main>
  </div>;
>>>>>>> origin/main
}
