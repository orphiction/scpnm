require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");
const { findAnswer } = require("./matcher");

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
const FUZZY_THRESHOLD = Number(process.env.FUZZY_THRESHOLD || 0.8); // typo tolerance
const MATCH_COVERAGE = Number(process.env.MATCH_COVERAGE || 0.75); // lower = looser matching
const AUTO_DETECT_QUESTIONS = (process.env.AUTO_DETECT_QUESTIONS || "true") !== "false";

const FAQ_PATH = path.join(__dirname, "faq.json");

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

const lastAnswered = new Map();

let faqCache = [];
let faqMtime = 0;

// Loads faq.json, reloading automatically whenever the file changes.
function loadFaq() {
  let mtime;
  try {
    mtime = fs.statSync(FAQ_PATH).mtimeMs;
  } catch {
    return faqCache;
  }
  if (mtime !== faqMtime) {
    faqMtime = mtime;
    try {
      const data = JSON.parse(fs.readFileSync(FAQ_PATH, "utf8"));
      faqCache = Array.isArray(data) ? data : [];
      console.log(`Loaded ${faqCache.length} FAQ entries`);
    } catch (e) {
      console.error(`faq.json has a syntax error, keeping previous version: ${e.message}`);
    }
  }
  return faqCache;
}

function looksLikeQuestion(text) {
  const t = text.trim().toLowerCase();
  if (t.length < 4) return false;
  if (t.endsWith("?")) return true;
  return QUESTION_STARTS.some((s) => t.startsWith(s)) && t.split(/\s+/).length >= 4;
}

client.once("clientReady", () => {
  loadFaq();
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const mentioned = message.mentions.has(client.user, {
    ignoreEveryone: true,
    ignoreRoles: true,
  });
  const inScope = ALLOWED_CHANNELS.size === 0 || ALLOWED_CHANNELS.has(message.channel.id);

  if (!mentioned) {
    if (!AUTO_DETECT_QUESTIONS || !inScope || !looksLikeQuestion(message.content)) return;
    const last = lastAnswered.get(message.author.id) || 0;
    if (Date.now() - last < COOLDOWN_MS) return;
  }

  const question = message.content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
  if (!question) return;

  const answer = findAnswer(question, loadFaq(), {
    fuzzy: FUZZY_THRESHOLD,
    coverage: MATCH_COVERAGE,
  });

  if (answer === null) {
    if (mentioned) {
      await message
        .reply({
          content: "I don't have an answer for that one. Try rephrasing, or ask a moderator.",
          allowedMentions: { parse: [], repliedUser: false },
        })
        .catch(console.error);
    }
    return; // stay silent for unmatched auto-detected questions
  }

  lastAnswered.set(message.author.id, Date.now());
  await message
    .reply({
      content: answer.slice(0, 2000),
      allowedMentions: { parse: [], repliedUser: false },
    })
    .catch(console.error);
});

client.login(DISCORD_TOKEN);
