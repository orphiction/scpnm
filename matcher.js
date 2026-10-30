// Matches a chat message against FAQ entries that each list several phrasings
// ("questions"). Capitalization, punctuation, filler words, plurals and small
// typos are ignored, so "Will there be mods?" and "will i be able to MOD it" both work.

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "will", "would", "be", "been",
  "being", "do", "does", "did", "can", "could", "should", "i", "me", "my", "we",
  "our", "you", "your", "it", "its", "to", "of", "in", "on", "for", "and", "or",
  "there", "this", "that", "these", "those", "any", "some", "am", "im", "ill",
  "game", "games", "gonna", "going", "able", "have", "has", "had", "so", "if",
  "with", "at", "by", "from", "just", "really", "please", "also", "than", "then",
  "them", "they", "their", "us", "as", "but", "youre", "ur", "u", "r",
]);

// Word forms that should count as the same word (applied after plural stripping).
const ALIASES = {
  coming: "come", came: "come",
  making: "make", made: "make",
  creating: "create", created: "create",
  building: "build", builder: "build", built: "build",
  modding: "mod", modded: "mod", modder: "mod",
  updating: "update", updated: "update",
  supporting: "support", supported: "support",
  playtesting: "playtest", playtester: "playtest",
  adding: "add", added: "add",
  planned: "plan", planning: "plan",
  releasing: "release", released: "release",
  launching: "launch", launched: "launch",
  develop: "dev", developer: "dev", developed: "dev", developing: "dev",
  gamemode: "mode",
};

function normalize(text) {
  return text.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9\s]/g, " ");
}

function stem(token) {
  if (token.length > 3 && token.endsWith("s") && !/(ss|us|is)$/.test(token)) {
    token = token.slice(0, -1);
  }
  return ALIASES[token] || token;
}

function tokenize(text) {
  return normalize(text)
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem)
    .filter((t) => t && !STOPWORDS.has(t));
}

// Similarity from 0 to 1 based on Levenshtein edit distance.
function similarity(a, b) {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

function tokenMatch(messageToken, variantToken, fuzzy) {
  if (messageToken === variantToken) return true;
  return (
    variantToken.length >= 5 &&
    messageToken.length >= 5 &&
    similarity(messageToken, variantToken) >= fuzzy
  );
}

const compiledCache = new WeakMap();

function compile(entries) {
  let compiled = compiledCache.get(entries);
  if (compiled) return compiled;
  compiled = entries.map((entry) => ({
    name: entry.name,
    answer: entry.answer,
    exclude: new Set((entry.exclude || []).flatMap((w) => tokenize(w))),
    variants: (entry.questions || [])
      .map((q) => [...new Set(tokenize(q))])
      .filter((tokens) => tokens.length > 0),
  }));
  compiledCache.set(entries, compiled);
  return compiled;
}

// Returns the best-matching entry's answer, or null if nothing matches.
// A variant matches when at least `coverage` of its meaningful words appear in
// the message. The variant that matches the most words wins.
function findEntry(message, entries, { fuzzy = 0.8, coverage = 0.75 } = {}) {
  const msgTokens = [...new Set(tokenize(message))];
  if (!msgTokens.length) return null;

  let best = null;
  for (const entry of compile(entries)) {
    if (entry.answer == null) continue;
    if (msgTokens.some((t) => entry.exclude.has(t))) continue;
    for (const variant of entry.variants) {
      const matched = variant.filter((v) =>
        msgTokens.some((m) => tokenMatch(m, v, fuzzy))
      ).length;
      const ratio = matched / variant.length;
      if (matched === 0 || ratio < coverage - 1e-9) continue;
      if (
        !best ||
        matched > best.matched ||
        (matched === best.matched && ratio > best.ratio)
      ) {
        best = { matched, ratio, name: entry.name, answer: entry.answer };
      }
    }
  }
  return best ? { name: best.name, answer: best.answer } : null;
}

// An answer can be a single string or a list of strings to pick from at random.
function randomReply(answer) {
  if (Array.isArray(answer)) {
    return answer.length ? answer[Math.floor(Math.random() * answer.length)] : null;
  }
  return answer;
}

// Returns the reply text for the best-matching entry, or null if nothing matches.
function findAnswer(message, entries, options) {
  const hit = findEntry(message, entries, options);
  return hit ? randomReply(hit.answer) : null;
}

module.exports = { findAnswer, findEntry, randomReply, tokenize, similarity };
