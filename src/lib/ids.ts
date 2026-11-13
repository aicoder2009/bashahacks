import { randomBytes, randomInt } from "crypto";

const ALNUM = "abcdefghijkmnpqrstuvwxyz23456789";
// Consonants only, so random codes never spell a word.
const CODE = "BCDFGHJKMNPQRSTVWXZ";

export function randomId(len = 16): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALNUM[bytes[i] % ALNUM.length];
  return out;
}

export function randomCode(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE[randomInt(CODE.length)];
  return out;
}

export function randomDigits(len = 2): string {
  let out = "";
  for (let i = 0; i < len; i++) out += String(randomInt(10));
  return out;
}

const ADJ = [
  "Mossy", "Solar", "Breezy", "Leafy", "Sunny", "Rainy", "Wild", "Bright", "Mighty", "Gentle",
  "Clever", "Swift", "Golden", "Misty", "Rooted", "Blooming", "Tidal", "Cosmic", "Fuzzy", "Brave",
];
const NOUN = [
  "Otters", "Sprouts", "Cacti", "Bees", "Turtles", "Foxes", "Owls", "Pandas", "Ferns", "Acorns",
  "Dolphins", "Sparrows", "Koalas", "Beavers", "Fireflies", "Lizards", "Herons", "Bobcats", "Pines", "Coyotes",
];

export function randomTeamName(): string {
  return `${ADJ[randomInt(ADJ.length)]} ${NOUN[randomInt(NOUN.length)]}`;
}

export function randomSlug(): string {
  const a = ADJ[randomInt(ADJ.length)].toLowerCase();
  const n = NOUN[randomInt(NOUN.length)].toLowerCase();
  return `${a}-${n}-${randomDigits(3)}`;
}
