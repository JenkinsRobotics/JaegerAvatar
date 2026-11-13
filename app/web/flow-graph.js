// The node map of Jaeger Avatar as it runs today: what each part is, who owns it, what goes in and out, what is inside
// it, and which traced events travel each wire. Pure data; flow.html draws it (node cards and flow routes after Aether
// UI's look). Every card is the whole part, not a summary: all its inputs on the left, all its outputs on the right.
// owner: 'app' built into this app · 'framework' an imported Jaeger framework · 'external' another program.
// Port types (they colour the wires): audio, text, commands, motion, video. A port no wire touches is fed or read
// from outside the map (the pack, the settings, the keyboard, the loudspeaker). off: the node supports the port, this
// app leaves it unconnected. inside: the parts a node contains ({ id, name, on, note, does }). on: in use with the
// settings the map was last told about (flow.html updates these from the app's snapshot); off: there, not in use now.
import { EMOTIONS, GESTURES } from './rig.js';
import { MOVES } from './motion.js';
import { REACTIONS } from './eyes.js';
export const STAGES = ['mic', 'stt', 'agent', 'perform', 'tts', 'speaker', 'anim', 'control'];   // the stages app.js traces
const p = (id, type, label = id) => ({ id, type, label }), off = (...a) => ({ ...p(...a), off: true });
const part = (id, name, on, note, does, more) => ({ id, name, on, note, does, ...more }), count = o => Object.keys(o).length;
export const NODES = {
  mic: { name: 'Microphone', owner: 'app', where: 'browser · ears.js (AudioWorklet)', at: [0, 0],
    in: [p('sound', 'audio', 'your voice'), p('talking', 'commands', 'she is talking')],
    out: [p('phrase', 'audio'), p('state', 'commands', 'listening · nod'), p('duck', 'commands', 'talk-over')],
    inside: [
      part('capture', 'Capture', false, 'mic off', 'The browser\'s default microphone, with the browser\'s echo cancelling, noise suppression and auto gain, as 16 kHz mono. There is no choice of input device.'),
      part('vad', 'Voice detector', false, '30 ms frames', 'Loudness over 30 ms frames against a floor that adapts to the room. Speech starts after 0.15 s of voice and ends after 0.65 s of silence. It keeps the 0.35 s before the start, drops anything under 0.25 s and cuts a phrase at 20 s.'),
      part('early', 'Early transcribe', false, 'at a 0.35 s pause', 'At a 0.35 s pause the phrase so far already goes to Hearing, and she nods. If that was the end of the sentence the words are ready; if you go on, that result is dropped.'),
      part('strict', 'Strict mode', false, 'while she talks', 'While her voice plays, speech has to be 3 times louder to count, so her own voice does not start a phrase.'),
    ],
    does: 'Finds where you start and stop talking and sends each phrase as one clip. Also tells the rig she is being talked to, and turns her voice down while you talk over her.' },
  stt: { name: 'Hearing (STT)', owner: 'app', where: 'server · /hear · Whisper on the GPU, and an echo filter in the browser', at: [1, 0],
    in: [p('audio', 'audio', 'phrase · 16 kHz'), p('name', 'text', 'character name')], out: [p('text', 'text', 'transcript')],
    inside: [
      part('whisper', 'Whisper', false, 'engine · model · device', 'Self-hosted by this app\'s server, on the GPU where there is one: whisper.cpp on Metal on Apple Silicon, faster-whisper on CUDA or the CPU elsewhere. Model base.en unless Settings or NORI_STT names another. The character\'s name is passed as a hint so it is spelled right. The line above shows what is loaded now.'),
      part('speech', 'Speech filter', false, 'drops non-speech', 'A voice filter (Silero) passes on only the stretches with speech in them, so silence and noise never reach Whisper and it cannot invent words from them.'),
      part('echo', 'Echo filter', false, 'in the page', 'Runs in the page, not the server: a phrase heard while her voice was playing is dropped if 75% or more of its words are her own.'),
    ],
    does: 'One clip of 16 kHz 16-bit mono PCM in, one transcript out, one clip at a time. The language comes from the settings (auto or fixed). No partial results, no word timings, no streaming. Measured: about 0.2 s for a short sentence on an M1 Max.' },
  agent: { name: 'Agent', owner: 'framework', where: 'server · /chat · JaegerAgent 1.2 library', at: [2, 0],
    in: [p('heard', 'text'), p('typed', 'text', 'typed text'), p('persona', 'text', 'persona (pack)'), p('actions', 'commands', 'offered actions'),
      p('interrupt', 'commands'),
      off('results', 'commands', 'tool results'), off('image', 'video', 'camera image'), off('audio', 'audio', 'microphone audio')],
    out: [p('reply', 'text', 'reply stream'), off('calls', 'commands', 'tool calls'),
      off('state', 'text', 'state · activity'), off('speech', 'audio', 'speech audio')],
    inside: [
      part('model', 'Model', true, 'llama.cpp · in-process', 'The language model runs inside the agent: its llama.cpp adapter loads a model file (GGUF) from this Mac, puts every layer on the GPU with 8,192 tokens of context, and streams the reply as it is written. There is no model server. The file is chosen in Settings; a new file, or the thinking switch, reloads the model (about 12 s). At startup the character\'s instructions are run through it once, so the first reply starts as fast as the rest: about 0.15 s to the first words on an M1 Max.'),
      part('tools', 'Tools', false, 'off · 40 tool files', 'The agent calls any tool registered with it: files, web, memory, speak, listen, vision and more. This app starts it with no tools (JAEGER_AGENT_NO_TOOLS) and one step per turn, so the avatar is driven by tags in the reply text, not by tool calls.'),
      part('skills', 'Skills', false, 'off', 'Skill packs the agent can load. Off in this app (JAEGER_AGENT_NO_SKILLS).'),
      part('hearing', 'Hearing', false, 'off · Whisper, streaming', 'Its own speech to text: stt-whisper (whole phrase, large-v3-turbo) and stt-streaming (sentences as they are spoken). Not used: the app\'s own Hearing node does this.'),
      part('voice', 'Voice', false, 'off · Kokoro', 'Its own text to speech: tts-kokoro, Kokoro af_heart in 24 kHz chunks. Not used: the app\'s own Voice node does this.'),
      part('audio', 'Audio I/O', false, 'off · echo cancel, barge-in', 'audio-duplex-io: microphone and speaker on one 48 kHz clock, with echo cancelling and barge-in detection. Not used: the browser has the microphone and the speaker.'),
      part('vision', 'Vision', false, 'off · image projector', 'vision-mmproj: gives Gemma an image with the user\'s text for one turn. Not used.'),
    ],
    does: 'JaegerAgent, imported as a library, not run on the Jaeger bus. Each turn the page sends the whole chat so far and the actions this body offers; the agent builds the prompt from the pack persona and the acting rules and streams the reply as text chunks. One agent per chat session, one step per turn. Of what it contains, this app uses the agent loop and the model. With no model file on this Mac the agent is not called at all: the page writes a scripted reply (see Performance).' },
  perform: { name: 'Performance', owner: 'app', where: 'browser · brain.js parser + app.js queue', at: [3, 0],
    in: [p('reply', 'text'), p('orders', 'commands', 'remote act · stop'), p('clip', 'audio', 'ready-made clip'), p('buttons', 'commands', 'buttons · reel')],
    out: [p('say', 'text', 'say · sing · sound'), p('stop', 'commands', 'stop · cancel'), p('act', 'commands', 'feel · act'), p('ready', 'audio', 'ready-made clip'), p('subs', 'text', 'subtitles')],
    inside: [
      part('parser', 'Tag parser', true, '[tags] in the text', 'Reads the reply as it streams and splits it into commands: a feeling, a gesture, a line to say, a vocal sound, a [sing] passage, a chapter.'),
      part('clause', 'Early first clause', false, 'fast voice only', 'With the fast voice (Piper) the first clause is sent to the voice before the sentence is finished, to start talking sooner. Off with the natural voice.'),
      part('queue', 'Queue', true, 'face waits for voice', 'Every line starts making its clip the moment it is queued; clips then play in order. A feeling or gesture waits for the clip of the line that follows it, so face and voice land together.'),
      part('body', 'Body mapping', true, 'one tag, any body', 'One set of tags for every body: a posable body takes a pose, a display robot plays an eye reaction, a full body does a move, the rest make a smaller gesture.'),
      part('scripted', 'Scripted reply', false, 'model answers', 'With no model the page writes a scripted reply itself (brain.js); the agent is not called. A request to introduce herself is always answered from the character sheet.'),
      part('reel', 'Guided reel', true, 'Play button', 'A fixed show (Face reel or Showtime) through the same queue; its clips are made ahead of time after the page loads.'),
      part('stop', 'Stop · barge-in', true, 'new turn stops old', 'A new message, the Stop button or a remote stop clears the queue, stops the clip, cancels voice requests and interrupts the agent.'),
    ],
    does: 'Turns the reply text into what she does: feel, act, say, sound, sing. Hard-coded in the app today; the agent has no tools for this. Also takes the buttons, the reel and the control link\'s orders, and shows the subtitles.' },
  tts: { name: 'Voice (TTS)', owner: 'app', where: 'server · /say /song /sing · voice_engine.py, and the browser voice worker', at: [4, 0],
    in: [p('text', 'text', 'lines · lyrics'), p('cancel', 'commands'), p('voice', 'text', 'voice · speed'), p('sample', 'audio', 'clone sample')],
    out: [p('clip', 'audio', 'WAV clip'), p('lips', 'motion', 'lip marks · beats')],
    inside: [
      part('kokoro', 'Kokoro', false, 'natural voice', 'Kokoro 82M: on Apple MLX when it loads, else ONNX on the CPU. 15 English voices, 24 kHz. On MLX it also returns the lip-closure marks. Speed follows the feeling and the speed setting.'),
      part('clone', 'Cloned voice', false, 'Chatterbox Turbo', 'Chatterbox Turbo on MLX speaks in a voice cloned from a sample you upload with consent. The sample stays on this Mac.'),
      part('piper', 'Piper', false, 'fast voice', 'The fast voice: Piper, en_US-kristin-medium unless NORI_VOICE names another, 22 kHz. No lip marks.'),
      part('synth', 'Built-in synth', true, 'sounds · fallback', 'A small voice synthesiser in the browser worker: laughs, gasps and other sounds the voices cannot make, built-in singing, and a babble voice if the server voice fails.'),
      part('singing', 'Singing', true, '/song · /sing', 'A [sing] passage: Kokoro on MLX performs it in rhythm (/song, sung or spoken style, with beat times), otherwise the line is spoken and bent onto a melody in the browser (/sing), or the built-in synth sings it. A separate experimental singer can be started.'),
      part('cache', 'Clip cache', true, 'ready · in flight', 'Finished clips and requests still on their way are kept, so a repeated line or a prepared reel plays at once. The server also keeps short lines.'),
    ],
    does: 'Self-hosted by this app: one WAV clip per sentence, not streamed. A request can be cancelled by turn. Measured: 0.39 s for a 0.63 s clip. Only requests to /say are traced; songs, built-in sounds and ready-made clips make no event.' },
  speaker: { name: 'Speaker', owner: 'app', where: 'browser · Web Audio', at: [5, 0],
    in: [p('clip', 'audio', 'WAV clip'), p('duck', 'commands', 'talk-over'), p('mute', 'commands')],
    out: [p('sound', 'audio', 'loudspeaker'), p('clock', 'motion', 'clip clock'), p('playing', 'commands'), p('tap', 'audio', 'recording tap')],
    inside: [
      part('gains', 'Duck · mute', true, 'to 20% when you talk', 'Two volume stages: one drops her voice to 20% while you talk over her, one is the mute button.'),
      part('lift', 'Loudness lift', true, 'up to 2×', 'Each clip is raised to near full scale, by at most 2 times, so quiet and loud clips match.'),
      part('effects', 'Pitch · robot', true, 'per character', 'The character\'s pitch is applied by playing the clip faster or slower; robot characters get a ring modulator.'),
      part('clock', 'Clip clock', true, 'minus output delay', 'Where the clip is right now, corrected for the output delay. It times the mouth.'),
      part('meter', 'Level meter', true, 'level bar', 'Measures the sound for the level bar on the stage.'),
      part('fallback', 'Silent fallback', false, 'if audio is blocked', 'If the browser blocks sound, clips run on a timer so the face still performs.'),
    ],
    does: 'Plays each clip in order through one Web Audio graph. The output device is fixed: the browser\'s default loudspeaker, no choice. Its clip clock is what times the lip sync, and stage recording taps the sound here.' },
  lipsync: { name: 'Lip sync', owner: 'app', where: 'browser · voice.js · lip-sync.js, and server /lip-sync for KIN', at: [2, 1],
    in: [p('audio', 'audio', 'clip samples'), p('track', 'motion', 'lip marks · beats'), p('clock', 'motion', 'clip clock')],
    out: [p('mouth', 'motion', 'mouth shape'), p('accents', 'motion', 'emphasis · beats')],
    inside: [
      part('nori', 'Audio analysis', true, 'Nori · any voice', 'Works out a mouth track (open, wide, round) and the stresses from the clip\'s sound itself, in the browser worker. Works with any voice. The KIN method uses it too.'),
      part('marks', 'Engine lip marks', false, 'Kokoro on MLX', 'Where the voice engine says the lips close (p, b, m), added to the track. Only Kokoro on MLX gives them.'),
      part('kin', 'KIN vowels', false, 'off', 'The server names the vowel 40 times a second (kin_lipsync.py) and the mouth takes that vowel\'s shape. A setting.'),
      part('ahead', 'Lookahead', true, '50 ms', 'The mouth reads the track 50 ms ahead of the clip clock, so lips do not trail the sound.'),
    ],
    does: 'Turns each clip into a mouth shape for every frame, timed by the speaker\'s clip clock. Also fires the accents: an emphasis on stressed words, a blink at pauses, a kick on each song beat.' },
  anim: { name: 'Animation', owner: 'app', where: 'browser · rig.js · motion.js · eyes.js', at: [3, 1],
    in: [p('mouth', 'motion', 'mouth shape'), p('accents', 'motion', 'emphasis · beats'), p('commands', 'commands', 'feel · act · look'),
      p('listen', 'commands', 'listening · nod'), p('typing', 'commands', 'typing · pointer')],
    out: [p('channels', 'motion', '46 channels · fx'), p('state', 'motion', 'rig state')],
    inside: [
      part('feelings', 'Feelings', true, `${count(EMOTIONS)} poses`, 'Each feeling is a pose: a target for every channel.'),
      part('idle', 'Idle life', true, 'blink · breathe', 'Blinks, breathing and small drifts that run all the time, plus listening and typing attention.'),
      part('gestures', 'Gestures', true, `${count(GESTURES)} short`, `Short timed animations on top of the pose: ${Object.keys(GESTURES).join(', ')}.`),
      part('reactions', 'Eye reactions', false, `${count(REACTIONS)} for display faces`, `For display robots: ${Object.keys(REACTIONS).join(', ')}.`),
      part('moves', 'Body moves', false, `${count(MOVES)} full-body`, `For full bodies: ${Object.keys(MOVES).join(', ')}.`),
      part('poses', 'Poses', false, 'posable bodies', 'Named whole-body poses of a posable body (Truth: kneel, stand, sit and more).'),
      part('springs', 'Springs', true, 'one per channel', 'Every channel moves to its target on its own spring, so layers blend without snapping.'),
    ],
    does: 'The rig: 46 channels (mouth, lids, brows, gaze, shape, head, body, tone). Layers, in order: the feeling\'s pose, idle life, gestures and moves, then the speech-driven mouth on top. Which reactions and actions a body has comes from its pack.' },
  render: { name: 'Renderer', owner: 'app', where: 'browser · WebGL / canvas · render-*.js', at: [4, 1],
    in: [p('channels', 'motion', '46 channels · fx'), p('look', 'video', 'look (pack)'), p('model', 'video', 'your VRM model')], out: [p('frames', 'video')],
    inside: [
      part('led', 'LED · OLED face', false, 'display robots', 'Draws the face a display robot shows: an OLED face (Mochi) or a visor.', { adapters: ['nori-led'] }),
      part('anime', '2D anime', false, '2D character', 'A 2D anime-style character.', { adapters: ['nori-anime'] }),
      part('sdf', 'Raymarched 3D', false, 'sculpted in code', 'A 3D body sculpted in shader code and raymarched (Truth is one).', { adapters: ['nori-3d'] }),
      part('vrm', 'VRM model', false, 'your own model', 'A VRM model you load, driven by the same channels.', { adapters: ['nori-vrm'] }),
      part('kin', 'KIN character', false, 'KIN rigs', 'KIN characters, drawn by their own code (kin-character.js).', { adapters: ['kin-momo', 'kin-vrm'] }),
      part('study', 'Vector study', false, 'study figures', 'Vector study figures.', { adapters: ['jaeger-study'] }),
      part('media', 'Clips · card', false, 'video or a still', 'A pack with no rig: its video clips, or a still card.', { adapters: ['media'] }),
    ],
    does: 'Draws the character from the rig channels every frame. One renderer is in use at a time: the one the current body\'s pack names. The look is the pack\'s, frozen per display; the app never generates it.' },
  outputs: { name: 'Outputs', owner: 'app', where: 'browser · hardware.js · output.html · server /relay', at: [5, 1],
    in: [p('frames', 'video'), p('rig', 'motion', 'rig state'), p('sound', 'audio', 'stage sound')],
    out: [p('stage', 'video', 'stage canvas'), p('hw', 'video', 'hardware streams'), p('window', 'video', 'output windows'), p('file', 'video', 'recording file')],
    inside: [
      part('stage', 'Stage', true, 'this window', 'The large picture in the app window. Always on.'),
      part('hardware', 'Hardware streams', false, 'no device', 'The exact pixels each real device would get: JP01 a 64×64 face and two 24×1 LED rings, Mochi a 256×256 face. Made only while a viewer is open. If the pack has no look for that size, a stand-in is shown and labelled.'),
      part('relay', 'Output windows', false, 'none open', 'Other windows and devices follow through the server: the rig state, not pixels, at most every 32 ms, and each redraws it itself.'),
      part('record', 'Stage recording', false, 'not recording', 'Records the stage at 30 frames a second with the sound. Held in memory, 10 minutes at most.'),
    ],
    does: 'Where the picture goes. Anything can take a stream; playing it on a real screen is the hardware\'s job.' },
  control: { name: 'Control link', owner: 'app', where: 'server · /control, and browser · control-link.js', at: [0, 1],
    in: [p('remote', 'commands', 'remote commands'), p('upload', 'audio', 'clip upload')],
    out: [p('face', 'commands', 'feel · look'), p('act', 'commands', 'react · act · stop'), p('clip', 'audio', 'speak clip + marks'), p('state', 'text', 'state report')],
    inside: [
      part('guard', 'Local + token', true, 'this Mac only', 'Only programs on this Mac can reach it, and commands and uploads need the token: from JAEGER_AVATAR_CONTROL_TOKEN, or a random one printed when the server starts.'),
      part('attach', 'Attach', true, 'one page follows', 'The page attaches with this body\'s controls. One page follows the link at a time; a second page waits.'),
      part('poll', 'State poll', true, 'every 50 ms', 'The page reads the link\'s state every 50 ms and turns each change into the calls its own buttons make.'),
      part('clips', 'Clip store', true, 'for speak', 'Holds an uploaded clip and its lip marks until the page fetches it.'),
    ],
    does: 'How a program outside the app drives the avatar: feel, react, act, look, stop, and speak with a clip it made itself. Always running; nothing happens until something sends a command.' },
};
// on: the traced events ('stage:event') that mean data just travelled this wire. 'channels:*' are the rig frames
// flow.js sends about 15 times a second. model: only in a turn where the prompt really went to the model (scripted
// replies stream text too, but the page writes them). on: [] is a real connection the app does not trace: drawn
// dashed, never lit.
export const WIRES = [
  { from: 'mic.phrase', to: 'stt.audio', on: ['stt:request'] },
  { from: 'mic.state', to: 'anim.listen', on: ['mic:speech start', 'mic:pause', 'mic:resumed'] },
  { from: 'mic.duck', to: 'speaker.duck', on: ['mic:speech start', 'mic:cancelled'] },
  { from: 'stt.text', to: 'agent.heard', on: ['stt:transcript'] },
  { from: 'agent.reply', to: 'perform.reply', on: ['agent:text'], model: true },
  { from: 'perform.say', to: 'tts.text', on: ['tts:request'] },
  { from: 'perform.act', to: 'anim.commands', on: ['perform:emotion', 'perform:gesture', 'control:react', 'control:act'] },
  { from: 'perform.ready', to: 'speaker.clip', on: ['control:speak'] },
  { from: 'perform.ready', to: 'lipsync.audio', on: ['control:speak'] },
  { from: 'perform.stop', to: 'agent.interrupt', on: [] },
  { from: 'perform.stop', to: 'tts.cancel', on: [] },
  { from: 'tts.clip', to: 'speaker.clip', on: ['tts:clip ready'] },
  { from: 'tts.clip', to: 'lipsync.audio', on: ['tts:clip ready'] },
  { from: 'tts.lips', to: 'lipsync.track', on: ['tts:clip ready'] },
  { from: 'speaker.clock', to: 'lipsync.clock', on: ['channels:voice'] },
  { from: 'speaker.playing', to: 'mic.talking', on: ['speaker:play', 'speaker:ended'] },
  { from: 'lipsync.mouth', to: 'anim.mouth', on: ['channels:voice'] },
  { from: 'lipsync.accents', to: 'anim.accents', on: ['channels:voice'] },
  { from: 'anim.channels', to: 'render.channels', on: ['channels:frame'] },
  { from: 'anim.state', to: 'outputs.rig', on: [] },
  { from: 'render.frames', to: 'outputs.frames', on: ['channels:frame'] },
  { from: 'speaker.tap', to: 'outputs.sound', on: [] },
  { from: 'control.face', to: 'anim.commands', on: ['control:feel', 'control:look', 'control:stop'] },
  { from: 'control.act', to: 'perform.orders', on: ['control:react', 'control:act', 'control:stop'] },
  { from: 'control.clip', to: 'perform.clip', on: ['control:speak'] },
];
export const wiresFor = (stage, event, model = false, wires = WIRES) => wires.filter(w => (!w.model || model) && w.on.includes(`${stage}:${event}`));

// The map above is the older path (JAEGER_AVATAR_LOOP=0, or no model file): this app's own hearing and voice around a
// text-only agent. LOOP is the path the app runs by default: Jaeger Agent's voice loop. Hearing, the model, its tools
// and the voice are sections of the one agent node (head: a section title; stage: the traced stage that lights it); the
// agent takes hearing and voice from the Jaeger modules itself. The app keeps the microphone, the stage, and a voice of
// its own that the reel, the intro line, songs and sound effects still use.
const head = (id, name, on, note, does, stage) => part(id, name, on, note, does, { head: true, stage });
const placed = (k, col, row, more) => ({ ...NODES[k], at: [col, row], ...more });
export const LOOP = {
  STAGES: ['mic', 'stt', 'agent', 'tools', 'voice', 'scene', 'perform', 'tts', 'speaker', 'anim', 'control'],
  NODES: {
    mic: placed('mic', 0, 0, {
      out: [p('frames', 'audio', 'sound · 16 kHz'), p('state', 'commands', 'listening · nod'), p('duck', 'commands', 'talk-over')],
      inside: [
        part('capture', 'Capture', false, 'mic off', NODES.mic.inside[0].does),
        part('vad', 'Voice detector', false, '30 ms frames', 'Loudness over 30 ms frames against a floor that adapts to the room. Here it only serves the page: she nods, her voice is turned down while you talk over her, and the gate opens. Where a phrase starts and ends is decided by the agent.'),
        part('gate', 'Self-voice gate', false, 'keeps 0.6 s', 'While she is quiet every frame goes to the agent. While she talks nothing goes (it would hear her) until the voice detector says someone is talking over her: then the last 0.6 s and everything after, until they stop.'),
        part('send', 'Frame sender', false, 'one request at a time', 'Frames go to the server as 16 kHz 16-bit mono (/agent/audio), one request at a time; what arrives meanwhile goes in the next. The server hands them to the agent as they are.'),
      ],
      does: 'Sends the microphone sound to the agent, which does the hearing. Also tells the rig she is being talked to, and turns her voice down while you talk over her.' }),
    agent: { name: 'Agent', owner: 'framework', where: 'server · worker process app/agent_loop.py · Jaeger Agent voice loop', at: [1, 0],
      in: [p('audio', 'audio', 'microphone sound'), p('typed', 'text', 'typed text'), p('persona', 'text', 'persona · voice'), p('offers', 'commands', 'body\'s moves'),
        p('results', 'commands', 'tool results'), p('interrupt', 'commands'), p('say', 'text', 'one line to voice'), p('scene', 'text', 'scene script'), p('cue', 'commands', 'cue is due'), off('image', 'video', 'camera image')],
      out: [p('speech', 'audio', 'speech clips'), p('heard', 'text', 'what it heard'), p('reply', 'text', 'reply text'), p('calls', 'commands', 'tool calls'),
        p('lips', 'motion', 'lip marks'), p('state', 'text', 'state · timings')],
      inside: [
        head('hearing', 'Hearing (STT)', true, 'version · device', 'The agent\'s ears. It opens the Jaeger Whisper module itself; this app has no copy in this path. The line shows the module\'s version and what it computes on, as the agent reports it.', 'stt'),
        part('hmodule', 'Module', true, 'jaeger_whisper_stt', 'The Jaeger module the agent imports for hearing.'),
        part('whisper', 'Whisper', true, 'model from Settings', 'The Whisper model named in Settings, loaded by the module.'),
        part('detect', 'Speech detector', true, 'Silero', 'A voice detector (Silero) finds where you start; the turn ends after 0.5 s of quiet. Reported as "Speech detected" and "End-of-turn".'),
        part('live', 'Live words', true, 'while you speak', 'The words so far are sent out while you are still speaking; the finished phrase is what the model answers.'),
        head('model', 'Model', true, 'llama.cpp · in-process', 'The language model runs inside the agent: llama.cpp loads a model file (GGUF) from this Mac onto the GPU and streams the reply as it is written. There is no model server.', 'agent'),
        part('gguf', 'File', true, 'chosen in Settings', 'The model file chosen in Settings.'),
        part('ctx', 'Context', true, 'tokens', 'How much text the model can hold at once, tools and conversation included.'),
        part('memory', 'Conversation', true, 'one per character', 'The agent keeps the conversation: each character and body has its own, and the page sends only the new line.'),
        head('tools', 'Tool use', true, 'on', 'The model calls tools and reads their results, several steps a turn if it needs them, before or between its words.', 'tools'),
        part('avatar', 'avatar', true, 'feel · act · look', 'Registered by this app: one call shows a feeling, makes a move or looks somewhere. It goes to the control link, which moves the body or refuses with what this body offers. A call from the model acts at once and holds about ten seconds. A scene\'s move is the same call, made when the sound reaches its cue and held as long as the scene says.'),
        part('scenetool', 'scene', true, 'writes a scene', 'Registered by this app: the model writes a scene script itself (asked in words to act something out, or to do things in order or for a set time). The agent reads it; a script it cannot read goes back to the model to fix. The scene is the reply: the turn ends on the call, with no second model call to narrate it, and the scene is performed once any words that came with the call are spoken.'),
        part('others', 'Agent\'s own tools', true, 'short list', 'The agent\'s own tools: time, web, memory, files and more. The short list is shown to the model, so it starts in about 15 s, not 48 s; JAEGER_FULL_TOOLS=1 shows every tool. Their calls are not reported to this window yet.'),
        part('steps', 'Steps per turn', true, 'limit', 'How many model calls one turn may take.'),
        head('voice', 'Voice (TTS)', true, 'version · device', 'The agent\'s voice. It opens the Jaeger Kokoro module itself; replies are not voiced by this app\'s own voice code. The line shows the module\'s version and what it computes on.', 'voice'),
        part('vmodule', 'Module', true, 'jaeger_kokoro_tts', 'The Jaeger module the agent imports for its voice.'),
        part('kokoro', 'Kokoro', true, 'voice · 24 kHz', 'Kokoro in the voice the character names; a change of character changes the voice without loading the model again.'),
        part('stream', 'Sentence streaming', true, 'as written', 'Speaks while the model still writes: the opening goes out at its first comma or breath point, then whole sentences. Each is one clip.'),
        part('lips', 'Lip marks', true, 'closures · tucks', 'With each clip, when the lips close (p, b, m) or tuck (f, v).'),
        part('short', 'Short-clip cache', true, 'short lines', 'Clips of 12 characters or fewer are kept once made, so a repeated "Oh," plays from memory.'),
        head('scene', 'Scenes', true, 'lines with timed moves', 'A script for the agent to perform, written by you in the Scene box or by the model with its scene tool: steps in order: a line to say, seconds of quiet, and moves (emotion, action, look) that happen as the next line or quiet starts, held if wanted, or put on a named word of the line just said. The agent reads it and refuses a script it cannot read before a word is said. Each move is fitted to the body first (the body is asked what it offers): your own scene with a move it lacks is refused, with what it does offer; a scene the model wrote plays without that move, and the model is told. No model is used; the lines join the conversation, so she can be answered.', 'scene'),
        part('lines', 'Lines', true, 'whole, in order', 'Each line is voiced whole by the agent\'s voice, as one clip; quiet goes out as silent sound, so everything keeps the sound\'s clock.'),
        part('cues', 'Cues', true, 'on the clip clock', 'Each clip carries its moves as cues: seconds from the clip\'s start, and the avatar call to make then. A move on a word is timed by the share of the letters before it. Whoever plays the clip says when a cue is due; here that is the page, 30 ms early, and each move lands within about 35 ms of its moment.'),
        head('io', 'Audio I/O', false, 'off · browser has both', 'The agent\'s own microphone and speaker with echo cancelling (audio-duplex-io). Not used here: the browser has the microphone and the loudspeaker. A robot would use it.'),
        head('vision', 'Vision', false, 'off · image projector', 'Gives the model an image with the user\'s words for one turn. Not used.'),
      ],
      does: 'Jaeger Agent\'s voice loop, in a worker process beside the server. It imports its hearing and its voice from the Jaeger modules itself; the app only names the Whisper model and the voice. Microphone sound, typed text or a scene script go in; voice clips with lip marks and cues, the words and timing notes come out, and it moves the body with its avatar tool. One turn at a time; an interrupt cuts in.' },
    perform: placed('perform', 2, 0, {
      in: [p('speech', 'audio', 'speech clips'), p('heard', 'text', 'what it heard'), p('reply', 'text', 'reply text'), p('orders', 'commands', 'remote act · stop'), p('clip', 'audio', 'ready-made clip'), p('buttons', 'commands', 'buttons · reel')],
      out: [p('say', 'text', 'reel · intro lines'), p('stop', 'commands', 'stop · cancel'), p('play', 'audio', 'clips in order'), p('act', 'commands', 'feel · act'), p('subs', 'text', 'subtitles'), p('cue', 'commands', 'cue is due')],
      inside: [
        part('queue', 'Queue', true, 'clips in order', 'Clips play in the order they arrive: the agent\'s sentences, a reel line, a ready-made clip. A scene\'s clips are held until every line is voiced, then play straight through.'),
        part('cues', 'Scene cues', true, 'on the clip clock', 'A clip from a scene carries cues. When the playing clip\'s clock reaches one (30 ms early, for the trip), the page tells the agent; its avatar tool makes the move, which comes back over the control link like any other. How long after its moment each move landed is shown on the control event.'),
        part('echo', 'Echo check', true, 'her own words', 'A phrase the agent heard while her voice was playing is dropped, and that turn stopped, if 75% or more of its words are her own.'),
        part('parser', 'Tag parser', true, 'reel · intro only', 'Splits a tagged script into feelings, gestures, lines and sounds. Replies no longer pass through it; the reel, the intro line and the page\'s own error line do.'),
        part('body', 'Body mapping', true, 'one name, any body', 'One set of names for every body: a posable body takes a pose, a display robot plays an eye reaction, a full body does a move, the rest make a smaller gesture.'),
        part('reel', 'Guided reel', true, 'Play button', 'A fixed show through the same queue, voiced by the app\'s own voice; there a feeling or gesture waits for the clip of the line that follows it.'),
        part('stop', 'Stop · barge-in', true, 'new turn stops old', 'A new message, the Stop button or a remote stop clears the queue, stops the clip and interrupts the agent.'),
      ],
      does: 'Plays what the agent says, in order, and shows the words. It does not read tags out of a reply any more: the agent moves the body itself, with its avatar tool. The reel, the intro line and the buttons still run through here, voiced by the app\'s own voice.' }),
    tts: placed('tts', 3, 0, { name: 'App voice',
      does: 'This app\'s own, older voice code. With the voice loop on, replies do not come through here: the agent voices them. The intro line, the guided reel, songs, sound effects and cloned voices still do, and so does the "app\'s own" side of the voice comparison page.' }),
    speaker: placed('speaker', 4, 0),
    control: placed('control', 0, 1, { out: [...NODES.control.out, p('answer', 'commands', 'ok · refusal')],
      does: 'How the agent\'s avatar tool, or a program outside the app, drives the avatar: feel, react, act, look, stop, and speak with a clip it made itself. A command this body does not offer is refused, with what it does offer.' }),
    lipsync: placed('lipsync', 1, 1), anim: placed('anim', 2, 1), render: placed('render', 3, 1), outputs: placed('outputs', 4, 1),
  },
  WIRES: [
    { from: 'mic.frames', to: 'agent.audio', on: ['mic:speech start', 'mic:speech end'] },
    { from: 'mic.state', to: 'anim.listen', on: ['mic:speech start', 'mic:pause', 'mic:resumed'] },
    { from: 'mic.duck', to: 'speaker.duck', on: ['mic:speech start', 'mic:cancelled'] },
    { from: 'agent.speech', to: 'perform.speech', on: ['voice:clip ready'] },
    { from: 'agent.heard', to: 'perform.heard', on: ['stt:transcript'] },
    { from: 'agent.reply', to: 'perform.reply', on: ['agent:done'] },
    { from: 'agent.calls', to: 'control.remote', on: ['tools:tool'] },
    { from: 'agent.lips', to: 'lipsync.track', on: ['voice:clip ready'] },
    { from: 'perform.play', to: 'speaker.clip', on: ['voice:clip ready', 'control:speak'] },
    { from: 'perform.play', to: 'lipsync.audio', on: ['voice:clip ready', 'control:speak'] },
    { from: 'perform.say', to: 'tts.text', on: ['tts:request'] },
    { from: 'perform.stop', to: 'agent.interrupt', on: [] },
    { from: 'perform.stop', to: 'tts.cancel', on: [] },
    { from: 'perform.cue', to: 'agent.cue', on: ['perform:cue'] },
    { from: 'perform.act', to: 'anim.commands', on: ['perform:emotion', 'perform:gesture', 'control:react', 'control:act'] },
    { from: 'tts.clip', to: 'speaker.clip', on: ['tts:clip ready'] },
    { from: 'tts.clip', to: 'lipsync.audio', on: ['tts:clip ready'] },
    { from: 'tts.lips', to: 'lipsync.track', on: ['tts:clip ready'] },
    { from: 'speaker.clock', to: 'lipsync.clock', on: ['channels:voice'] },
    { from: 'speaker.playing', to: 'mic.talking', on: ['speaker:play', 'speaker:ended'] },
    { from: 'lipsync.mouth', to: 'anim.mouth', on: ['channels:voice'] },
    { from: 'lipsync.accents', to: 'anim.accents', on: ['channels:voice'] },
    { from: 'anim.channels', to: 'render.channels', on: ['channels:frame'] },
    { from: 'anim.state', to: 'outputs.rig', on: [] },
    { from: 'render.frames', to: 'outputs.frames', on: ['channels:frame'] },
    { from: 'speaker.tap', to: 'outputs.sound', on: [] },
    { from: 'control.face', to: 'anim.commands', on: ['control:feel', 'control:look', 'control:stop'] },
    { from: 'control.act', to: 'perform.orders', on: ['control:react', 'control:act', 'control:stop'] },
    { from: 'control.clip', to: 'perform.clip', on: ['control:speak'] },
    { from: 'control.answer', to: 'agent.results', on: ['tools:tool'] },
  ],
};

export const OWN = { STAGES, NODES, WIRES };

// The drawing, in canvas pixels: two rows of cards, wires only in the gutters between the columns and in the band
// between the rows. A wire to the next column at the same height runs straight. Any other wire leaves its port for
// that port's own slot in the gutter, runs along its lane in the band, and enters through the target port's own slot;
// wires from one output share its slot and lane, wires into one input share its slot. Lanes are reused where two
// runs do not meet. The port nearest the band takes the slot nearest its card, so stubs do not cross their own slots.
export const NW = 224, HEAD = 44, PAD = 10, ROW = 20, INS = 18;
const STEP = 7, LANE = 9;
export const cardH = n => HEAD + 2 * PAD + ROW * Math.max(n.in.length, n.out.length) + 13 + INS * n.inside.length + 26;
export function layout(NODES = OWN.NODES, WIRES = OWN.WIRES) {
  const rowH = r => Math.max(...Object.values(NODES).filter(n => n.at[1] === r).map(cardH)), band = 48 + rowH(0);
  const end = (r, side) => { const [k, id] = r.split('.'), n = NODES[k]; return { r, col: n.at[0], row: n.at[1], i: n[side].findIndex(q => q.id === id) }; };
  const wires = WIRES.map(w => { const a = end(w.from, 'out'), b = end(w.to, 'in'), next = a.col + 1 === b.col;
    return { a, b, next, straight: next && a.row === b.row && a.i === b.i }; });
  // Slots: [gutter, port] for every port with a wire that bends. Gutter g lies right of column g. Every gutter is as
  // wide as the fullest one needs, so slots that come in from its two sides never meet.
  const bends = [...wires.filter(w => !w.straight).map(w => [w.a.col, 'o' + w.a.r]), ...wires.filter(w => !w.next).map(w => [w.b.col - 1, 'i' + w.b.r])];
  const fullest = Math.max(...bends.map(([g]) => new Set(bends.filter(q => q[0] === g).map(q => q[1])).size));
  const GUT = Math.max(56, 28 + STEP * fullest), X = c => 28 + c * (NW + GUT);
  const slots = (list, x) => { const at = {}, n = {};
    for (const [g, e] of list.sort((p, q) => near(p[1]) - near(q[1]))) at[e.r] ??= x(g, n[g] = (n[g] ?? -1) + 1);
    return at; }, near = e => e.row ? e.i : -1 - e.i;
  const outX = slots(wires.filter(w => !w.straight).map(w => [w.a.col, w.a]), (g, s) => X(g) + NW + 10 + STEP * s);
  const inX = slots(wires.filter(w => !w.next).map(w => [w.b.col - 1, w.b]), (g, s) => X(g + 1) - 10 - STEP * s);
  // Lanes: one per output that has to cross the band; a lane is shared when the runs do not meet.
  const lanes = [], laneOf = {};
  for (const w of wires.filter(w => !w.next)) {
    const run = laneOf[w.a.r] ??= { lo: outX[w.a.r], hi: outX[w.a.r] };
    run.lo = Math.min(run.lo, inX[w.b.r]); run.hi = Math.max(run.hi, inX[w.b.r]);
  }
  for (const run of Object.values(laneOf).sort((p, q) => (q.hi - q.lo) - (p.hi - p.lo))) {   // longest first
    let i = lanes.findIndex(l => l.every(o => run.hi < o.lo - 12 || run.lo > o.hi + 12));
    if (i < 0) i = lanes.push([]) - 1;
    lanes[i].push(run); run.y = band + 16 + LANE * i;
  }
  const Y = [48, band + 32 + LANE * (lanes.length - 1)], GW = X(Math.max(...Object.values(NODES).map(n => n.at[0]))) + NW + 36, GH = Y[1] + rowH(1) + 30;
  const py = e => Y[e.row] + HEAD + PAD + ROW / 2 + ROW * e.i;
  const routes = wires.map(({ a, b, next, straight }) => {
    const p = { x: X(a.col) + NW, y: py(a) }, q = { x: X(b.col), y: py(b) }, xo = outX[a.r], xi = inX[b.r], y = laneOf[a.r]?.y;
    return straight ? [p, q] : next ? [p, { x: xo, y: p.y }, { x: xo, y: q.y }, q] : [p, { x: xo, y: p.y }, { x: xo, y }, { x: xi, y }, { x: xi, y: q.y }, q];
  });
  const cards = Object.fromEntries(Object.entries(NODES).map(([k, n]) => [k, { x: X(n.at[0]), y: Y[n.at[1]], w: NW, h: cardH(n) }]));
  return { GW, GH, cards, routes };
}
