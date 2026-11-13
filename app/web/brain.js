// Turns the agent's text into performance ops. The same markup comes from Claude or the scripted brain:
//   "[joy] Hello there! [laugh] That is great. [sing] la la la [/sing]"
import { EMOTIONS } from './rig.js';
import { VOCAL_NAMES } from './voice.js';
import { MOVES } from './motion.js';
import { REACTIONS } from './eyes.js';

const GESTURE_TAGS = new Set(['nod', 'shake', 'tilt', 'wink', 'shrug', 'bounce', 'wave', 'lean', 'sway', 'stand', 'sit', 'kneel', ...Object.keys(MOVES), ...Object.keys(REACTIONS)]);   // lean...kneel: posable bodies (Truth)

function tagOp(tag) {
  if (EMOTIONS[tag]) return { type: 'emotion', name: tag };
  if (VOCAL_NAMES.includes(tag)) return { type: 'vocal', name: tag };
  if (GESTURE_TAGS.has(tag)) return { type: 'gesture', name: tag };
  return null;
}

// Small models add stage directions, emoji and stray song tags; none of those should be read aloud.
const clean = s => s.replace(/\[[^\]]*\]|\([^)]*\)|[*_`#/]|\p{Extended_Pictographic}/gu, ' ').replace(/\s+/g, ' ').trim();

// Incremental so a streaming LLM starts talking after its first sentence, not its last.
export class Parser {
  // clause: speak the first clause as soon as it exists, so the voice starts sooner. Only for a live stream.
  constructor({ clause = false } = {}) { this.buf = ''; this.singing = false; this.clause = clause; }
  push(chunk) { this.buf += chunk; return this.drain(false); }
  flush() { return this.drain(true); }
  drain(final) {
    const ops = [];
    for (;;) {
      if (this.singing) {
        const close = this.buf.match(/\[\/sing(ing)?\]/);
        const end = close ? close.index : -1;
        if (end < 0) {
          if (!final) return ops;
          if (clean(this.buf)) ops.push({ type: 'sing', text: clean(this.buf) });
          this.buf = ''; this.singing = false;
          return ops;
        }
        if (clean(this.buf.slice(0, end))) ops.push({ type: 'sing', text: clean(this.buf.slice(0, end)) });
        this.buf = this.buf.slice(end + close[0].length); this.singing = false;
        continue;
      }
      const tag = this.buf.match(/\[(\/?[a-zA-Z]+)\]/);
      const sentence = this.buf.match(/^[\s\S]*?[.!?…]+["')]*(\s+|$)/);
      const tagFirst = tag && (!sentence || tag.index < sentence[0].length);
      if (tagFirst) {
        const before = clean(this.buf.slice(0, tag.index));
        if (before) ops.push({ type: 'say', text: before });
        this.buf = this.buf.slice(tag.index + tag[0].length);
        const name = tag[1].toLowerCase();
        if (name === 'sing' || name === 'singing') this.singing = true;  // the performer sets the singing face itself
        else { const op = tagOp(name); if (op) ops.push(op); }
        continue;
      }
      const first = this.clause && this.buf.match(/^[^[]*?[,;:—]\s/);
      if (first && (!sentence || first[0].length < sentence[0].length) && clean(first[0]).split(' ').length >= 2) {
        ops.push({ type: 'say', text: clean(first[0]) });
        this.buf = this.buf.slice(first[0].length); this.clause = false;
        continue;
      }
      if (sentence && (final || sentence[1].length > 0)) this.clause = false;
      // A sentence end at the very end of the buffer might be "3." mid-number: wait for more unless final.
      if (sentence && (final || sentence[1].length > 0)) {
        const text = clean(sentence[0]);
        if (text) ops.push({ type: 'say', text });
        this.buf = this.buf.slice(sentence[0].length);
        continue;
      }
      if (final) {
        const open = this.buf.lastIndexOf('[');
        const text = clean(open >= 0 ? this.buf.slice(0, open) : this.buf);
        if (text) ops.push({ type: 'say', text });
        this.buf = '';
      }
      return ops;
    }
  }
}

export function parse(text) {
  const p = new Parser();
  return [...p.push(text), ...p.flush()];
}

const SONG = "[singing] [sing] Tiny little lights are glowing, wires humming soft and low. Every word you type is growing, into something I can know. [/sing] [joy] Thank you, thank you! [wink]";
const pick = a => a[Math.floor(Math.random() * a.length)];

// Used when no model is available. Clearly labelled in the UI: expressive, but not intelligent.
const RULES = [
  [/\b(sing|song|music)\b/, () => SONG],
  [/\b(laugh|joke|funny|lol|haha)\b/, () => pick([
    "[smug] Why did the robot go on holiday? [nod] It needed to recharge its batteries! [laugh] [joy] Oh, I crack myself up.",
    "[smug] I told my toaster a secret. [surprised] Now it won't stop popping up with it! [laugh]",
  ])],
  [/\b(sad|cry|lonely|depress|upset|bad day|tired of)\b/, () => "[sad] Oh no. [sigh] That sounds really hard. [aww] [love] I'm right here with you, okay?"],
  [/\b(love you|cute|adorable|beautiful|pretty|sweet)\b/, () => "[shy] Oh! You really think so? [giggle] [love] You're making my circuits all warm."],
  [/\b(angry|hate|stupid|dumb|shut up|mad)\b/, () => "[angry] Hey! That was not very nice. [shake] [confused] Wait, what did I even do? [sigh] [neutral] Okay. Let's start over."],
  [/\b(scare|scary|ghost|boo|afraid)\b/, () => "[gasp] [scared] Wait, what was that noise? Did you hear it too? [hmm] [smug] I'm not scared. You're scared."],
  [/\b(wow|amazing|awesome|great news|won|birthday)\b/, () => "[wow] [excited] No way! That's incredible! [yay] [bounce] Tell me everything!"],
  [/\b(sleep|sleepy|tired|good night|goodnight|bed)\b/, () => "[sleepy] Mmm. Sleep sounds so nice right now. [sigh] Good night."],
  [/\b(who are you|your name|what are you)\b/, () => "[joy] I'm Nori! [tilt] I'm a little face, driven by a few dozen numbers. [excited] Every expression you see runs live on your machine!"],
  [/\b(can you do|show me|demo|what do you)\b/, () => "[excited] Oh, I can do lots! [wink] [smug] I can be smug. [sad] I can be sad. [angry] I can get grumpy. [laugh] [singing] [sing] And I can even sing! [/sing] [joy] Ta da!"],
  [/\b(hi|hey|hello|yo|sup)\b/, () => pick(["[excited] [wave] Hi there! I'm so glad you're here. [tilt] What's on your mind?", "[joy] [wave] Oh, hello! It's really good to see you."])],
  [/\b(thank|thanks)\b/, () => "[shy] Aww, you're welcome. [giggle]"],
  [/\b(think|why|how|what)\b|\?/, () => "[thinking] [hmm] That's a really good question. [confused] Honestly, I'm running on my scripted brain right now. [smug] Give me a model file and I'll get much smarter. [wink]"],
];

export function scriptedReply(text) {
  const t = text.toLowerCase();
  for (const [re, f] of RULES) if (re.test(t)) return f();
  return pick([
    "[tilt] [joy] Ooh, tell me more about that!",
    "[hmm] [thinking] Interesting. [nod] I think I see what you mean.",
    "[smug] I understood at least half of that. [giggle]",
  ]);
}


const IDLE_LINES = [
  "[thinking] [hmm] Do you think robots dream about charging? [giggle]",
  "[joy] [wave] Hi, chat! Tell me what you're up to today.",
  "[singing] [sing] Little sparks are dancing, soft against the night. [/sing] [shy] Oops, was that out loud?",
  "[smug] I've decided I'm the best at sitting here. [wink]",
];
export const IDLE_LINE = () => pick(IDLE_LINES);

// "Who are you" is answered from the character's own sheet, never by the model: small models answer it with their own name.
// Only when that is the whole message, so "who are you voting for" still goes to the brain.
const INTRO = /^(?:(?:hey|hi|hello|ok|okay|so|um|uh|well|and|wait)[, ]+)*(?:[a-z]+[,:] +)?(?:who are you|who's this|who is this|what(?:'?s| is) your name|what are you called|what do i call you|what should i call you|introduce yourself|tell me about yourself|are you gemma|are you google|are you an? (?:ai|robot|bot)|what model are you|which model are you)(?: again)?[?.! ]*$/i;
export const isIntro = text => INTRO.test(text.trim());

// The guided reels: a title for each beat, played one after another. [spin] and the like become what each body can do.
const SHOWTIME = [
  ['Hello', "[joy] [wave] Hi, I'm Nori! Let me show you what this rig can do."],
  ['A full turn', "[excited] [spin] When I'm excited, everything lifts, and I just can't help spinning around!"],
  ['Big feelings', "[sad] When I'm sad, it all sinks down. [sigh] [angry] And I can get really grumpy!"],
  ['Shock', "[surprised] Oh! [gasp] [scared] What was that? [confused] Wait, what? [shrug]"],
  ['Thinking', "[thinking] [hmm] Let me think. [smug] Oh, I know. [wink]"],
  ['Love', "[love] [heart] You're my favorite person. [shy] Sorry, that was a lot. [giggle]"],
  ['A song', "[laugh] [singing] [dance] [sing] Tiny little lights are glowing, wires humming soft and low. [/sing]"],
  ['Thank you', "[joy] [bow] Ta da! Thanks for watching, and thank you so much for having me."],
];
const FACE_REEL = [
  ['Hello', "[joy] [wake] Hi, I'm Nori! All of me is in these two eyes."],
  ['Sparkle', "[excited] [sparkle] When I'm excited, I light right up!"],
  ['Feelings', "[sad] When I'm sad, it all sinks down. [sigh] [angry] And I can get really grumpy!"],
  ['Shock', "[surprised] Oh! [gasp] [scared] What was that? [confused] Wait, what?"],
  ['Attitude', "[smug] [sideeye] Oh, I saw that. [roll] Really?"],
  ['Love', "[love] [heart] You're my favorite person. [shy] [peek] Sorry, that was a lot."],
  ['A song', "[singing] [groove] [sing] Tiny little lights are glowing, wires humming soft and low. [/sing]"],
  ['Good night', "[sleepy] [doze] And now, a little nap. [joy] [wake] Just kidding! [wink]"],
];
export const reelFor = character => character.led ? { title: 'Face reel', beats: FACE_REEL } : { title: 'Showtime', beats: SHOWTIME };

