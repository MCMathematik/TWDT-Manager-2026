
import { Player, Team, GameMap, MatchResult, Role, StrategyType, Rivalry } from '../types';
import { TAG_PREFIXES, TAG_SUFFIXES, LEGEND_TAGS, ROLES, STRATEGIES, TOTAL_SEASON_WEEKS } from '../constants';

export const createPlayer = (tier: 'Normal' | 'Legend' = 'Normal', overrideName?: string): Player => {
  const id = Math.random().toString(36).substr(2, 9);
  const role = ROLES[Math.floor(Math.random() * ROLES.length)];
  const age = Math.floor(Math.random() * 8) + 16;
  
  let gamertag = overrideName;
  let aim, iq, potential;

  if (!gamertag) {
    if (tier === 'Legend') {
      gamertag = LEGEND_TAGS[Math.floor(Math.random() * LEGEND_TAGS.length)];
    } else {
      const pre = TAG_PREFIXES[Math.floor(Math.random() * TAG_PREFIXES.length)];
      const suf = TAG_SUFFIXES[Math.floor(Math.random() * TAG_SUFFIXES.length)];
      gamertag = `${pre}${suf}${Math.random() > 0.5 ? Math.floor(Math.random() * 99) : ""}`;
    }
  }

  if (tier === 'Legend') {
    // Legends: 90-99 Aim, 85-99 IQ
    aim = Math.floor(Math.random() * 10) + 90;
    iq = Math.floor(Math.random() * 15) + 85;
    potential = Math.floor(Math.random() * 5) + 95;
  } else {
    // Normal: 49-85 for Aim and IQ
    aim = Math.floor(Math.random() * 37) + 49;
    iq = Math.floor(Math.random() * 37) + 49;
    potential = Math.max(49, Math.floor((aim + iq) / 2) + Math.floor(Math.random() * 15));
  }

  // Ensure stats don't exceed 99
  aim = Math.min(99, aim);
  iq = Math.min(99, iq);
  potential = Math.min(99, potential);

  const getOverall = (a: number, i: number, r: Role) => {
    if(r === 'Sniper') return Math.floor((a * 0.7) + (i * 0.3));
    if(r === 'Support') return Math.floor((a * 0.3) + (i * 0.7));
    return Math.floor((a * 0.5) + (i * 0.5));
  };

  const ovr = getOverall(aim, iq, role);
  let salary = 1;
  if (ovr > 90) salary = Math.floor(Math.random() * 10) + 40;
  else if (ovr > 80) salary = Math.floor(Math.random() * 10) + 20;
  else if (ovr > 70) salary = Math.floor(Math.random() * 10) + 8;
  else salary = Math.floor(Math.random() * 3) + 1;

  // Contract Logic: Dependent on cost/value
  // Expensive players (stars) demand long security (3 yrs).
  // Mid-tier players get 2 yrs.
  // Cheap players (rookies/low tier) get 1 yr.
  let years = 1;
  if (salary >= 40) {
    years = 3; 
  } else if (salary >= 15) {
    years = Math.random() > 0.4 ? 2 : 1;
  } else {
    years = 1;
  }

  return { 
    id, 
    gamertag: gamertag || "Unknown", 
    role, 
    age, 
    aim, 
    iq, 
    potential, 
    salary, 
    contractYears: years,
    morale: Math.floor(Math.random() * 21) + 75, // 75-95 Initial Morale
    originalStats: { aim, iq }
  };
};

export const getPlayerOverall = (p: Player): number => {
  if(p.role === 'Sniper') return Math.floor((p.aim * 0.7) + (p.iq * 0.3));
  if(p.role === 'Support') return Math.floor((p.aim * 0.3) + (p.iq * 0.7));
  return Math.floor((p.aim * 0.5) + (p.iq * 0.5));
};

export const getTeamOverall = (team: Team): number => {
  if (team.roster.length === 0) return 0;
  const starters = team.isPlayer 
    ? team.roster.slice(0, 5) 
    : [...team.roster].sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a)).slice(0, 5);
  
  if (starters.length === 0) return 0;
  return Math.floor(starters.reduce((sum, p) => sum + getPlayerOverall(p), 0) / starters.length);
};

export const getTeamEffectiveStrength = (team: Team, map: GameMap): number => {
  const starters = team.isPlayer 
    ? team.roster.slice(0, 5) 
    : [...team.roster].sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a)).slice(0, 5);
    
  if (starters.length === 0) return 0;

  let total = 0;
  starters.forEach(p => {
    let pOvr = getPlayerOverall(p);
    if (map.bonusRole && p.role === map.bonusRole) pOvr = Math.floor(pOvr * 1.15);
    
    // Morale modifier: <50 scales down to 0.9x, >90 scales up to 1.05x
    const moraleMod = 1 + ((p.morale - 75) / 500); // Mild influence
    pOvr = Math.floor(pOvr * moraleMod);
    
    total += pOvr;
  });
  
  let avg = Math.floor(total / starters.length);
  
  // Chemistry modifier: 0-100. 50 is neutral. 
  // 0 chem = 0.9x, 100 chem = 1.1x
  const chemMod = 0.9 + (team.chemistry / 500); 
  avg = Math.floor(avg * chemMod);

  if (team.staff["Head Coach"]) avg = Math.floor(avg * team.staff["Head Coach"]!.bonusVal);
  return avg;
};

export const getProratedSalary = (salary: number, week: number) => {
  const remainingWeeks = Math.max(0, TOTAL_SEASON_WEEKS - week + 1);
  return Math.floor((salary * remainingWeeks) / TOTAL_SEASON_WEEKS);
};

export const calculateCapUsed = (team: Team, week: number): number => {
  let total = team.roster.reduce((sum, p) => sum + getProratedSalary(p.salary, week), 0);
  if (team.staff["Accountant"]) total = Math.floor(total * (1 - team.staff["Accountant"]!.bonusVal));
  return total;
};

export const calculateTradeValue = (p: Player): number => {
  const ovr = getPlayerOverall(p);
  const ageFactor = Math.max(0, 26 - p.age); // Younger is better
  const potFactor = Math.max(0, p.potential - ovr);
  // Value OVR highly, then potential and contract stability
  return (ovr * 4) + (ageFactor * 2) + potFactor + (p.contractYears * 5);
};

// Returns new rivalry state for a team based on match result
export const updateRivalryState = (team: Team, opponentId: string, opponentName: string, scoreDiff: number, week: number): Rivalry[] => {
  const currentRivalries = [...(team.rivalries || [])];
  const existingIndex = currentRivalries.findIndex(r => r.opponentId === opponentId);
  
  let intensityChange = 0;
  let reason = "";

  // Logic for Intensity Change
  if (Math.abs(scoreDiff) <= 5) {
    intensityChange = 15;
    reason = "Close Match";
  } else if (Math.abs(scoreDiff) > 35) {
    intensityChange = 10;
    reason = "Blowout";
  } else {
    // Slight decay for boring matches if rivalry exists
    intensityChange = -2;
  }

  if (existingIndex !== -1) {
    const existing = currentRivalries[existingIndex];
    const newIntensity = Math.max(0, Math.min(100, existing.intensity + intensityChange));
    
    // Only update reason if intensity increased or it was empty
    const newReason = intensityChange > 0 ? reason : existing.reason;
    
    currentRivalries[existingIndex] = {
      ...existing,
      intensity: newIntensity,
      reason: newReason,
      lastEncounterWeek: week
    };
  } else if (intensityChange > 0) {
    // Create new rivalry
    currentRivalries.push({
      opponentId,
      opponentName,
      reason,
      intensity: intensityChange,
      lastEncounterWeek: week
    });
  }

  return currentRivalries.sort((a,b) => b.intensity - a.intensity);
};

export const simulateMatch = (home: Team, away: Team, map: GameMap, isPlayoff: boolean = false): MatchResult => {
  let homeStr = getTeamEffectiveStrength(home, map);
  let awayStr = getTeamEffectiveStrength(away, map);

  const homeStrat = home.strategy || "Rush";
  const awayStrat = away.strategy || (["Rush", "Control", "Trap"][Math.floor(Math.random() * 3)] as StrategyType);

  const hDef = STRATEGIES[homeStrat];
  const aDef = STRATEGIES[awayStrat];
  
  let counterMsg = "";
  const getCounterMult = (t: Team) => t.staff["Strategist"] ? t.staff["Strategist"]!.bonusVal : 1.10;

  if (hDef.counters === awayStrat) {
    const mult = getCounterMult(home);
    homeStr = Math.floor(homeStr * mult);
    counterMsg = `${homeStrat} countered ${awayStrat} (+${Math.floor((mult-1)*100)}%)`;
  } else if (aDef.counters === homeStrat) {
    const mult = getCounterMult(away);
    awayStr = Math.floor(awayStr * mult);
    counterMsg = `${awayStrat} countered ${homeStrat} (+${Math.floor((mult-1)*100)}%)`;
  }

  const homeScore = Math.max(10, Math.min(100, Math.floor(homeStr * 0.8) + 2 + Math.floor(Math.random() * 20) - 10));
  const awayScore = Math.max(10, Math.min(100, Math.floor(awayStr * 0.8) + Math.floor(Math.random() * 20) - 10));

  // --- Viewership Calculation ---
  let viewers = 5000; // Base
  
  // Star Power (OVR > 85)
  const homeStars = home.roster.filter(p => getPlayerOverall(p) > 85).length;
  const awayStars = away.roster.filter(p => getPlayerOverall(p) > 85).length;
  viewers += (homeStars + awayStars) * 1500;

  // Team Reputation (Wins)
  viewers += (home.wins + away.wins) * 200;

  // Rivalry Bonus
  const homeRivalry = (home.rivalries || []).find(r => r.opponentId === away.id);
  if (homeRivalry) {
    viewers += homeRivalry.intensity * 100;
  }

  // Playoff Hype
  if (isPlayoff) viewers *= 2;

  // Random Hype
  viewers += Math.floor(Math.random() * 3000);

  // Close Match Viral Bonus (Applied if score is close, simulates people tuning in late)
  if (Math.abs(homeScore - awayScore) <= 5) {
    viewers += 5000;
  }

  return {
    homeId: home.id,
    awayId: away.id,
    homeScore,
    awayScore: homeScore === awayScore ? awayScore - 1 : awayScore,
    winnerId: homeScore > awayScore ? home.id : away.id,
    counterMsg,
    map,
    homeStrat,
    awayStrat,
    viewership: Math.floor(viewers)
  };
};