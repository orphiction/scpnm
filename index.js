require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");
const { findAnswer, randomReply } = require("./matcher");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error("Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

// Comma-separated channel IDs where the bot auto-answers. Empty = all channels.
const ALLOWED_CHANNELS = new Set(
  (process.env.ANSWER_CHANNEL_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);
const COOLDOWN_MS = Number(process.env.USER_COOLDOWN_SECONDS || 20) * 1000;
const CHAT_COOLDOWN_MS = Number(process.env.CHAT_COOLDOWN_SECONDS || 3) * 1000;
const FUZZY_THRESHOLD = Number(process.env.FUZZY_THRESHOLD || 0.8); // typo tolerance
const MATCH_COVERAGE = Number(process.env.MATCH_COVERAGE || 0.75); // lower = looser matching
const AUTO_DETECT_QUESTIONS = (process.env.AUTO_DETECT_QUESTIONS || "true") !== "false";

const NO_ANSWER = "I don't have an answer for that one. Try rephrasing, or ask a moderator.";
const DEFAULT_FALLBACK = "idk, I'm just a Discord bot.";

const QUESTION_STARTS = [
  "who", "what", "when", "where", "why", "how", "which", "can", "could",
  "does", "do", "is", "are", "will", "would", "should", "anyone know",
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // also enable in the Developer Portal
  ],
});

const lastAnswered = new Map(); // auto-detected questions
const lastChat = new Map(); // replies/@mentions to the bot

// Creates a loader for a JSON file that reloads whenever the file changes.
function makeLoader(fileName, empty, clean) {
  const filePath = path.join(__dirname, fileName);
  let cache = empty;
  let loadedMtime = 0;
  return function load() {
    let mtime;
    try {
      mtime = fs.statSync(filePath).mtimeMs;
    } catch {
      return cache;
    }
    if (mtime !== loadedMtime) {
      loadedMtime = mtime;
      try {
        cache = clean(JSON.parse(fs.readFileSync(filePath, "utf8")));
        console.log(`Loaded ${fileName}`);
      } catch (e) {
        console.error(`${fileName} has a syntax error, keeping previous version: ${e.message}`);
      }
    }
    return cache;
  };
}

const loadFaq = makeLoader("faq.json", [], (d) => (Array.isArray(d) ? d : []));
const loadChat = makeLoader("chat.json", { entries: [], fallback: [] }, (d) => ({
  entries: Array.isArray(d.entries) ? d.entries : [],
  fallback: Array.isArray(d.fallback) ? d.fallback : [],
}));

function looksLikeQuestion(text) {
  const t = text.trim().toLowerCase();
  if (t.length < 4) return false;
  if (t.endsWith("?")) return true;
  return QUESTION_STARTS.some((s) => t.startsWith(s)) && t.split(/\s+/).length >= 4;
}

// True if this message is a reply to one of the bot's own messages.
async function isReplyToBot(message) {
  if (!message.reference || !message.reference.messageId) return false;
  try {
    const referenced = await message.fetchReference();
    return referenced.author.id === client.user.id;
  } catch {
    return false;
  }
}

client.once("clientReady", () => {
  loadFaq();
  loadChat();
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const typedMention = new RegExp(`<@!?${client.user.id}>`).test(message.content);
  const replyToBot = !typedMention && (await isReplyToBot(message));
  const addressed = typedMention || replyToBot; // someone is talking to the bot directly
  const inScope = ALLOWED_CHANNELS.size === 0 || ALLOWED_CHANNELS.has(message.channel.id);

  if (addressed) {
    const last = lastChat.get(message.author.id) || 0;
    if (Date.now() - last < CHAT_COOLDOWN_MS) return;
  } else {
    if (!AUTO_DETECT_QUESTIONS || !inScope || !looksLikeQuestion(message.content)) return;
    const last = lastAnswered.get(message.author.id) || 0;
    if (Date.now() - last < COOLDOWN_MS) return;
  }

  const text = message.content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
  if (!text) {
    if (typedMention) await sendReply(message, "Yes? Ask me anything about SCP: NM!");
    return;
  }

  const options = { fuzzy: FUZZY_THRESHOLD, coverage: MATCH_COVERAGE };
  const chat = loadChat();

  // 1) real FAQ answers first, 2) small talk when addressed directly, 3) fallback
  let answer = findAnswer(text, loadFaq(), options);
  if (answer === null && addressed) answer = findAnswer(text, chat.entries, options);
  if (answer === null) {
    if (!addressed) return; // stay silent for unmatched auto-detected questions
    answer = looksLikeQuestion(text)
      ? NO_ANSWER
      : randomReply(chat.fallback) || DEFAULT_FALLBACK;
  }

  (addressed ? lastChat : lastAnswered).set(message.author.id, Date.now());
  await sendReply(message, answer);
});

function sendReply(message, content) {
  return message
    .reply({
      content: String(content).slice(0, 2000),
      allowedMentions: { parse: [], repliedUser: false },
    })
    .catch(console.error);
}

client.login(DISCORD_TOKEN);
