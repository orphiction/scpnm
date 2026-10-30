// Run with: npm test
// Checks sample messages against faq.json. Add your own lines to CASES when you
// add new questions. Use null as the expected name when the bot should stay silent.
const fs = require("fs");
const path = require("path");
const { findAnswer } = require("./matcher");

const faq = JSON.parse(fs.readFileSync(path.join(__dirname, "faq.json"), "utf8"));
const byAnswer = new Map(faq.map((e) => [e.answer, e.name]));

const CASES = [
  // [message, expected entry name or null]
  ["How much will the game cost?", "price"],
  ["HOW MUCH DOES IT COST", "price"],
  ["whats the price", "price"],
  ["how much is it", "price"],
  ["is the game free?", "price"],
  ["Can I playtest the game?", "playtest"],
  ["how do i playtest", "playtest"],
  ["is there a demo?", "playtest"],
  ["is there a free demo coming?", "playtest"],
  ["is there a beta", "playtest"],
  ["Can I get a playtest key?", "playtest-key"],
  ["how do i get a key", "playtest-key"],
  ["how do I get into the playtest", "playtest-key"],
  ["are there any playtest keys left?", "playtest-key"],
  ["When will the game release?", "release-date"],
  ["when is it coming out?", "release-date"],
  ["release date?", "release-date"],
  ["when does the game come out", "release-date"],
  ["How many SCPs are in the game?", "scp-count"],
  ["which scps are you planning on adding?", "scp-count"],
  ["Will there be a sandbox or campaign mode?", "modes"],
  ["is there a campaign", "modes"],
  ["what gamemodes are there?", "modes"],
  ["Will Groups of Interest be in the game?", "goi"],
  ["will the chaos insurgency be in the game?", "goi"],
  ["is GOC in the game", "goi"],
  ["Will the game be multiplayer?", "multiplayer"],
  ["is it multiplayer", "multiplayer"],
  ["will there be co-op?", "multiplayer"],
  ["can i play with friends?", "multiplayer"],
  ["Will the game have continuous updates?", "updates"],
  ["will there be updates", "updates"],
  ["will you keep updating it?", "updates"],
  ["will you support the game after launch?", "updates"],
  ["Is this a building game?", "building"],
  ["can i build underground?", "building"],
  ["can I design my own facility", "building"],
  ["Will departments be in the game?", "departments"],
  ["will the 05 council be in the game?", "departments"],
  ["will the O5 council be in it", "departments"],
  ["Will the game release on consoles?", "consoles"],
  ["will it be on xbox?", "consoles"],
  ["is it coming to playstation", "consoles"],
  ["Can I mod the game?", "mods"],
  ["Will i be able to mod the game?", "mods"],
  ["Will there be mods?", "mods"],
  ["will there be mod support", "mods"],
  ["is there modding?", "mods"],
  ["Who is the dev?", "dev"],
  ["whos the developer", "dev"],
  ["who made this game?", "dev"],
  ["Who is the doorman?", "doorman"],
  ["who's the doorman", "doorman"],
  ["WHO IS THE DOORMAN?", "doorman"],
  // Should stay silent
  ["hello everyone how are you doing today?", null],
  ["how do i get a role?", null],
  ["who are the mods?", null],
  ["what's the best scp?", null],
  ["anyone want to play something else tonight?", null],
  ["how much is a patreon sub?", null],
];

let failed = 0;
for (const [msg, expected] of CASES) {
  const answer = findAnswer(msg, faq);
  const got = answer === null ? null : byAnswer.get(answer);
  if (got !== expected) {
    failed++;
    console.log(`FAIL  "${msg}"  expected ${expected}, got ${got}`);
  }
}
console.log(`${CASES.length - failed}/${CASES.length} passed`);
process.exit(failed ? 1 : 0);
