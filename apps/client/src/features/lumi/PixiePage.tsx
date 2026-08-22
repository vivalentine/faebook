import { useState, type ReactNode } from "react";
import LumiSticker from "./LumiSticker";
import type { LumiStickerName } from "./lumiStickers";
import SecretLoginForm from "./SecretLoginForm";
import { PIXIE_LOGIN_BACKGROUNDS, PIXIE_POST_IMAGES } from "./lumiAssets";

type PixiePostProps = { children: ReactNode; tags?: string[]; sticker?: LumiStickerName; stickerSide?: "left" | "right" };
function PixiePost({ children, tags = [], sticker, stickerSide = "right" }: PixiePostProps) {
  return <article className="pixie-feed-post">{sticker && <LumiSticker sticker={sticker} size={52} rotate={stickerSide === "right" ? 7 : -7} className={`pixie-post-sticker pixie-post-sticker-${stickerSide}`} />}{children}{tags.length > 0 && <div className="pixie-feed-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}</article>;
}

function Feed() {
  return <main className="secret-site-page pixie-site"><header className="pixie-feed-header"><div className="pixie-profile-mark"><strong>pixie</strong><LumiSticker sticker="moth" size={54} rotate={-5} /><LumiSticker sticker="cyan-sparkle" size={28} rotate={8} /></div><span>@xX_LumiLuvsYuri_Xx</span></header><div className="pixie-feed">
    <PixiePost tags={["#fanfic", "#shipping", "#crackship", "#i can explain"]}><p>okay but "crack ship" is a coward's phrase. if the chemistry works, the chemistry works. i'm just saying.</p></PixiePost>
    <PixiePost sticker="big-pink-heart" tags={["#lyra glimmerthirst", "#divine muse of summer", "#normal amount of admiration", "#i am looking respectfully", "#lying"]}><strong className="pixie-repost-label">reposted <LumiSticker sticker="pink-arrow" size={27} rotate={-5} /></strong><p>important cultural preservation work happening on this blog</p><img src={PIXIE_POST_IMAGES.lyra} alt="Fan art of Lyra Glimmerthirst" /><p>look at her. LOOK AT HER.</p></PixiePost>
    <PixiePost sticker="kazoo" tags={["#usaq", "#bardposting", "#the kazoo has seen things"]}><p>usaq owns a kazoo and somehow this has never once stopped him from being taken seriously as a musician.</p><p>incredible. inspirational. devastating for the rest of us.</p></PixiePost>
    <PixiePost tags={["#hilton", "#GET DOWN FROM THERE", "#you have legs"]}><p>every time hilton starts flying again an angel loses its patience</p></PixiePost>
    <PixiePost tags={["#terry", "#tactical genius", "#debatable", "#fly behavior"]}><p>watching terry solve problems is like watching someone shake a locked door for ten minutes and then turn into a fly</p><p>and the worst part is sometimes this works</p></PixiePost>
    <PixiePost sticker="purple-heart" stickerSide="left" tags={["#rin", "#mimi", "#yuri goggles permanently installed", "#research"]}><strong className="pixie-repost-label">reposted <LumiSticker sticker="cyan-sparkle" size={24} rotate={6} /></strong><img src={PIXIE_POST_IMAGES.rinAndMimi} alt="Fan art of Rin and Mimi together" loading="lazy" /><p>girls can literally just stand next to each other and suddenly i have seventeen tabs open</p></PixiePost>
    <PixiePost sticker="angry" tags={["#aoife gealach", "#summer court", "#girlboss derogatory affectionate"]}><img src={PIXIE_POST_IMAGES.aoife} alt="Fan art of Aoife Gealach" loading="lazy" /><p>aoife has the energy of someone who would kick open the door to her own coronation fifteen minutes late with blood on her shirt and immediately ask who wants a drink</p><p>this is a compliment.</p></PixiePost>
    <PixiePost sticker="question" stickerSide="left"><img src={PIXIE_POST_IMAGES.thalanorAndPip} alt="Fan art of Thalanor and Pip" loading="lazy" /></PixiePost>
    <PixiePost sticker="angry"><img src={PIXIE_POST_IMAGES.titaniaAndWinterQueen} alt="Human alternate-universe fan art of Titania and the Winter Queen" loading="lazy" /></PixiePost>
    <PixiePost sticker="heart-bubble" tags={["#asks", "#faebook", "#skill issue"]}><div className="pixie-ask"><strong>anonymous asked:</strong><p>why do you have access to the production stylesheet</p></div><p>because nobody stopped me early enough</p></PixiePost>
    <PixiePost tags={["#personal", "#don't worry about it"]}><p>sometimes you learn things about your family and think "wow this explains a lot"</p><p>and then unfortunately it explains WAY too much</p></PixiePost>
    <PixiePost tags={["#reblog bait", "#100% real curse", "#probably"]}><h2>REPOST IF U SUPPORT WOMEN'S WRONGS</h2><p>ignore for 7 petals and a beautiful woman will make an extremely questionable decision in your vicinity</p></PixiePost>
    <footer className="pixie-sticker-footer" aria-label="End of feed"><LumiSticker sticker="ghost" size={46} rotate={-5} /><LumiSticker sticker="big-pink-heart" size={31} rotate={8} /><LumiSticker sticker="cyan-sparkle" size={27} rotate={-7} /></footer>
  </div></main>;
}

export default function PixiePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [background] = useState(() => PIXIE_LOGIN_BACKGROUNDS[Math.floor(Math.random() * PIXIE_LOGIN_BACKGROUNDS.length)]);
  if (unlocked) return <Feed />;
  return <main className="secret-site-page pixie-login-site" style={{ backgroundImage: `linear-gradient(#0005, #0005), url("${background}")` }}><section className="pixie-login-modal"><div className="pixie-login-brand"><div className="pixie-logo">pixie</div><LumiSticker sticker="black-star" size={32} rotate={7} /></div><p className="pixie-tagline">art lives here.</p><h1>Log in to Pixie</h1><SecretLoginForm siteName="pixie" password="donotpost" onUnlock={() => setUnlocked(true)} /></section></main>;
}
