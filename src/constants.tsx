
import { Role, GameMap, StrategyType, StaffRole } from './types';

export const TOTAL_SEASON_WEEKS = 14;

export const GAME_PLAYLIST = [
    "https://www.dropbox.com/scl/fi/4o9o0myqg3n5vx7oz5sfv/Dameon-Angell-TWDT-Manager-Background-Music.wav?rlkey=6uaist684p5j6e8k0aj69els1&st=ejvtzwbh&raw=1",
    "https://www.dropbox.com/scl/fi/4caawv6nxdjiaupxnp6d1/Dameon-Angell-TWDT-Manager-Background-Music-2.wav?rlkey=mhawqyw1i6myotbnsh4fg50hr&st=vyfa9k2i&raw=1",
    "https://www.dropbox.com/scl/fi/xx180vu1c1fpsefwb29j1/Dameon-Angell-TWDT-Manager-Background-Music-3.wav?rlkey=4g5dwazfz8r3qeb7nglxnbm2l&st=63jh841x&raw=1",
    "https://www.dropbox.com/scl/fi/vpxi900yxqowrdn8tyg4s/Dameon-Angell-TWDT-Manager-Background-Music-4.wav?rlkey=1v9jfdo3e4nc30ai8hvqx3a4l&st=il5eigzj&raw=1",
    "https://www.dropbox.com/scl/fi/p0mc0a38lvhcpa8pbcrf5/Dameon-Angell-TWDT-Manager-Background-Music-5.wav?rlkey=zn0jexts3ym40cqad1w9d09hu&st=kxz75en3&raw=1",
    "https://www.dropbox.com/scl/fi/chc3owvovut4r1d00gqs6/Dameon-Angell-TWDT-Manager-JP-Lyrics.wav?rlkey=73t9tx59v4ezafo9ss8a0pos6&st=yc2hvr5k&raw=1"
];

export const TAG_PREFIXES = ["Shadow", "Void", "Ghost", "Neon", "Cyber", "Dark", "Light", "Iron", "Steel", "Venom", "Frost", "Blaze", "Storm", "Viper", "Rogue", "Elite", "Pro", "X", "Zero", "Alpha"];
export const TAG_SUFFIXES = ["Wolf", "Ops", "Slayer", "King", "God", "Bot", "Aim", "Shot", "Strike", "Force", "Squad", "Clan", "Reaper", "Phantom", "Spectre", "Knight", "Ninja", "Samurai"];
export const LEGEND_TAGS = ["Shroud", "Faker", "S1mple", "Ninja", "Tenz", "Scump", "Crimsix", "Karma", "Hiko", "Device", "Niko", "Zywoo", "Coldzera"];
export const SQUAD_NAMES_PRESETS = [
    "Power", "Pwned.nL", "Terrorist", "Monster", "Force", "Pure Luck", "DiCE", "Prime", "sk8", "Spastic", "Pallies", "Pirates", "Disoblige", "Veloce", "Dragonguard", "PUMA", "Anti-Scrub", "Rejected Basers", "TeKs", "Paladen", "-FINAL-", "Grapevine"
];

export const REAL_PLAYER_NAMES = [
    "bike", "Turban", "Commodo", "Creature", "Mikkiz", "animeboy12", "Riverside", "Tripin", "Bad Badger",
    "TJ hazuki", "Hercules", "Captor", "Henry Saari", "retroaction", "Sunny DBZaiti", "Product", "Dutch Baser",
    "Sk", "Da Paz", "Sulla", "Cyclone", "berzerk", "Rampage", "Bombed", "Rough", "Cintra", "Cig Smoke",
    "bick", "Best", "Geio", "Clark Kentaro", "rucci", "Hasbulla", "Beast", "Pawner", "Cow Lives Matter",
    "Harder", "gbone", "DBZ", "Draft", "deathclown420", "dak", "Azuline", "siaxis", "nbsIDE Domu",
    "download", "MythriL", "hellkite", "Bacon", "Mercede$", "Refer", "Raazi", "SpookedOne", "CZ530",
    "Jz", "Spectacular", "Rylo", "Rekashi", "Ixador", "Dameon Angell", "dmr", "Rainbow Seeker", "beam",
    "Aprix", "Rodney", "absurd", "Tiny", "MousE", "Winterfell", "Morph", "Lee", "Shayde", "sarger",
    "FieryFire", "Flew", "Groan", "kesser", "100", "Paradise", "Scuzzy Sureshot", "Shaw", "Peru", "Cape",
    "Skatarius", "menelvagor", "Stayon", "Markmru", "clefairy27", "HellzNo!", "Kangal", "okyo", "JAMAL",
    "Temujin", "PH", "Rabbit!", "Kado", "Pressure", "Brunson", "Public Assassin", "booker007", "Shaun",
    "ibex", "ABo", "InFaMouS", "apt", "Telemanus", "Violence", "Jessup", "RaCka", "JURASSIC", "Ekko",
    "Iron Survivor", "Hulk", "Spirit", "Rasaq", "Vehicle", "Jack", "Zeebu", "X-Demo", "Cyris", "i.d.",
    "Source", "The Boogieman", "Revolution", "Money", "Glyde", "Omega Red", "lockdown", "Flying Bass",
    "Zidane", "Heafin", "Sword", "Cripple", "yeh", "WillBy", "Spawnisen", "Dad", "Warthog", "RENZI",
    "Ogron", "jabra", "Zizzo", "dare", "Ra", "rabbit", "Liz", "JuNkA", "Honcho", "delos", "Invincible",
    "Gho$tFace-", "Dreamwin", "banzi", "Havok", "Zizu", "maketso", "autopilot", "Christian10", "mvp",
    "Frozen Throne", "Joeses", "ZapaTa", "Captain Lonestar", "Reaver", "Paky Dude", "Ardour", "Oderus Urungus",
    "Charas", "Kuukunen", "Coupe", "Celly", "NiGhToWL", "y0gi"
];

export const ROLES: Role[] = ["Rusher", "Sniper", "Support", "Flanker", "Anchor"];

export const ROLE_COLORS: Record<Role, { text: string, bg: string, border: string }> = {
    "Rusher": { text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    "Sniper": { text: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    "Support": { text: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    "Flanker": { text: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    "Anchor": { text: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20" }
};

export const MAPS: GameMap[] = [
    { name: "Training Grounds", type: "Standard", bonusRole: null, desc: "No specific advantages." },
    { name: "Neon Slums", type: "CQC", bonusRole: "Rusher", desc: "+15% to Rushers" },
    { name: "Iron Heights", type: "Long Range", bonusRole: "Sniper", desc: "+15% to Snipers" },
    { name: "Bio-Lab 4", type: "Technical", bonusRole: "Support", desc: "+15% to Support" },
    { name: "Void Station", type: "Flank Heavy", bonusRole: "Flanker", desc: "+15% to Flankers" },
    { name: "Bunker Zero", type: "Defensive", bonusRole: "Anchor", desc: "+15% to Anchors" }
];

export const STRATEGIES: Record<StrategyType, { name: string, counters: StrategyType, weakTo: StrategyType, desc: string }> = {
    "Rush": { name: "Rush", counters: "Control", weakTo: "Trap", desc: "Aggressive push. Beats Control." },
    "Control": { name: "Control", counters: "Trap", weakTo: "Rush", desc: "Slow map control. Beats Trap." },
    "Trap": { name: "Trap", counters: "Rush", weakTo: "Control", desc: "Defensive setups. Beats Rush." }
};

export const STAFF_DEFS: Record<StaffRole, { icon: string, color: string, desc: string }> = {
    "Head Coach": { icon: "fa-user-tie", color: "text-blue-400", desc: "Increases Team OVR during matches." },
    "Recruiter": { icon: "fa-search", color: "text-purple-400", desc: "Reduces signing cost of Free Agents." },
    "Strategist": { icon: "fa-chess", color: "text-yellow-400", desc: "Boosts tactical counter bonus." },
    "Accountant": { icon: "fa-file-invoice-dollar", color: "text-green-400", desc: "Reduces team salary cap usage." },
    "Community Manager": { icon: "fa-bullhorn", color: "text-pink-400", desc: "Increases sponsorship earnings." }
};