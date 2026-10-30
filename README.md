# Discord FAQ Bot (JavaScript, no AI)

Automatically answers questions in your Discord server by matching messages against the questions and answers in `faq.json`. No API keys, no external services, no cost.

## 1. Create the Discord bot
1. Go to https://discord.com/developers/applications and click **New Application**.
2. Open **Bot** > **Reset Token** and copy the token.
3. On the same page, turn on **Message Content Intent** (required to read messages).
4. Open **OAuth2 > URL Generator**: scopes `bot`; permissions *View Channels*, *Send Messages*, *Read Message History*. Open the generated URL to invite the bot.

## 2. Run it
Requires Node.js 18 or newer.
```bash
npm install
cp .env.example .env     # then paste your token
npm start
```

## 3. Edit the FAQ
Everything lives in `faq.json`. Each entry lists different ways someone might ask the same thing, plus one answer:

```json
{
  "name": "mods",
  "questions": [
    "Can I mod the game?",
    "Will there be mods?",
    "Is there mod support?"
  ],
  "exclude": ["who", "report"],
  "answer": "Absolutely! We are big mod supporters."
}
```

- `questions`: as many phrasings as you like. Add more whenever you see people asking something in a new way.
- `answer`: the reply. Use `\n` for a new line. Discord markdown works.
- `exclude` (optional): if a message contains any of these words, that entry is skipped. Handy for ambiguous words, e.g. "mod" can mean moderator.
- `name` (optional): a label for you, used by the tests.

### How matching works
- Capitalization and punctuation are ignored.
- Filler words ("will", "the", "a", "can", "I", "game", ...) are ignored, so "Will there be mods?" boils down to just "mod".
- Plurals and some word forms count as the same word (mods/mod, modding/mod, updating/update, developer/dev), and small typos are tolerated on longer words.
- A message matches a listed question when it contains at least 75% of that question's meaningful words (`MATCH_COVERAGE`). Very short questions like "Mods?" therefore need that exact word, while longer ones allow a bit of slack.
- If several entries match, the one matching the most words wins.
- `faq.json` reloads automatically when you save it. If you make a JSON typo, the bot keeps the last good version and prints a warning.

### Test your changes
Add example messages to the `CASES` list in `test.js` (use `null` for "should stay silent"), then run:
```bash
npm test
```

## How it behaves
- Replies when someone @mentions the bot, or posts something that looks like a question (ends with `?` or starts with a question word). Set `AUTO_DETECT_QUESTIONS=false` to reply only to @mentions.
- If an auto-detected question matches nothing, the bot stays silent. If it was @mentioned and matches nothing, it says it doesn't know.
- Per-user cooldown (default 20s) prevents spam.
- Set `ANSWER_CHANNEL_IDS` to limit auto-answers to specific channels (e.g. a #help channel). @mentions work everywhere.

## Hosting
It needs to run 24/7. A small VPS, Railway, Fly.io, or a Raspberry Pi all work.
