export type Role = "Rusher" | "Sniper" | "Support" | "Flanker" | "Anchor";
export type StrategyType = "Rush" | "Control" | "Trap";
export type StaffRole = "Head Coach" | "Recruiter" | "Strategist" | "Accountant" | "Community Manager";
export type LogoShape = 'square' | 'rounded' | 'circle' | 'hexagon';
export type LogoGradient = 'linear' | 'radial' | 'conic';

export interface Player {
  id: string;
  gamertag: string;
  role: Role;
  age: number;
  aim: number;
  iq: number;
  potential: number;
  salary: number;
  contractYears: number;
  morale: number;
  previousTeamId?: string;
  originalStats?: { aim: number; iq: number };
}

export interface StaffMember {
  name: string;
  tier: "Bronze" | "Silver" | "Gold" | "Prismatic";
  bonusVal: number;
}

export interface Rivalry {
  opponentId: string;
  opponentName: string;
  reason: string;
  intensity: number; // 1-100
  lastEncounterWeek?: number;
}

export interface SocialPost {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  likes: number;
  isVerified?: boolean;
}

export interface Team {
  id: string;
  name: string;
  title: string;
  isPlayer: boolean;
  colors: { primary: string; secondary: string };
  logoConfig: {
    shape: LogoShape;
    gradient: LogoGradient;
  };
  roster: Player[];
  budget: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  championships: number;
  strategy: StrategyType;
  trainingCounts: { aim: number; iq: number; teamBuilding: number };
  staff: Partial<Record<StaffRole, StaffMember | null>>;
  rivalries: Rivalry[];
  chemistry: number;
  tradeRefusals: number;
}

export interface GameMap {
  name: string;
  type: string;
  bonusRole: Role | null;
  desc: string;
}

export interface MatchResult {
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  winnerId: string;
  counterMsg: string;
  map: GameMap;
  homeStrat: StrategyType;
  awayStrat: StrategyType;
  viewership: number;
}

export interface ScheduleMatch {
  homeId: string;
  awayId: string;
  result?: MatchResult;
}

export type SeasonSchedule = Record<number, ScheduleMatch[]>;

export interface SeasonState {
  week: number;
  year: number;
  season: number;
  isDrafting: boolean;
  mode: 'standard' | 'dynasty';
  playoffStage?: 'semis' | 'finals' | 'complete';
  playoffMatches?: {
    semis: ScheduleMatch[];
    finals: ScheduleMatch[];
  };
}