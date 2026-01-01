
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Player, Team, SeasonState, MatchResult, StrategyType, StaffRole, LogoShape, LogoGradient, SeasonSchedule, ScheduleMatch, SocialPost } from './types';
import { createPlayer, simulateMatch, getTeamOverall, getPlayerOverall, calculateCapUsed, getProratedSalary, calculateTradeValue, updateRivalryState } from './logic/gameEngine';
import { GAME_PLAYLIST, SQUAD_NAMES_PRESETS, MAPS, STAFF_DEFS, ROLE_COLORS, TOTAL_SEASON_WEEKS, REAL_PLAYER_NAMES } from './constants';
import { getMatchSummary } from '../services/geminiService';

const AVAILABLE_TITLES = [
  { id: 'rookie', label: 'Rookie Captain', minWins: 0 },
  { id: 'new-blood', label: 'New Blood', minWins: 0 },
  { id: 'draft-pick', label: 'Draft Pick', minWins: 0 },
  { id: 'winner', label: 'Tournament Winner', minWins: 1 },
  { id: 'leader', label: 'Proven Leader', minWins: 1 },
  { id: 'king', label: 'Dynasty King', minWins: 3 },
  { id: 'legend', label: 'Subspace Legend', minWins: 5 },
  { id: 'goat', label: 'The G.O.A.T.', minWins: 10 },
];

const CANDIDATE_NAMES = ["Jax 'Neon' Vance", "Sera 'Zero' Chen", "Kael 'Shadow' Thorne", "Elena 'Bolt' Rossi", "Marcus 'Tank' Sterling", "Yuki 'Ghost' Tanaka", "Riven 'Blade' Cross", "Odin 'Void' Miller"];

const OWNER_OBJECTIVES = [
  "Reach the Championship Finals.",
  "Secure at least 8 wins in the regular season.",
  "Finish with a positive K/D differential.",
  "Draft at least one Pilot with OVR 85+.",
  "Successfully train the squad 5 times.",
  "Defeat your primary rival in the regular season.",
  "Maintain a budget surplus of at least $50k."
];

const LOADING_QUIPS = [
  "Matchbot12 is analyzing the match",
  "MMRBot3 is putting Pawner on your team",
  "Spec chat is popping off right now!",
  "Mandela Effect Spawn Activity Detected",
  "Ogron about to roast you in Hot or Not",
  "Ogron about to praise you in Hot or Not",
  "Bad Badger's lag is causing havoc"
];

const SOCIAL_HANDLES = ["@TrenchInsider", "@SubspaceDaily", "@ZoneNews", "@DraftCentral", "@FragReporter", "@LeagueOps"];
const SMACK_TALK_TEMPLATES = [
  "Imagine being a fan of {team}. Couldn't be me. 💀",
  "{team} needs to disband after that performance.",
  "Someone tell {team} that the goal is to win.",
  "{team} is basically a free win this season.",
  "I've seen better aim from a turret bot than {team}.",
  "Why is {team} even in the league? #TrenchWars",
];
const NEWS_TEMPLATES = [
  "Rumor: {team} is looking to trade their star player.",
  "Analysts predicting a strong finish for {team} this cycle.",
  "Ticket sales for the finals are already sold out! #HYPE",
  "Patch 4.2 notes: Snipers getting a nerf? Opinions?",
  "Scouts reporting deep talent pool in the upcoming draft class.",
  "Sponsorship deals are skyrocketing for top teams.",
];

const STAFF_BONUS_DESCS: Record<StaffRole, string[]> = {
  "Head Coach": ["+2% Match OVR", "+5% Match OVR", "+10% Match OVR", "+15% Match OVR"],
  "Recruiter": ["-5% Signing Costs", "-10% Signing Costs", "-20% Signing Costs", "-35% Signing Costs"],
  "Strategist": ["15% Counter Power", "20% Counter Power", "25% Counter Power", "35% Counter Power"],
  "Accountant": ["-5% Cap Hit", "-10% Cap Hit", "-15% Cap Hit", "-25% Cap Hit"],
  "Community Manager": ["+10% Match Earnings", "+25% Match Earnings", "+50% Match Earnings", "+100% Match Earnings"]
};

// Helper to shuffle draft order
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export default function App() {
  // --- Game State ---
  const [view, setView] = useState<'title' | 'onboarding' | 'draft' | 'dashboard' | 'briefing' | 'options' | 'seasonSummary' | 'gameOver'>('title');
  const [activeTab, setActiveTab] = useState('overview');
  const [teams, setTeams] = useState<Team[]>([]);
  const [playerTeamId, setPlayerTeamId] = useState<string>('');
  const [season, setSeason] = useState<SeasonState>({ week: 1, year: 2026, season: 1, isDrafting: true, mode: 'standard' });
  const [schedule, setSchedule] = useState<SeasonSchedule>({});
  const [draftPool, setDraftPool] = useState<Player[]>([]);
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [socialFeed, setSocialFeed] = useState<SocialPost[]>([]);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [currentPickIdx, setCurrentPickIdx] = useState(0);
  const [isAutoDraft, setIsAutoDraft] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [draftLog, setDraftLog] = useState<{ round: number, team: string, teamId: string, player: string, overall: number }[]>([]);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [careerChampionships, setCareerChampionships] = useState(0);
  const [pendingPlayoffAnnouncement, setPendingPlayoffAnnouncement] = useState(false);
  const [showOwnerWelcome, setShowOwnerWelcome] = useState(false);
  const [currentObjectives, setCurrentObjectives] = useState<string[]>([]);
  const [inspectTeamId, setInspectTeamId] = useState<string | null>(null);
  const [trainingResult, setTrainingResult] = useState<{ success: boolean, stat: 'aim' | 'iq' | 'chem', changes: { pilot: string, delta: number }[] } | null>(null);
  
  // Dynasty Mode Specific State
  const [expiringContracts, setExpiringContracts] = useState<Player[]>([]);
  const [staffReport, setStaffReport] = useState<string[]>([]);

  // Trading State
  const [tradeModal, setTradeModal] = useState<{ targetTeamId: string } | null>(null);
  const [myTradeOffer, setMyTradeOffer] = useState<string[]>([]);
  const [theirTradeOffer, setTheirTradeOffer] = useState<string[]>([]);

  // Drag and Drop State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // Onboarding Temp State
  const [obName, setObName] = useState('Alpha Squad');
  const [obTitle, setObTitle] = useState('Rookie Captain');
  const [obPrimary, setObPrimary] = useState('#10b981');
  const [obSecondary, setObSecondary] = useState('#3f3f46');
  const [obShape, setObShape] = useState<LogoShape>('rounded');
  const [obGradient, setObGradient] = useState<LogoGradient>('linear');

  // Modals & UI
  const [alert, setAlert] = useState<{ title: string, desc: string } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string, desc: string, onConfirm: () => void } | null>(null);
  const [showResult, setShowResult] = useState<{ result: MatchResult, earnings: number, viewership: number, recap: string } | null>(null);
  const [recruitmentRole, setRecruitmentRole] = useState<StaffRole | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Audio & Vol
  const titleAudio = useRef<HTMLAudioElement>(null);
  const gameAudio = useRef<HTMLAudioElement>(null);
  const [musicOn, setMusicOn] = useState(true); 
  const [volume, setVolume] = useState(0.5);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [audioStarted, setAudioStarted] = useState(false);

  const playerTeam = teams.find(t => t.id === playerTeamId);
  const inspectedTeam = teams.find(t => t.id === inspectTeamId);
  const tradeTargetTeam = teams.find(t => t.id === tradeModal?.targetTeamId);

  // Standings Calculation
  const sortedStandings = useMemo(() => {
    return [...teams].sort((a, b) => b.wins - a.wins || (b.kills - b.deaths) - (a.kills - a.deaths));
  }, [teams]);

  // Financial Calculations
  const totalCommitments = useMemo(() => {
    if (!playerTeam) return 0;
    return calculateCapUsed(playerTeam, season.week);
  }, [playerTeam?.roster, playerTeam?.staff, season.week]);

  const availableFunds = useMemo(() => {
    if (!playerTeam) return 0;
    return playerTeam.budget - totalCommitments;
  }, [playerTeam?.budget, totalCommitments]);

  // Determine Next Opponent
  const nextOpponent = useMemo(() => {
    if (!playerTeamId) return null;
    
    // Playoff Logic
    if (season.playoffStage === 'semis' && season.playoffMatches?.semis) {
      const match = season.playoffMatches.semis.find(m => m.homeId === playerTeamId || m.awayId === playerTeamId);
      if (!match) return null;
      return teams.find(t => t.id === (match.homeId === playerTeamId ? match.awayId : match.homeId)) || null;
    }
    if (season.playoffStage === 'finals' && season.playoffMatches?.finals) {
      const match = season.playoffMatches.finals.find(m => m.homeId === playerTeamId || m.awayId === playerTeamId);
      if (!match) return null;
      return teams.find(t => t.id === (match.homeId === playerTeamId ? match.awayId : match.homeId)) || null;
    }

    // Regular Season
    if (schedule[season.week]) {
      const match = schedule[season.week].find(m => m.homeId === playerTeamId || m.awayId === playerTeamId);
      if (!match) return null;
      const opponentId = match.homeId === playerTeamId ? match.awayId : match.homeId;
      return teams.find(t => t.id === opponentId) || null;
    }
    return null;
  }, [schedule, season.week, season.playoffStage, season.playoffMatches, playerTeamId, teams]);

  // Check if player is qualified for current playoff round
  const isPlayerInHunt = useMemo(() => {
    if (!season.playoffStage) return true;
    if (season.playoffStage === 'semis') {
      return !!season.playoffMatches?.semis.find(m => m.homeId === playerTeamId || m.awayId === playerTeamId);
    }
    if (season.playoffStage === 'finals') {
      return !!season.playoffMatches?.finals.find(m => m.homeId === playerTeamId || m.awayId === playerTeamId);
    }
    return false;
  }, [season.playoffStage, season.playoffMatches, playerTeamId]);

  // Loading Message Logic
  const loadingMessage = useMemo(() => {
    return LOADING_QUIPS[Math.floor(Math.random() * LOADING_QUIPS.length)];
  }, [isSimulating]);

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('twdt_save_v6');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.careerChampionships !== undefined) {
          setCareerChampionships(data.careerChampionships);
        }
        setHasSave(true);
      } catch (e) {
        console.error("Save file corrupted", e);
        setHasSave(false);
      }
    }

    const handleFirstInteraction = () => {
      setAudioStarted(true);
      window.removeEventListener('mousedown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('mousedown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    
    return () => {
      window.removeEventListener('mousedown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  const loadGame = () => {
    const saved = localStorage.getItem('twdt_save_v6');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // Data Migration: Ensure old saves have all required fields to prevent crashes
        const migratedTeams = (data.teams || []).map((t: any) => ({
            ...t,
            trainingCounts: { aim: 0, iq: 0, teamBuilding: 0, ...(t.trainingCounts || {}) },
            chemistry: t.chemistry !== undefined ? t.chemistry : 50,
            rivalries: t.rivalries || [],
            staff: t.staff || {},
            tradeRefusals: t.tradeRefusals || 0,
            wins: t.wins || 0,
            losses: t.losses || 0,
            roster: (t.roster || []).map((p: any) => ({
                ...p,
                role: p.role === 'Medic' ? 'Support' : p.role, // Migration: Medic -> Support
                originalStats: p.originalStats || { aim: p.aim, iq: p.iq }
            }))
        }));
        
        // Migrate Free Agents as well
        const migratedFreeAgents = (data.freeAgents || []).map((p: any) => ({
            ...p,
            role: p.role === 'Medic' ? 'Support' : p.role
        }));
        
        setTeams(migratedTeams);
        setPlayerTeamId(data.playerTeamId);
        setSeason(data.season || { week: 1, year: 2026, season: 1, isDrafting: true, mode: 'standard' });
        setSchedule(data.schedule || {});
        setFreeAgents(migratedFreeAgents);
        setSocialFeed(data.socialFeed || []);
        setCareerChampionships(data.careerChampionships || 0);
        setView(data.view || 'dashboard');
      } catch (e) {
        console.error("Failed to load game", e);
        setAlert({ title: "Load Error", desc: "The save file is corrupted and could not be loaded." });
      }
    }
  };

  useEffect(() => {
    if (view !== 'title' && view !== 'onboarding' && view !== 'options') {
      const state = { teams, playerTeamId, season, schedule, freeAgents, socialFeed, view, careerChampionships };
      localStorage.setItem('twdt_save_v6', JSON.stringify(state));
      setHasSave(true);
    }
  }, [teams, playerTeamId, season, schedule, freeAgents, socialFeed, view, careerChampionships]);

  // --- Audio Logic ---
  useEffect(() => {
    if (!audioStarted || !musicOn) {
      titleAudio.current?.pause();
      gameAudio.current?.pause();
      return;
    }

    const isTitleView = (view === 'title' || view === 'onboarding' || view === 'options');
    
    if (isTitleView) {
      gameAudio.current?.pause();
      if (titleAudio.current) {
        titleAudio.current.volume = volume;
        titleAudio.current.play().catch(() => {});
      }
    } else {
      titleAudio.current?.pause();
      if (gameAudio.current) {
        gameAudio.current.volume = volume;
        if (gameAudio.current.paused) {
          gameAudio.current.play().catch(() => {});
        }
      }
    }
  }, [musicOn, view, volume, audioStarted, currentTrackIdx]);

  const handleTrackEnded = () => {
    setCurrentTrackIdx((prev) => (prev + 1) % GAME_PLAYLIST.length);
  };

  // --- Helpers ---
  const addSocialPost = (post: { author: string; content: string; timestamp: string; isVerified?: boolean }) => {
    const newPost: SocialPost = {
      id: Math.random().toString(36).substring(2, 9),
      likes: Math.floor(Math.random() * 50),
      ...post
    };
    setSocialFeed(prev => [newPost, ...prev].slice(0, 50));
  };

  const checkObjective = (obj: string): boolean => {
      if (!playerTeam) return false;
      if (obj.includes("Finals")) return (season.playoffMatches?.finals.length || 0) > 0;
      if (obj.includes("8 wins")) return playerTeam.wins >= 8;
      if (obj.includes("positive K/D")) return (playerTeam.kills - playerTeam.deaths) > 0;
      if (obj.includes("OVR 85+")) return draftLog.some(l => l.teamId === playerTeamId && l.overall >= 85);
      if (obj.includes("train")) return (playerTeam.trainingCounts.aim + playerTeam.trainingCounts.iq + (playerTeam.trainingCounts.teamBuilding || 0)) >= 5; 
      if (obj.includes("successfully train")) return playerTeam.chemistry >= 80;
      if (obj.includes("budget")) return playerTeam.budget >= 50;
      if (obj.includes("primary rival")) {
          if (!playerTeam.rivalries || playerTeam.rivalries.length === 0) return true; 
          const rival = playerTeam.rivalries[0];
          const matches = (Object.values(schedule).flat() as ScheduleMatch[]).filter(m => 
              m.result && 
              ((m.homeId === playerTeamId && m.awayId === rival.opponentId) || 
               (m.awayId === playerTeamId && m.homeId === rival.opponentId))
          );
          return matches.some(m => m.result?.winnerId === playerTeamId);
      }
      return false;
  };

  useEffect(() => {
    if (view !== 'dashboard' || teams.length === 0) return;

    const generatePost = () => {
        const rand = Math.random();
        if (rand > 0.4) return;

        const type = Math.random();
        let author = SOCIAL_HANDLES[Math.floor(Math.random() * SOCIAL_HANDLES.length)];
        let content = "";
        let verified = true;

        if (type < 0.4) {
            const targetTeam = teams[Math.floor(Math.random() * teams.length)];
            content = SMACK_TALK_TEMPLATES[Math.floor(Math.random() * SMACK_TALK_TEMPLATES.length)].replace('{team}', targetTeam.name);
            author = `@Fan_${Math.floor(Math.random() * 1000)}`;
            verified = false;
        } else if (type < 0.7) {
            const targetTeam = teams[Math.floor(Math.random() * teams.length)];
            content = NEWS_TEMPLATES[Math.floor(Math.random() * NEWS_TEMPLATES.length)].replace('{team}', targetTeam.name);
        } else {
            const randomTeam = teams[Math.floor(Math.random() * teams.length)];
            if (randomTeam.roster.length > 0) {
                const player = randomTeam.roster[Math.floor(Math.random() * randomTeam.roster.length)];
                author = `@${player.gamertag.replace(/\s+/g, '')}`;
                const chatter = [
                    "Feeling good about the next match.",
                    "Anyone want to scrim?",
                    "Just hit a crazy clip in pubs.",
                    "Training camp is brutal today.",
                    `Shoutout to my squad ${randomTeam.name}!`
                ];
                content = chatter[Math.floor(Math.random() * chatter.length)];
                verified = player.potential > 80;
            } else {
                return; 
            }
        }

        addSocialPost({ author, content, timestamp: 'Just now', isVerified: verified });
    };

    const interval = setInterval(generatePost, 15000); 
    return () => clearInterval(interval);
  }, [view, teams]);


  // --- Handlers ---
  const generateSeasonSchedule = (allTeams: Team[]): SeasonSchedule => {
    const teamIds = allTeams.map(t => t.id);
    const numTeams = teamIds.length;
    const weeks: SeasonSchedule = {};
    for (let w = 1; w <= TOTAL_SEASON_WEEKS; w++) {
      const matches: ScheduleMatch[] = [];
      const cycle = (w - 1) % (numTeams - 1);
      for (let i = 0; i < numTeams / 2; i++) {
        const homeIdx = i;
        const awayIdx = numTeams - 1 - i;
        const rotate = (idx: number, step: number, total: number) => {
          if (idx === 0) return 0;
          return (idx - 1 + step) % (total - 1) + 1;
        };
        const t1 = teamIds[rotate(homeIdx, cycle, numTeams)];
        const t2 = teamIds[rotate(awayIdx, cycle, numTeams)];
        if (Math.floor((w - 1) / (numTeams - 1)) % 2 === 0) {
          matches.push({ homeId: t1, awayId: t2 });
        } else {
          matches.push({ homeId: t2, awayId: t1 });
        }
      }
      weeks[w] = matches;
    }
    return weeks;
  };

  const generateObjectives = () => {
    return shuffleArray(OWNER_OBJECTIVES).slice(0, 3);
  };

  const initGame = (name: string, title: string, primary: string, secondary: string, shape: LogoShape, gradient: LogoGradient, mode: 'standard' | 'dynasty') => {
    const pTeam: Team = {
      id: 'player-squad',
      name,
      title,
      isPlayer: true,
      colors: { primary, secondary },
      logoConfig: { shape, gradient },
      roster: [],
      budget: 250,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      championships: careerChampionships,
      strategy: 'Rush',
      trainingCounts: { aim: 0, iq: 0, teamBuilding: 0 },
      staff: {},
      rivalries: [],
      chemistry: 50,
      tradeRefusals: 0
    };

    const cpuTeams: Team[] = SQUAD_NAMES_PRESETS.slice(0, 7).map((n, i) => ({
      id: `cpu-${i}`,
      name: n,
      title: 'Rival Captain',
      isPlayer: false,
      colors: { primary: '#' + Math.floor(Math.random()*16777215).toString(16), secondary: '#333' },
      logoConfig: { shape: 'rounded', gradient: 'linear' },
      roster: [],
      budget: 250,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      championships: 0,
      strategy: 'Rush',
      trainingCounts: { aim: 0, iq: 0, teamBuilding: 0 },
      staff: {},
      rivalries: [],
      chemistry: 60 + Math.floor(Math.random() * 20),
      tradeRefusals: 0
    }));

    const allTeams = [pTeam, ...cpuTeams];
    setTeams(allTeams);
    setPlayerTeamId(pTeam.id);
    setSeason({ week: 1, year: 2026, season: 1, isDrafting: true, mode });
    setSchedule(generateSeasonSchedule(allTeams));
    addSocialPost({
      author: 'TWDT_Insider',
      content: `A new season of TWDT begins! ${name} joins the league as the newest contender. #TrenchWars`,
      timestamp: 'Just now',
      isVerified: true
    });

    // Create named players first
    const namedPlayers = REAL_PLAYER_NAMES.map(name => createPlayer(Math.random() < 0.15 ? 'Legend' : 'Normal', name));
    // Fill the rest if necessary, though list is large enough
    const remainingSlots = 120 - namedPlayers.length;
    const randomPlayers = remainingSlots > 0 ? Array.from({ length: remainingSlots }, (_, i) => createPlayer(i < 8 ? 'Legend' : 'Normal')) : [];
    
    const pool = [...namedPlayers, ...randomPlayers].sort((a,b) => getPlayerOverall(b) - getPlayerOverall(a));
    setDraftPool(pool);

    const shuffledTeamsForDraft = shuffleArray(allTeams);
    const order: string[] = [];
    for(let r=0; r<8; r++) {
      const round = r % 2 === 0 ? shuffledTeamsForDraft : [...shuffledTeamsForDraft].reverse();
      round.forEach((t: any) => order.push(t.id));
    }
    setDraftOrder(order);
    setCurrentPickIdx(0);
    setCurrentObjectives(generateObjectives());
    setShowOwnerWelcome(true);
    setView('draft');
    setIsAutoDraft(false);
    setDraftLog([]);
    setTimeLeft(300);
  };

  const startNextSeason = () => {
     let updatedTeams = teams.map(t => {
       if (season.mode === 'standard') {
         return { 
           ...t, 
           roster: [],
           budget: 250,
           staff: {},
           wins: 0, losses: 0, kills: 0, deaths: 0, trainingCounts: { aim: 0, iq: 0, teamBuilding: 0 }, chemistry: 50,
           tradeRefusals: 0,
           rivalries: []
         };
       } 
       
       const rosterWithUpdatedOriginals = t.roster.map(p => ({
           ...p,
           originalStats: { aim: p.aim, iq: p.iq },
           // Decrement contract years here, removing expired ones happens via filter below in the loop
           contractYears: p.contractYears - 1
       })).filter(p => p.contractYears > 0);

       return {
         ...t,
         roster: rosterWithUpdatedOriginals,
         budget: 250 + Math.min(t.budget, 100),
         wins: 0, losses: 0, kills: 0, deaths: 0, trainingCounts: { aim: 0, iq: 0, teamBuilding: 0 },
         chemistry: Math.floor((t.chemistry + 50) / 2),
         tradeRefusals: 0,
       };
     });
     
     setTeams(updatedTeams);
     setSeason(prev => ({ ...prev, week: 1, season: prev.season + 1, isDrafting: true, playoffStage: undefined, playoffMatches: undefined }));
     setSchedule(generateSeasonSchedule(updatedTeams));
     
     // Create named players first for next season pool too
     const namedPlayers = REAL_PLAYER_NAMES.map(name => createPlayer(Math.random() < 0.15 ? 'Legend' : 'Normal', name));
     const remainingSlots = 120 - namedPlayers.length;
     const randomPlayers = remainingSlots > 0 ? Array.from({ length: remainingSlots }, (_, i) => createPlayer(i < 8 ? 'Legend' : 'Normal')) : [];
     
     const pool = [...namedPlayers, ...randomPlayers].sort((a,b) => getPlayerOverall(b) - getPlayerOverall(a));
     
     setDraftPool(pool);
     setExpiringContracts([]);
     setStaffReport([]);
     
     const shuffledTeamsForDraft = shuffleArray(updatedTeams);
     const order: string[] = [];
     for(let r=0; r<8; r++) {
       const round = r % 2 === 0 ? shuffledTeamsForDraft : [...shuffledTeamsForDraft].reverse();
       round.forEach((t: any) => order.push(t.id));
     }
     setDraftOrder(order);
     setCurrentPickIdx(0);
     setIsAutoDraft(false);
     setCurrentObjectives(generateObjectives());
     setShowOwnerWelcome(true);
     setView('draft');
     setDraftLog([]);
     setTimeLeft(300);
  };

  const advanceWeek = async () => {
    if (!playerTeam) return;
    setIsSimulating(true);

    if (season.playoffStage) {
      if (season.playoffStage === 'complete') {
        setIsSimulating(false);
        // Direct transition to summary, no confirmation dialog here
        setView('seasonSummary');
        return;
      }

      const currentMap = MAPS[Math.floor(Math.random() * MAPS.length)];
      const updatedTeams = [...teams];
      const matchesToSim = season.playoffStage === 'semis' ? season.playoffMatches?.semis : season.playoffMatches?.finals;
      
      if (!matchesToSim) { setIsSimulating(false); return; }

      const results: ScheduleMatch[] = [];
      let playerRes: MatchResult | null = null;
      let playerEarnings = 0;
      let playerViewership = 0;
      let opponent: Team | null = null;

      for (const match of matchesToSim) {
        const home = updatedTeams.find(t => t.id === match.homeId)!;
        const away = updatedTeams.find(t => t.id === match.awayId)!;
        const result = simulateMatch(home, away, currentMap, true);
        results.push({ ...match, result });

        const homeIdx = updatedTeams.findIndex(t => t.id === home.id);
        const awayIdx = updatedTeams.findIndex(t => t.id === away.id);
        
        updatedTeams[homeIdx].rivalries = updateRivalryState(updatedTeams[homeIdx], away.id, away.name, result.homeScore - result.awayScore, season.week);
        updatedTeams[awayIdx].rivalries = updateRivalryState(updatedTeams[awayIdx], home.id, home.name, result.awayScore - result.homeScore, season.week);

        if (home.id === playerTeamId || away.id === playerTeamId) {
          playerRes = result;
          playerEarnings = result.winnerId === playerTeamId ? 100 : 50;
          
          const sponsorMoney = Math.floor(result.viewership / 5000);
          playerEarnings += sponsorMoney;
          playerViewership = result.viewership;

          opponent = home.id === playerTeamId ? away : home;
        }
      }

      const nextStage = season.playoffStage === 'semis' ? 'finals' : 'complete';
      const updatedPlayoffMatches = { ...season.playoffMatches! };
      
      if (season.playoffStage === 'semis') {
        updatedPlayoffMatches.semis = results;
        updatedPlayoffMatches.finals = [{
          homeId: results[0].result!.winnerId,
          awayId: results[1].result!.winnerId
        }];
      } else {
        updatedPlayoffMatches.finals = results;
        const championId = results[0].result!.winnerId;
        const championTeam = updatedTeams.find(t => t.id === championId)!;
        championTeam.championships++;
        if (championId === playerTeamId) setCareerChampionships(prev => prev + 1);
        addSocialPost({
          author: 'League_Alerts',
          content: `CHAMPIONS: ${championTeam.name} have secured the Season ${season.season} Championship title!`,
          timestamp: 'Just now',
          isVerified: true
        });
      }

      setTeams(updatedTeams);
      setSeason(prev => ({ ...prev, playoffStage: nextStage, playoffMatches: updatedPlayoffMatches }));

      if (playerRes && opponent) {
        const recapText = await getMatchSummary(playerRes, playerTeam!, opponent);
        setShowResult({ result: playerRes, earnings: playerEarnings, viewership: playerViewership, recap: recapText });
      } else {
        setAlert({ title: "Playoffs Simulated", desc: "The tournament rounds have concluded. Check the bracket for the latest results." });
        setView('dashboard');
      }
      setIsSimulating(false);
      return;
    }

    if (season.week <= TOTAL_SEASON_WEEKS) {
      const isLastWeek = season.week === TOTAL_SEASON_WEEKS;
      const currentMap = MAPS[Math.floor(Math.random() * MAPS.length)];
      const updatedTeams = [...teams];
      const weeklyMatches = [...(schedule[season.week] || [])];
      let playerMatchResult: MatchResult | null = null;
      let playerMatchEarnings = 0;
      let playerViewership = 0;
      let opponentTeam: Team | null = null;
      const updatedSchedule = { ...schedule };
      const updatedMatches: ScheduleMatch[] = [];

      for (const match of weeklyMatches) {
        const home = updatedTeams.find(t => t.id === match.homeId)!;
        const away = updatedTeams.find(t => t.id === match.awayId)!;
        const result = simulateMatch(home, away, currentMap);
        const homeIdx = updatedTeams.findIndex(t => t.id === home.id);
        const awayIdx = updatedTeams.findIndex(t => t.id === away.id);

        if (result.winnerId === home.id) {
          updatedTeams[homeIdx].wins++;
          updatedTeams[awayIdx].losses++;
          if (season.mode === 'dynasty') {
             updatedTeams[homeIdx].chemistry = Math.min(100, updatedTeams[homeIdx].chemistry + 2);
             updatedTeams[homeIdx].roster.forEach(p => p.morale = Math.min(100, p.morale + 3));
             updatedTeams[awayIdx].chemistry = Math.max(0, updatedTeams[awayIdx].chemistry - 1);
             updatedTeams[awayIdx].roster.forEach(p => p.morale = Math.max(0, p.morale - 2));
          }
        } else {
          updatedTeams[awayIdx].wins++;
          updatedTeams[homeIdx].losses++;
          if (season.mode === 'dynasty') {
             updatedTeams[awayIdx].chemistry = Math.min(100, updatedTeams[awayIdx].chemistry + 2);
             updatedTeams[awayIdx].roster.forEach(p => p.morale = Math.min(100, p.morale + 3));
             updatedTeams[homeIdx].chemistry = Math.max(0, updatedTeams[homeIdx].chemistry - 1);
             updatedTeams[homeIdx].roster.forEach(p => p.morale = Math.max(0, p.morale - 2));
          }
        }

        updatedTeams[homeIdx].rivalries = updateRivalryState(updatedTeams[homeIdx], away.id, away.name, result.homeScore - result.awayScore, season.week);
        updatedTeams[awayIdx].rivalries = updateRivalryState(updatedTeams[awayIdx], home.id, home.name, result.awayScore - result.homeScore, season.week);

        const getFinancials = (t: Team, win: boolean, viewers: number) => {
          let prize = win ? 25 : 12;
          if (t.staff["Community Manager"]) prize = Math.floor(prize * t.staff["Community Manager"]!.bonusVal);
          
          const sponsorMoney = Math.floor(viewers / 5000);
          prize += sponsorMoney;

          const weeklyPayroll = Math.floor(t.roster.reduce((sum, p) => sum + (p.salary / TOTAL_SEASON_WEEKS), 0));
          return prize - weeklyPayroll;
        };

        updatedTeams[homeIdx].budget += getFinancials(updatedTeams[homeIdx], result.winnerId === home.id, result.viewership);
        updatedTeams[awayIdx].budget += getFinancials(updatedTeams[awayIdx], result.winnerId === away.id, result.viewership);
        updatedMatches.push({ ...match, result });

        if (home.id === playerTeamId) {
          playerMatchResult = result;
          playerMatchEarnings = (result.winnerId === home.id ? 25 : 12) * (updatedTeams[homeIdx].staff["Community Manager"]?.bonusVal || 1);
          playerMatchEarnings += Math.floor(result.viewership / 5000);
          playerViewership = result.viewership;
          opponentTeam = away;
        } else if (away.id === playerTeamId) {
          playerMatchResult = result;
          playerMatchEarnings = (result.winnerId === away.id ? 25 : 12) * (updatedTeams[awayIdx].staff["Community Manager"]?.bonusVal || 1);
          playerMatchEarnings += Math.floor(result.viewership / 5000);
          playerViewership = result.viewership;
          opponentTeam = home;
        }
      }

      const pTeam = updatedTeams.find(t => t.id === playerTeamId);
      if (pTeam && pTeam.budget < 50) {
          pTeam.budget += 100;
          addSocialPost({ author: "@LeagueOps", content: `Emergency funding injection approved for ${pTeam.name} to maintain competitive integrity.`, timestamp: "Just now", isVerified: true });
          setAlert({ title: "Emergency Funding", desc: "The league has authorized an emergency sponsorship injection of $100k to prevent insolvency. Manage your finances carefully." });
      }
      
      if (pTeam && pTeam.budget < 0) {
          setIsSimulating(false);
          setView('gameOver');
          return;
      }

      updatedSchedule[season.week] = updatedMatches;
      setSchedule(updatedSchedule);
      setTeams(updatedTeams.map(t => ({ ...t, trainingCounts: { aim: 0, iq: 0, teamBuilding: 0 } })));
      setSeason(prev => ({ ...prev, week: prev.week + 1 }));

      if (isLastWeek) {
        setPendingPlayoffAnnouncement(true);
      }

      if (playerMatchResult && opponentTeam) {
        const recapText = await getMatchSummary(playerMatchResult, playerTeam!, opponentTeam);
        setShowResult({ result: playerMatchResult, earnings: Math.floor(playerMatchEarnings), viewership: playerViewership, recap: recapText });
      }
      setIsSimulating(false);
    } else {
      const qualified = sortedStandings.slice(0, 4);
      const semis: ScheduleMatch[] = [
        { homeId: qualified[0].id, awayId: qualified[3].id },
        { homeId: qualified[1].id, awayId: qualified[2].id }
      ];
      setSeason(prev => ({
        ...prev,
        playoffStage: 'semis',
        playoffMatches: { semis, finals: [] }
      }));
      setIsSimulating(false);
      addSocialPost({ author: 'League_Alerts', content: "Regular Season Concluded! The Top 4 squads proceed to the Playoffs.", timestamp: 'Just now', isVerified: true });
      setView('dashboard');
    }
  };

  const handleResign = (player: Player) => {
      if (!playerTeam) return;
      const markupCost = Math.floor(player.salary * 1.3);
      if (availableFunds < markupCost) {
          setAlert({ title: "Insufficient Funds", desc: `You need $${markupCost}k to re-sign this player at the renegotiated rate.` });
          return;
      }
      
      setConfirm({
          title: "Re-sign Contract",
          desc: `Re-sign ${player.gamertag} for <span class="text-emerald-400 font-bold">$${markupCost}k</span> / season? (2 Year Contract)`,
          onConfirm: () => {
              setTeams(prev => prev.map(t => {
                  if (t.id === playerTeamId) {
                      return { 
                          ...t, 
                          roster: [...t.roster, { ...player, salary: markupCost, contractYears: 2 }],
                          budget: t.budget
                      };
                  }
                  return t;
              }));
              setExpiringContracts(prev => prev.filter(p => p.id !== player.id));
          }
      });
  };

  const handleTrain = (stat: 'aim' | 'iq' | 'chem') => {
    if (!playerTeam) return;
    
    const totalUsed = (playerTeam.trainingCounts?.aim || 0) + (playerTeam.trainingCounts?.iq || 0) + (playerTeam.trainingCounts?.teamBuilding || 0);

    if (season.week > TOTAL_SEASON_WEEKS || season.playoffStage) {
      setAlert({ title: "Personnel Vacation", desc: "The training facility is closed for the post-season. All pilots are focused on tournament matches or are on leave." });
      return;
    }

    if (totalUsed >= 3) {
      setAlert({ title: "At Capacity", desc: "The squad has reached the limit of 3 training sessions for this match week." });
      return;
    }

    if (stat === 'chem' && (playerTeam.trainingCounts?.teamBuilding || 0) >= 1) {
      setAlert({ title: "Session Limit", desc: "Team Building exercises are intensive and limited to once per week." });
      return;
    }

    const cost = 3 * Math.pow(2, totalUsed);
    if (availableFunds < cost) {
      setAlert({ title: "Insufficient Funds", desc: `You need $${cost}k in available budget to fund this training session.` });
      return;
    }

    let rate = 0;
    if (stat === 'chem') {
        rate = 100;
    } else {
        const rates = [100, 66, 33];
        rate = rates[totalUsed] || 0;
    }

    setConfirm({
      title: `${stat === 'chem' ? 'Team Building' : stat.toUpperCase() + ' Training'}`,
      desc: `Spend <span class="text-emerald-400 font-bold">$${cost}k</span> for session #${totalUsed + 1}?<br><br>Success Chance: <span class="font-bold">${rate}%</span>`,
      onConfirm: () => {
        const isSuccess = stat === 'chem' ? true : (Math.random() * 100) < rate;
        const trainees = [...playerTeam.roster].sort(() => 0.5 - Math.random()).slice(0, 3);
        const sessionChanges: { pilot: string, delta: number }[] = [];
        
        let chemistryChange = 0;
        if (stat === 'chem') {
            chemistryChange = Math.floor(Math.random() * 6) + 10; // 10-15%
        } else {
            chemistryChange = isSuccess ? 2 : -5;
        }

        setTeams(prev => prev.map(t => {
          if (t.id === playerTeamId) {
            const newRoster = t.roster.map(p => {
              if (stat !== 'chem' && trainees.find(tr => tr.id === p.id)) {
                const delta = isSuccess ? (Math.floor(Math.random() * 3) + 1) : -(Math.floor(Math.random() * 2) + 1);
                sessionChanges.push({ pilot: p.gamertag, delta });
                return { ...p, [stat]: Math.max(0, p[stat] + delta) };
              }
              return p;
            });
            
            const newChemistry = Math.min(100, Math.max(0, t.chemistry + chemistryChange));

            return { 
              ...t, 
              budget: t.budget - cost, 
              trainingCounts: { 
                  ...t.trainingCounts, 
                  [stat === 'chem' ? 'teamBuilding' : stat]: (t.trainingCounts[stat === 'chem' ? 'teamBuilding' : stat] || 0) + 1 
              }, 
              roster: newRoster,
              chemistry: newChemistry
            };
          }
          return t;
        }));

        setTrainingResult({
          success: isSuccess,
          stat,
          changes: stat === 'chem' ? [{ pilot: 'Team Chemistry', delta: chemistryChange }] : sessionChanges
        });
      }
    });
  };

  const hireStaff = (role: StaffRole, tierIdx: number, candidateName: string) => {
    const tierNames: ("Bronze" | "Silver" | "Gold")[] = ["Bronze", "Silver", "Gold"];
    const costs = [10, 25, 50];
    const bonuses = {
      "Head Coach": [1.02, 1.05, 1.10],
      "Recruiter": [0.05, 0.10, 0.20],
      "Strategist": [1.15, 1.20, 1.25],
      "Accountant": [0.05, 0.10, 0.15],
      "Community Manager": [1.1, 1.25, 1.5]
    };
    const cost = costs[tierIdx];
    if (availableFunds < cost) {
      setAlert({ title: "Funds Required", desc: `Hiring ${candidateName} costs $${cost}k upfront.` });
      return;
    }
    setTeams(prev => prev.map(t => t.id === playerTeamId ? {
      ...t,
      budget: t.budget - cost,
      staff: { ...t.staff, [role]: { name: candidateName, tier: tierNames[tierIdx], bonusVal: bonuses[role][tierIdx] } }
    } : t));
    setRecruitmentRole(null);
  };

  const promoteStaff = (role: StaffRole) => {
    if (!playerTeam) return;
    const staff = playerTeam.staff[role];
    if (!staff) return;

    let nextTier: "Silver" | "Gold" | "Prismatic" | null = null;
    let cost = 0;
    let nextBonus = 0;

    if (staff.tier === 'Bronze') {
        nextTier = 'Silver';
        cost = 25; // Cost of Silver tier equivalent
    } else if (staff.tier === 'Silver') {
        nextTier = 'Gold';
        cost = 50; // Cost of Gold tier equivalent
    } else if (staff.tier === 'Gold') {
        nextTier = 'Prismatic';
        cost = 100; // Premium Prismatic upgrade cost
    }

    if (!nextTier) return;

    if (availableFunds < cost) {
        setAlert({ title: "Insufficient Funds", desc: `Promotion to ${nextTier} requires $${cost}k.` });
        return;
    }

    // Determine bonus based on role and tier
    const getBonus = (r: StaffRole, t: string) => {
       if (t === 'Silver') {
          if (r === 'Head Coach') return 1.05;
          if (r === 'Recruiter') return 0.10;
          if (r === 'Strategist') return 1.20;
          if (r === 'Accountant') return 0.10;
          if (r === 'Community Manager') return 1.25;
       }
       if (t === 'Gold') {
          if (r === 'Head Coach') return 1.10;
          if (r === 'Recruiter') return 0.20;
          if (r === 'Strategist') return 1.25;
          if (r === 'Accountant') return 0.15;
          if (r === 'Community Manager') return 1.50;
       }
       if (t === 'Prismatic') {
          if (r === 'Head Coach') return 1.15;
          if (r === 'Recruiter') return 0.35;
          if (r === 'Strategist') return 1.35;
          if (r === 'Accountant') return 0.25;
          if (r === 'Community Manager') return 2.00;
       }
       return 1.0;
    };

    nextBonus = getBonus(role, nextTier);

    setConfirm({
        title: `Promote Staff`,
        desc: `Promote ${staff.name} to <span class="text-white font-bold">${nextTier}</span> tier for <span class="text-emerald-400 font-bold">$${cost}k</span>?`,
        onConfirm: () => {
             setTeams(prev => prev.map(t => t.id === playerTeamId ? {
               ...t,
               budget: t.budget - cost,
               staff: { ...t.staff, [role]: { ...staff, tier: nextTier!, bonusVal: nextBonus } }
             } : t));
        }
    });
  };

  const releaseStaff = (role: StaffRole) => {
    if (!playerTeam) return;
    const staff = playerTeam.staff[role];
    if (!staff) return;

    let refund = 0;
    if (staff.tier === 'Bronze') refund = 5;
    if (staff.tier === 'Silver') refund = 12;
    if (staff.tier === 'Gold') refund = 25;
    if (staff.tier === 'Prismatic') refund = 50;

    setConfirm({
        title: "Release Staff",
        desc: `Are you sure you want to release ${staff.name}? You will recoup <span class="text-emerald-400 font-bold">$${refund}k</span>.`,
        onConfirm: () => {
            const newStaff = { ...playerTeam.staff };
            delete newStaff[role];
            setTeams(prev => prev.map(t => t.id === playerTeamId ? {
                ...t,
                budget: t.budget + refund,
                staff: newStaff
            } : t));
        }
    });
  };

  const handleSign = (pid: string) => {
    if (!playerTeam) {
        console.error("No player team found");
        return;
    }
    const player = freeAgents.find(p => p.id === pid);
    if (!player) {
        console.error("Player not found in free agents");
        return;
    }
    const cap = season.mode === 'dynasty' ? 12 : 10;
    if (playerTeam.roster.length >= cap) {
      setAlert({ title: "Roster Full", desc: `Roster limit is ${cap}. Release a player to sign new talent.` });
      return;
    }
    let contractObligation = getProratedSalary(player.salary, season.week);
    
    // Safely check for recruiter bonus
    const recruiter = playerTeam.staff["Recruiter"];
    if (recruiter && recruiter.bonusVal) {
        contractObligation = Math.floor(contractObligation * (1 - recruiter.bonusVal));
    }

    if (availableFunds < contractObligation) {
      setAlert({ title: "Insufficient Funds", desc: `You need $${contractObligation}k in available funds to take on this contract obligation.` });
      return;
    }
    setConfirm({
      title: "Sign Pilot",
      desc: `Sign ${player.gamertag}?`,
      onConfirm: () => {
        setTeams(prev => prev.map(t => {
            if (t.id === playerTeamId) {
                // Chemistry Penalty for roster change in Dynasty Mode
                let newChem = t.chemistry;
                if (season.mode === 'dynasty') newChem = Math.max(0, newChem - 10);
                
                // Rivalry Trigger: If player came from another team
                let newRivalries = [...t.rivalries];
                if (player.previousTeamId && player.previousTeamId !== playerTeamId) {
                    const prevTeam = teams.find(team => team.id === player.previousTeamId);
                    if (prevTeam) {
                        newRivalries = updateRivalryState(t, prevTeam.id, prevTeam.name, 50, season.week); // Artificial 50 score diff to trigger "stolen player" rivalry
                        // Hacky way to inject a custom reason without changing the helper too much
                        const rIndex = newRivalries.findIndex(r => r.opponentId === prevTeam.id);
                        if(rIndex !== -1) newRivalries[rIndex].reason = "Stolen Talent";
                    }
                }

                return { ...t, roster: [...t.roster, player], chemistry: newChem, rivalries: newRivalries };
            }
            return t;
        }));
        setFreeAgents(prev => prev.filter(p => p.id !== pid));
        addSocialPost({
            author: '@TransferBot',
            content: `BREAKING: ${playerTeam.name} has signed free agent ${player.gamertag}.`,
            timestamp: 'Just now',
            isVerified: true
        });
      }
    });
  };

  const handleRelease = (pid: string) => {
    if (!playerTeam) return;
    setConfirm({
      title: "Release Pilot",
      desc: "Are you sure?",
      onConfirm: () => {
        const p = playerTeam.roster.find(px => px.id === pid);
        setTeams(prevTeams => {
            const currentTeam = prevTeams.find(t => t.id === playerTeamId);
            if (!currentTeam) return prevTeams;
            
            if (p) {
                // Set previousTeamId when releasing to Free Agency
                setFreeAgents(prevFA => [{...p, previousTeamId: playerTeamId}, ...prevFA]);
            }
            
            return prevTeams.map(t => {
                if (t.id === playerTeamId) {
                    // Chemistry Penalty for roster change
                    const newChem = season.mode === 'dynasty' ? Math.max(0, t.chemistry - 5) : t.chemistry;
                    return { ...t, roster: t.roster.filter(px => px.id !== pid), chemistry: newChem };
                }
                return t;
            });
        });
        if(p) {
            addSocialPost({
                author: '@TransferBot',
                content: `${playerTeam.name} has released ${p.gamertag} to free agency.`,
                timestamp: 'Just now',
                isVerified: true
            });
        }
      }
    });
  };
  
  // Trading Logic
  const handleTrade = () => {
     if (!playerTeam || !tradeTargetTeam) return;
     const myOfferVal = myTradeOffer.reduce((acc, id) => {
       const p = playerTeam.roster.find(x => x.id === id);
       return acc + (p ? calculateTradeValue(p) : 0);
     }, 0);
     
     const theirOfferVal = theirTradeOffer.reduce((acc, id) => {
       const p = tradeTargetTeam.roster.find(x => x.id === id);
       return acc + (p ? calculateTradeValue(p) : 0);
     }, 0);
     
     // Simple AI Logic: Must receive more value than giving, plus a small bias against trading
     const threshold = theirOfferVal * 1.1; 
     
     if (myOfferVal >= threshold) {
         setConfirm({
           title: "Trade Proposal",
           desc: "The other team has <span class='text-emerald-500'>ACCEPTED</span> your offer. Proceed with the trade?",
           onConfirm: () => {
             // Execute Trade
             const myPlayers = playerTeam.roster.filter(p => myTradeOffer.includes(p.id));
             const theirPlayers = tradeTargetTeam.roster.filter(p => theirTradeOffer.includes(p.id));
             
             setTeams(prev => prev.map(t => {
               if (t.id === playerTeam.id) {
                 return {
                   ...t,
                   roster: [...t.roster.filter(p => !myTradeOffer.includes(p.id)), ...theirPlayers],
                   chemistry: Math.max(0, t.chemistry - 10) // Trading hurts chemistry
                 };
               }
               if (t.id === tradeTargetTeam.id) {
                 return {
                   ...t,
                   roster: [...t.roster.filter(p => !theirTradeOffer.includes(p.id)), ...myPlayers],
                 };
               }
               return t;
             }));
             
             setTradeModal(null);
             setMyTradeOffer([]);
             setTheirTradeOffer([]);
             setAlert({ title: "Trade Completed", desc: "The players have been exchanged. Note that team chemistry has taken a hit due to roster churn." });
             
             addSocialPost({
                author: '@LeagueOps',
                content: `BLOCKBUSTER TRADE: ${playerTeam.name} and ${tradeTargetTeam.name} have agreed to a player exchange involving ${myPlayers.length + theirPlayers.length} pilots.`,
                timestamp: 'Just now',
                isVerified: true
             });
           }
         });
     } else {
       setAlert({ title: "Trade Rejected", desc: "The opposing GM believes they are giving up too much value. Enhance your offer." });
     }
  };

  const swapPlayers = (idx1: number, idx2: number) => {
    if (!playerTeam) return;
    const newRoster = [...playerTeam.roster];
    const temp = newRoster[idx1];
    newRoster[idx1] = newRoster[idx2];
    newRoster[idx2] = temp;
    setTeams(prev => prev.map(t => t.id === playerTeamId ? { ...t, roster: newRoster } : t));
  };

  const handleDraftPick = (player: Player, teamId: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, roster: [...t.roster, player] } : t));
    setDraftPool(prev => prev.filter(p => p.id !== player.id));
    setDraftLog(prev => [{
      round: Math.floor(currentPickIdx / teams.length) + 1,
      team: teams.find(t => t.id === teamId)?.name || 'Unknown',
      teamId: teamId,
      player: player.gamertag,
      overall: getPlayerOverall(player)
    }, ...prev]);
    setCurrentPickIdx(prev => prev + 1);
    setTimeLeft(300);
  };

  const endDraftEarly = () => {
    if (!playerTeam) return;
    
    setConfirm({
      title: "End Draft Early?",
      desc: "Simulate all remaining rounds? Your team will <span class='text-red-500 font-bold'>SKIP</span> all remaining picks. CPU teams will continue to draft.",
      onConfirm: () => {
        setIsAutoDraft(true);
        // Dynasty Skip logic: Loop through the remaining picks
        // If it's player turn, DO NOTHING. If CPU turn, pick best available.
        let localIdx = currentPickIdx;
        let localPool = [...draftPool];
        const localLogs: any[] = [];
        const localRosterUpdates: Record<string, Player[]> = {};

        while (localIdx < draftOrder.length && localPool.length > 0) {
           const teamId = draftOrder[localIdx];
           
           if (teamId !== playerTeamId) {
             const p = localPool.shift()!;
             if (!localRosterUpdates[teamId]) localRosterUpdates[teamId] = [];
             localRosterUpdates[teamId].push(p);
             
             localLogs.push({
               round: Math.floor(localIdx / teams.length) + 1,
               team: teams.find(t => t.id === teamId)?.name || 'Unknown',
               teamId: teamId,
               player: p.gamertag,
               overall: getPlayerOverall(p)
             });
           }
           // If teamId === playerTeamId, we skip effectively by just incrementing index without taking from pool
           localIdx++;
        }

        setTeams(prev => prev.map(t => {
           if (localRosterUpdates[t.id]) {
             return { ...t, roster: [...t.roster, ...localRosterUpdates[t.id]] };
           }
           return t;
        }));
        setDraftLog(prev => [...localLogs, ...prev]);
        setDraftPool(localPool);
        setCurrentPickIdx(draftOrder.length); // Trigger completion useEffect
      }
    });
  };

  // --- Debug Handlers ---
  const debugSkipToPlayoffs = () => {
    setTeams(prev => prev.map(t => {
        const wins = Math.floor(Math.random() * (TOTAL_SEASON_WEEKS + 1));
        return { ...t, wins, losses: TOTAL_SEASON_WEEKS - wins, kills: wins * 50, deaths: (TOTAL_SEASON_WEEKS - wins) * 50 };
    }));
    setSeason(prev => ({ ...prev, week: TOTAL_SEASON_WEEKS + 1 }));
    setAlert({ title: "DEBUG: SEASON SKIPPED", desc: "Standings randomized. Regular season concluded. Proceed to setup playoffs." });
  };

  const debugMaxStats = () => {
    setTeams(prev => prev.map(t => t.id === playerTeamId ? {
        ...t,
        roster: t.roster.map(p => ({ ...p, aim: 99, iq: 99, potential: 99 }))
    } : t));
    setAlert({ title: "DEBUG: STATS MAXED", desc: "All current roster members now possess OVR 99 capabilities." });
  };

  useEffect(() => {
    let timer: number;
    if (view === 'draft' && draftOrder[currentPickIdx] === playerTeamId && !showOwnerWelcome) {
      timer = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            const pick = draftPool[0];
            if (pick) handleDraftPick(pick, playerTeamId);
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [view, currentPickIdx, playerTeamId, draftPool, showOwnerWelcome]);

  useEffect(() => {
    if (view === 'draft' && !showOwnerWelcome) {
      const currentTeamId = draftOrder[currentPickIdx];
      // Safety check: If pool is empty, force finish draft
      if (season.isDrafting && draftPool.length === 0 && currentPickIdx < draftOrder.length) {
          setCurrentPickIdx(draftOrder.length);
          return;
      }
      
      if (currentTeamId && currentTeamId !== playerTeamId) {
        const timer = setTimeout(() => {
          const pick = draftPool[0];
          if (pick) handleDraftPick(pick, currentTeamId);
          else setCurrentPickIdx(draftOrder.length); // Safety finish
        }, 600);
        return () => clearTimeout(timer);
      } else if (isAutoDraft && currentTeamId === playerTeamId) {
        const pick = draftPool[0];
        if (pick) handleDraftPick(pick, playerTeamId);
        else setCurrentPickIdx(draftOrder.length); // Safety finish
      }
    }
  }, [view, currentPickIdx, draftOrder, isAutoDraft, draftPool, playerTeamId, showOwnerWelcome, season.isDrafting]);

  useEffect(() => {
    // Check view === 'draft' to prevent race conditions where we might skip the draft entirely
    if (view === 'draft' && currentPickIdx >= draftOrder.length && draftOrder.length > 0) {
      setFreeAgents(draftPool);
      setSeason(prev => ({ ...prev, isDrafting: false }));
      setView('dashboard');
    }
  }, [view, currentPickIdx, draftOrder, draftPool]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderLogo = (team: Team | { name: string, colors: { primary: string, secondary: string }, logoConfig: { shape: LogoShape, gradient: LogoGradient } }, size: 'xs' | 'sm' | 'md' | 'lg' = 'md') => {
    const initials = team.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const sizeClasses = { xs: 'w-8 h-8 text-[10px] border-2', sm: 'w-10 h-10 text-xs border-2', md: 'w-20 h-20 text-3xl border-4', lg: 'w-48 h-48 text-7xl border-4' };
    const shapeClasses = { square: 'rounded-none', rounded: 'rounded-2xl', circle: 'rounded-full', hexagon: 'clip-hexagon' };
    const gradientStyles = {
      linear: `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary})`,
      radial: `radial-gradient(circle, ${team.colors.primary}, ${team.colors.secondary})`,
      conic: `conic-gradient(from 180deg, ${team.colors.primary}, ${team.colors.secondary}, ${team.colors.primary})`
    };
    return (
      <div className={`${sizeClasses[size]} ${shapeClasses[team.logoConfig.shape]} flex items-center justify-center font-black text-white shadow-2xl border-white/10 relative overflow-hidden transition-all duration-500`} style={{ background: gradientStyles[team.logoConfig.gradient] }}>
        <div className="absolute inset-0 bg-black/10"></div>
        <span className="relative z-10 font-orbitron drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] italic">{initials}</span>
      </div>
    );
  };

  const renderBracket = () => {
    if (!season.playoffStage) return null;
    const { semis, finals } = season.playoffMatches || { semis: [], finals: [] };
    
    const getTeamName = (id: string) => teams.find(t => t.id === id)?.name || "TBD";
    const getTeamResult = (match?: ScheduleMatch, side: 'home' | 'away' = 'home') => {
        if (!match?.result) return "";
        const score = side === 'home' ? match.result.homeScore : match.result.awayScore;
        const winner = match.result.winnerId === (side === 'home' ? match.homeId : match.awayId);
        return <span className={`ml-auto font-mono ${winner ? 'text-emerald-400' : 'text-zinc-600'}`}>{score}</span>;
    };

    return (
      <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 shadow-2xl animate-in fade-in duration-700 mt-6">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-8 font-orbitron text-center">Championship Bracket</h3>
        <div className="flex items-center justify-between gap-8 relative">
           <div className="space-y-12 flex-1">
              <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-center mb-4">Semi-Finals</div>
              {semis.map((m, i) => (
                <div key={i} className="bg-zinc-800 p-4 rounded-xl border border-zinc-700 space-y-2 shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold uppercase ${m.result?.winnerId === m.homeId ? 'text-white' : 'text-zinc-500'}`}>{getTeamName(m.homeId)}</span>
                    {getTeamResult(m, 'home')}
                  </div>
                  <div className="h-px bg-zinc-700"></div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold uppercase ${m.result?.winnerId === m.awayId ? 'text-white' : 'text-zinc-500'}`}>{getTeamName(m.awayId)}</span>
                    {getTeamResult(m, 'away')}
                  </div>
                </div>
              ))}
           </div>
           <div className="w-12 h-48 border-y-2 border-r-2 border-zinc-800 rounded-r-2xl hidden md:block"></div>
           <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-[9px] font-black text-yellow-500 uppercase tracking-widest text-center mb-4">Finals</div>
              {finals.length > 0 ? (
                <div className="bg-zinc-800 p-6 rounded-2xl border-2 border-emerald-500/30 w-full shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                   <div className="flex items-center gap-3 mb-3">
                    <span className={`text-sm font-black uppercase ${finals[0].result?.winnerId === finals[0].homeId ? 'text-emerald-400' : 'text-zinc-200'}`}>{getTeamName(finals[0].homeId)}</span>
                    {getTeamResult(finals[0], 'home')}
                  </div>
                  <div className="h-px bg-zinc-700 my-2"></div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-black uppercase ${finals[0].result?.winnerId === finals[0].awayId ? 'text-emerald-400' : 'text-zinc-200'}`}>{getTeamName(finals[0].awayId)}</span>
                    {getTeamResult(finals[0], 'away')}
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-800/20 p-8 rounded-2xl border border-zinc-800/50 w-full text-center border-dashed">
                  <span className="text-[10px] font-black text-zinc-700 uppercase italic">Awaiting Results</span>
                </div>
              )}
              {season.playoffStage === 'complete' && (
                <div className="mt-8 flex flex-col items-center animate-bounce">
                   <i className="fas fa-trophy text-yellow-500 text-4xl mb-2"></i>
                   <span className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.3em]">Season Champion</span>
                   <span className="text-white font-black uppercase italic text-xl mt-1 tracking-tighter">{getTeamName(finals[0].result!.winnerId)}</span>
                </div>
              )}
           </div>
        </div>
      </div>
    );
  };

  const renderTab = () => {
    switch(activeTab) {
      case 'overview': {
        const topPlayer = playerTeam ? [...playerTeam.roster].sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a))[0] : null;
        
        const recentMatches = [];
        for (let w = 1; w < season.week; w++) {
            const match = (schedule[w] || []).find(m => m.homeId === playerTeamId || m.awayId === playerTeamId);
            if (match && match.result) recentMatches.push(match);
        }
        const recentForm = recentMatches.reverse().slice(0, 5);

        // Prepare Ticker Items
        const tickerItems = [
            ...socialFeed.slice(0, 3).map(p => `"${p.content}" - ${p.author}`),
            ...(Object.values(schedule).flat() as ScheduleMatch[]).filter(m => m.result && (m.homeId === playerTeamId || m.awayId === playerTeamId || season.playoffStage)).slice(-5).map(m => {
                const h = teams.find(t => t.id === m.homeId);
                const a = teams.find(t => t.id === m.awayId);
                return `${h?.name} ${m.result!.homeScore} - ${m.result!.awayScore} ${a?.name}`;
            })
        ];

        return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
           {/* News Ticker */}
           <div className="bg-black/30 border-y border-zinc-800/50 mb-2 overflow-hidden relative h-8 flex items-center shadow-inner">
              <div className="absolute top-0 left-0 bottom-0 bg-emerald-600/20 px-3 flex items-center z-10 border-r border-emerald-500/30 backdrop-blur-sm">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest animate-pulse flex items-center gap-2"><i className="fas fa-satellite-dish"></i> LIVE WIRE</span>
              </div>
              <div className="whitespace-nowrap animate-marquee flex items-center gap-12 pl-32">
                 {tickerItems.length > 0 ? tickerItems.map((item, i) => (
                   <span key={i} className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-2">
                     <span className="text-zinc-600">///</span> {item}
                   </span>
                 )) : <span className="text-xs font-mono text-zinc-600 uppercase">Connecting to league feed...</span>}
              </div>
           </div>

           <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Record', val: `${playerTeam?.wins}-${playerTeam?.losses}` },
                { label: 'Rank', val: `#${sortedStandings.findIndex(t => t.id === playerTeamId) + 1}`, color: 'text-emerald-500' },
                { label: 'Squad OVR', val: playerTeam ? getTeamOverall(playerTeam) : 0 },
              ].map(s => (
                <div key={s.label} className="bg-zinc-800 p-4 rounded border border-zinc-700 shadow-lg shadow-black/20">
                  <div className="text-zinc-500 text-[10px] font-black uppercase mb-1 tracking-widest">{s.label}</div>
                  <div className={`text-2xl font-bold ${s.color || 'text-white'}`}>{s.val}</div>
                </div>
              ))}
           </div>
           
           {/* Chemistry Meter - Dynasty Mode Only */}
           {season.mode === 'dynasty' && playerTeam && (
             <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-pink-500/10 text-pink-500 text-xl"><i className="fas fa-heart"></i></div>
                <div className="flex-1">
                   <div className="flex justify-between items-end mb-1">
                      <div className="text-[10px] font-black text-pink-500 uppercase tracking-widest">Team Chemistry</div>
                      <div className="text-white font-bold text-sm">{playerTeam.chemistry || 50}%</div>
                   </div>
                   <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-pink-500 transition-all duration-1000" style={{ width: `${playerTeam.chemistry || 50}%` }}></div>
                   </div>
                </div>
                <div className="text-xs text-zinc-500 italic max-w-[200px] text-right">Higher chemistry boosts in-game performance significantly.</div>
             </div>
           )}

           <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-6">
                {season.playoffStage && renderBracket()}
                <section className="bg-zinc-800 rounded border border-zinc-700 p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><i className={`fas fa-${(season.week > TOTAL_SEASON_WEEKS || season.playoffStage) ? 'umbrella-beach' : 'dumbbell'} text-6xl`}></i></div>
                  
                  {(season.week > TOTAL_SEASON_WEEKS || season.playoffStage) ? (
                    <>
                      <h2 className="text-lg font-black text-zinc-500 mb-2 tracking-tighter uppercase italic flex items-center gap-2"><i className="fas fa-umbrella-beach text-orange-400"></i> Personnel Vacation</h2>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-4">The pilots are taking required leave before or after tournament play.</p>
                      <div className="bg-zinc-950/40 p-4 rounded-xl border border-dashed border-zinc-800 text-center italic text-xs text-zinc-500">
                        Staff and pilots are currently focused on tournament prep or taking required leave.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-black text-white tracking-tighter uppercase italic flex items-center gap-2"><i className="fas fa-bolt text-emerald-500"></i> Training Facility</h2>
                        <div className="flex gap-2">
                           {[0, 1, 2].map(i => (
                             <div key={i} className={`w-3 h-3 rounded-full border ${i < (playerTeam?.trainingCounts.aim! + playerTeam?.trainingCounts.iq! + (playerTeam?.trainingCounts.teamBuilding || 0)) ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-zinc-900 border-zinc-700'}`}></div>
                           ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {(['aim', 'iq', 'chem'] as const).map(stat => {
                          const totalUsed = (playerTeam?.trainingCounts.aim || 0) + (playerTeam?.trainingCounts.iq || 0) + (playerTeam?.trainingCounts.teamBuilding || 0);
                          const cost = 3 * Math.pow(2, totalUsed);
                          const rates = [100, 66, 33];
                          const rate = stat === 'chem' ? 100 : (rates[totalUsed] || 0);
                          const isMaxed = totalUsed >= 3;
                          const isChemMaxed = stat === 'chem' && (playerTeam?.trainingCounts.teamBuilding || 0) >= 1;
                          
                          let label = "Team Building";
                          let icon = "handshake";
                          let color = "text-purple-500";
                          let bg = "bg-purple-500/10";

                          if (stat === 'aim') { label = "AIM Drills"; icon = "bullseye"; color = "text-red-500"; bg = "bg-red-500/10"; }
                          if (stat === 'iq') { label = "IQ Drills"; icon = "brain"; color = "text-blue-500"; bg = "bg-blue-500/10"; }

                          return (
                            <div key={stat} onClick={() => !isMaxed && !isChemMaxed && handleTrain(stat)} className={`bg-zinc-950 p-4 rounded-xl border border-zinc-800 transition-all group flex flex-col justify-between h-32 relative overflow-hidden ${isMaxed || isChemMaxed ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-500'}`}>
                              <div className="flex justify-between items-start">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${bg} ${color}`}><i className={`fas fa-${icon}`}></i></div>
                                <span className="bg-zinc-900 px-2 py-1 rounded text-emerald-400 font-mono font-bold text-[10px] border border-zinc-800">${cost}k</span>
                              </div>
                              <div>
                                <h3 className="text-xs font-black text-white uppercase tracking-tight mb-1">{label}</h3>
                                {stat === 'chem' ? (
                                    <p className="text-[9px] text-zinc-500 uppercase font-bold">Boosts Chemistry</p>
                                ) : (
                                    <p className="text-[9px] text-zinc-500 uppercase font-bold">Success: {rate}%</p>
                                )}
                              </div>
                              {stat === 'chem' && <div className="absolute bottom-2 right-2 text-[8px] text-zinc-600 font-black uppercase tracking-widest border border-zinc-800 px-1 rounded">1/Week</div>}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 text-[9px] text-zinc-500 uppercase font-black tracking-[0.2em] text-center">3 shared attempts available per week • Cost and failure risk increase with use</div>
                    </>
                  )}
                </section>
                {!season.playoffStage && (
                  <div className="bg-zinc-800 rounded border border-zinc-700 overflow-hidden shadow-xl">
                    <div className="px-6 py-4 border-b border-zinc-700 bg-zinc-800/50 flex justify-between items-center">
                      <h3 className="font-bold text-zinc-300 uppercase tracking-widest text-xs">Next Match</h3>
                      <span className="text-xs font-mono bg-zinc-700 px-2 py-1 rounded text-zinc-300">WEEK {season.week}</span>
                    </div>
                    <div className="p-12 flex items-center justify-around relative">
                      <span className="absolute text-8xl font-black text-zinc-700/10 pointer-events-none font-orbitron">VS</span>
                      <div className="text-center z-10 flex flex-col items-center gap-3">
                          {playerTeam && renderLogo(playerTeam, 'md')}
                          <div className="text-center">
                            <div className="font-black text-sm text-zinc-200 uppercase italic tracking-tighter">{playerTeam?.name}</div>
                            <div className="text-[10px] text-emerald-500/80 font-mono mt-0.5">{playerTeam?.wins}-{playerTeam?.losses}</div>
                          </div>
                      </div>
                      <div className="text-center z-10 px-8 flex flex-col items-center">
                          <div className="text-6xl font-black text-white italic tracking-tighter opacity-80 animate-pulse">VS</div>
                      </div>
                      <div className="text-center z-10 flex flex-col items-center gap-3">
                          {nextOpponent ? (
                            <>
                              {renderLogo(nextOpponent, 'md')}
                              <div className="text-center">
                                <div className="font-black text-sm text-zinc-200 uppercase italic tracking-tighter">{nextOpponent.name}</div>
                                <div className="text-[10px] text-emerald-500/80 font-mono mt-0.5">{nextOpponent.wins}-{nextOpponent.losses}</div>
                              </div>
                            </>
                          ) : <div className="text-zinc-500 font-bold text-sm italic">Simulating...</div>}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Debug Tools Section */}
                <section className="bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800 p-6 flex flex-col gap-4">
                  <h3 className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-2">Administrative Overrides</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={debugSkipToPlayoffs} className="bg-red-950/20 border border-red-500/30 text-red-500 hover:bg-red-900/20 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                      <i className="fas fa-forward-fast mr-2"></i> Skip to Playoffs
                    </button>
                    <button onClick={debugMaxStats} className="bg-orange-950/20 border border-orange-500/30 text-orange-500 hover:bg-orange-900/20 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                      <i className="fas fa-bolt-lightning mr-2"></i> Max Team Stats
                    </button>
                  </div>
                </section>
              </div>
              
              {/* Command Center Panel (Replaces Fan Feed) */}
              <div className="bg-zinc-800 rounded border border-zinc-700 flex flex-col shadow-xl overflow-hidden h-[600px]">
                <div className="p-4 border-b border-zinc-700 bg-zinc-900 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] font-orbitron">Command Center</h3>
                  <i className="fas fa-chart-line text-emerald-400 text-sm"></i>
                </div>
                <div className="p-6 space-y-8 overflow-y-auto">
                   
                   {/* Rivalry Tracker */}
                   <div>
                     <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <i className="fas fa-fire text-red-500"></i> Active Rivalries
                     </h4>
                     {playerTeam && playerTeam.rivalries && playerTeam.rivalries.length > 0 ? (
                       <div className="space-y-3">
                         {playerTeam.rivalries.slice(0, 3).map((r, i) => (
                           <div key={i} className="bg-zinc-950/50 p-3 rounded-xl border border-red-500/20 flex flex-col gap-2">
                             <div className="flex justify-between items-center">
                               <span className="text-white font-bold text-xs uppercase italic">{r.opponentName}</span>
                               <span className="text-red-500 font-black text-[10px] font-orbitron">{r.intensity}%</span>
                             </div>
                             <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-orange-500 to-red-600" style={{ width: `${r.intensity}%` }}></div>
                             </div>
                             <div className="text-[9px] text-zinc-500 italic truncate">{r.reason}</div>
                           </div>
                         ))}
                       </div>
                     ) : <div className="text-zinc-600 text-xs italic bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 text-center">No active rivalries. Yet.</div>}
                   </div>

                   {/* Squad Leader Section */}
                   <div>
                     <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Squad Leader</h4>
                     {topPlayer ? (
                       <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-700/50 flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-black ${ROLE_COLORS[topPlayer.role].bg} ${ROLE_COLORS[topPlayer.role].text} border ${ROLE_COLORS[topPlayer.role].border}`}>
                             {topPlayer.gamertag.charAt(0)}
                          </div>
                          <div>
                             <div className="text-white font-bold text-sm">{topPlayer.gamertag}</div>
                             <div className="text-[10px] text-zinc-500 font-mono uppercase">{topPlayer.role} • OVR <span className="text-emerald-400">{getPlayerOverall(topPlayer)}</span></div>
                          </div>
                       </div>
                     ) : <div className="text-zinc-600 text-xs italic">No roster data.</div>}
                   </div>

                   {/* Form Section */}
                   <div>
                      <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Recent Form</h4>
                      <div className="flex gap-2">
                         {recentForm.length > 0 ? recentForm.map((m, i) => (
                            <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] border ${m.result?.winnerId === playerTeamId ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-red-500/20 border-red-500 text-red-500'}`}>
                               {m.result?.winnerId === playerTeamId ? 'W' : 'L'}
                            </div>
                         )) : <div className="text-zinc-600 text-xs italic">Season pending...</div>}
                      </div>
                   </div>

                   {/* Staff Status */}
                   <div>
                      <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Staffing</h4>
                      <div className="grid grid-cols-5 gap-2">
                         {(Object.keys(STAFF_DEFS) as StaffRole[]).map(role => {
                            const hired = playerTeam?.staff[role];
                            const def = STAFF_DEFS[role];
                            return (
                               <div key={role} className={`aspect-square rounded-lg flex items-center justify-center border text-xs relative group cursor-help transition-all ${hired ? 'bg-zinc-800 border-zinc-600 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'bg-zinc-950 border-zinc-800 text-zinc-700'}`}>
                                  <i className={`fas ${def.icon}`}></i>
                                  {hired && <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-black"></div>}
                               </div>
                            )
                         })}
                      </div>
                   </div>

                   {/* Cap Space */}
                   <div>
                      <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">Budget Utilization</h4>
                      <div className="h-4 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 relative shadow-inner">
                         <div className="h-full bg-emerald-600 transition-all duration-1000" style={{ width: `${Math.min(100, (totalCommitments / (playerTeam?.budget || 250)) * 100)}%` }}></div>
                      </div>
                      <div className="flex justify-between text-[9px] font-mono mt-2 text-zinc-500 font-bold uppercase">
                         <span>${totalCommitments}k Committed</span>
                         <span>${playerTeam?.budget}k Total</span>
                      </div>
                   </div>
                </div>
              </div>
           </div>
        </div>
      );
      }
      case 'social': return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
              <i className="fas fa-hashtag text-blue-400"></i> Social Feed
            </h2>
            <span className="text-[10px] font-black uppercase text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 animate-pulse">Live Updates</span>
          </div>
          <div className="space-y-4 max-w-4xl mx-auto">
            {socialFeed.map((post) => (
              <div key={post.id} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-lg flex gap-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/80">
                <div className="shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-white font-bold text-lg border border-zinc-600 shadow-inner">
                    {post.author[1]?.toUpperCase() || '?'}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm hover:underline cursor-pointer">{post.author}</span>
                      {post.isVerified && <i className="fas fa-check-circle text-blue-400 text-xs" title="Verified Account"></i>}
                      <span className="text-zinc-500 text-xs">@{post.author.replace('@', '').toLowerCase()}</span>
                    </div>
                    <span className="text-zinc-600 text-[10px] font-medium">{post.timestamp}</span>
                  </div>
                  <p className="text-zinc-300 text-sm leading-relaxed">{post.content}</p>
                  <div className="flex gap-6 mt-4 text-zinc-500 text-xs">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors"><i className="far fa-comment"></i> <span>{Math.floor(Math.random() * 20)}</span></div>
                    <div className="flex items-center gap-2 cursor-pointer hover:text-green-400 transition-colors"><i className="fas fa-retweet"></i> <span>{Math.floor(Math.random() * 50)}</span></div>
                    <div className="flex items-center gap-2 cursor-pointer hover:text-red-400 transition-colors"><i className="far fa-heart"></i> <span>{post.likes}</span></div>
                    <div className="flex items-center gap-2 cursor-pointer hover:text-zinc-300 transition-colors"><i className="fas fa-share-nodes"></i></div>
                  </div>
                </div>
              </div>
            ))}
            {socialFeed.length === 0 && (
                <div className="text-center py-20 text-zinc-600 text-xs italic">
                    <i className="fas fa-satellite-dish text-4xl mb-4 opacity-50"></i>
                    <p>Connecting to league network...</p>
                </div>
            )}
          </div>
        </div>
      );
      case 'league': return (
        <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500 pb-20">
          <div className="bg-zinc-800 rounded border border-zinc-700 overflow-hidden shadow-xl">
            <table className="w-full text-left">
              <thead className="bg-black/20 text-zinc-500 text-[10px] uppercase font-black tracking-widest border-b border-zinc-700">
                <tr><th className="p-4 w-12 text-center">#</th><th className="p-4">Squad</th><th className="p-4 text-center">W</th><th className="p-4 text-center">L</th><th className="p-4 text-center">K/D Diff</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/50 text-sm">
                {sortedStandings.map((t, i) => (
                  <tr key={t.id} className={t.id === playerTeamId ? 'bg-emerald-500/10' : 'hover:bg-zinc-900/50'}>
                    <td className="p-4 text-center font-bold text-zinc-500">{i+1}</td>
                    <td className="p-4 font-bold text-white uppercase italic">
                      <button onClick={() => setInspectTeamId(t.id)} className="hover:text-emerald-400 transition-colors uppercase italic font-black">
                        {t.name}
                      </button>
                    </td>
                    <td className="p-4 text-center text-emerald-400 font-bold">{t.wins}</td>
                    <td className="p-4 text-center text-red-400 font-bold">{t.losses}</td>
                    <td className="p-4 text-center text-zinc-500 font-mono">{t.kills - t.deaths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {season.playoffStage && renderBracket()}
        </div>
      );
      case 'trading': return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
          <h2 className="text-2xl font-black text-white mb-6 tracking-tighter uppercase italic flex items-center gap-3">
            <i className="fas fa-handshake text-blue-500"></i> Trading Block
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.filter(t => t.id !== playerTeamId).map(team => (
              <div key={team.id} className="bg-zinc-800 p-6 rounded-3xl border border-zinc-700 flex flex-col gap-4 shadow-xl hover:border-blue-500/50 transition-all group">
                <div className="flex items-center gap-4">
                  {renderLogo(team, 'sm')}
                  <div>
                    <div className="text-white font-black uppercase italic text-lg">{team.name}</div>
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{team.wins}-{team.losses} • OVR {getTeamOverall(team)}</div>
                  </div>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                   <div className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-2">Top Asset</div>
                   {(() => {
                      const topPlayer = [...team.roster].sort((a,b) => getPlayerOverall(b) - getPlayerOverall(a))[0];
                      if (!topPlayer) return <div className="text-zinc-600 text-xs italic">No roster</div>;
                      return (
                        <div className="flex justify-between items-center">
                          <span className="text-white font-bold text-sm">{topPlayer.gamertag}</span>
                          <span className="text-emerald-500 font-black font-orbitron">{getPlayerOverall(topPlayer)}</span>
                        </div>
                      )
                   })()}
                </div>
                <button 
                  onClick={() => setTradeModal({ targetTeamId: team.id })}
                  className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-blue-500/30"
                >
                  Negotiate Deal
                </button>
              </div>
            ))}
          </div>
        </div>
      );
      case 'hq': return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Free Agency Market</h2>
          <div className="bg-zinc-800 rounded border border-zinc-700 overflow-hidden shadow-xl">
            <table className="w-full text-left">
              <thead className="bg-black/20 text-zinc-500 text-[10px] uppercase font-black tracking-widest border-b border-zinc-700">
                <tr>
                  <th className="p-4">Role</th>
                  <th className="p-4">Gamertag</th>
                  <th className="p-4 text-center">AIM</th>
                  <th className="p-4 text-center">IQ</th>
                  <th className="p-4 text-center">OVR</th>
                  {season.mode === 'dynasty' && <th className="p-4 text-center">Terms</th>}
                  <th className="p-4 text-right">Cost</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/50 text-sm">
                {freeAgents.slice(0, 15).map(p => {
                    const colors = ROLE_COLORS[p.role];
                    return (
                        <tr key={p.id} className="hover:bg-zinc-900/50">
                            <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${colors.bg} ${colors.text} ${colors.border}`}>{p.role}</span></td>
                            <td className="p-4 font-bold text-white">{p.gamertag}</td>
                            <td className="p-4 text-center font-digital text-zinc-400">{p.aim}</td>
                            <td className="p-4 text-center font-digital text-zinc-400">{p.iq}</td>
                            <td className="p-4 text-center font-black text-white">{getPlayerOverall(p)}</td>
                            {season.mode === 'dynasty' && <td className="p-4 text-center font-mono text-zinc-400">{p.contractYears} yrs</td>}
                            <td className="p-4 text-right font-mono text-emerald-400">${p.salary}k</td>
                            <td className="p-4 text-right"><button onClick={() => handleSign(p.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-[10px] font-black uppercase">Sign</button></td>
                        </tr>
                    )
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
      case 'personnel': return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
          <h2 className="text-2xl font-black text-white mb-6 tracking-tighter uppercase italic flex items-center gap-3"><i className="fas fa-id-card-clip text-emerald-500"></i> Squad Personnel</h2>
          <div className="grid grid-cols-3 gap-6">
            {(Object.keys(STAFF_DEFS) as StaffRole[]).map(role => {
              const staff = playerTeam?.staff[role];
              const def = STAFF_DEFS[role];
              return (
                <div key={role} className="bg-zinc-800 p-8 rounded-3xl border border-zinc-700 flex flex-col items-center text-center shadow-xl group">
                  <div className={`w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center text-3xl mb-6 shadow-inner ${def.color}`}><i className={`fas ${def.icon}`}></i></div>
                  <h3 className="font-black text-white text-base uppercase tracking-widest">{role}</h3>
                  <p className="text-xs text-zinc-500 mt-2 font-sans px-4 leading-relaxed">{def.desc}</p>
                  {staff ? (
                    <div className="mt-8 w-full space-y-3">
                      <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                        <div className={`font-black uppercase tracking-widest text-[10px] mb-1 ${staff.tier === 'Prismatic' ? 'text-purple-400 animate-pulse' : 'text-emerald-500'}`}>{staff.tier} Staff Member</div>
                        <div className="text-white font-bold text-sm italic">{staff.name}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                         <button onClick={() => releaseStaff(role)} className="bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Release</button>
                         {staff.tier !== 'Prismatic' && <button onClick={() => promoteStaff(role)} className="bg-zinc-700 hover:bg-emerald-600 text-zinc-300 hover:text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Promote</button>}
                      </div>
                    </div>
                  ) : <button onClick={() => setRecruitmentRole(role)} className="mt-8 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all">Recruit</button>}
                </div>
              );
            })}
          </div>
        </div>
      );
      case 'roster': return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
          <section>
            <h2 className="text-xl font-black text-emerald-500 mb-1 tracking-tighter uppercase italic flex items-center gap-3"><i className="fas fa-bolt"></i> Starting Rotation</h2>
            <div className="bg-zinc-800 rounded border border-zinc-700 overflow-hidden shadow-xl">
              <table className="w-full text-left">
                <thead className="bg-black/20 text-zinc-500 text-[10px] uppercase font-black tracking-widest border-b border-zinc-700">
                  <tr>
                    <th className="p-4">Role</th>
                    <th className="p-4">Gamertag</th>
                    <th className="p-4 text-center">AIM</th>
                    <th className="p-4 text-center">IQ</th>
                    <th className="p-4 text-center">OVR</th>
                    {season.mode === 'dynasty' && <th className="p-4 text-center">Morale</th>}
                    <th className="p-4 text-right">Contract</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700/50 text-sm">
                  {playerTeam?.roster.slice(0, 5).map(p => {
                      const colors = ROLE_COLORS[p.role];
                      return (
                          <tr key={p.id} className="hover:bg-zinc-900/50">
                          <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${colors.bg} ${colors.text} ${colors.border}`}>{p.role}</span></td>
                          <td className="p-4 font-bold text-white">{p.gamertag}</td>
                          <td className="p-4 text-center font-digital text-zinc-400">{p.aim}</td>
                          <td className="p-4 text-center font-digital text-zinc-400">{p.iq}</td>
                          <td className="p-4 text-center font-black text-emerald-500 bg-emerald-500/5 rounded">{getPlayerOverall(p)}</td>
                          {season.mode === 'dynasty' && (
                            <td className="p-4 text-center">
                              <div className="w-16 h-1.5 bg-zinc-700 rounded-full mx-auto overflow-hidden">
                                <div className={`h-full ${p.morale > 80 ? 'bg-emerald-500' : p.morale > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${p.morale}%` }}></div>
                              </div>
                            </td>
                          )}
                          <td className="p-4 text-right text-zinc-400 font-mono">${p.salary}k {season.mode === 'dynasty' && <span className="text-zinc-600 text-xs">({p.contractYears}y)</span>}</td>
                          <td className="p-4 text-right"><button onClick={() => handleRelease(p.id)} className="bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white px-2 py-1 rounded text-[10px] font-black uppercase">Release</button></td>
                          </tr>
                      )
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="text-xl font-black text-zinc-500 mb-1 tracking-tighter uppercase italic flex items-center gap-3"><i className="fas fa-users"></i> Reserve Subs</h2>
            <div className="bg-zinc-800 rounded border border-zinc-700 overflow-hidden shadow-xl">
              <table className="w-full text-left">
                <thead className="bg-black/20 text-zinc-500 text-[10px] uppercase font-black tracking-widest border-b border-zinc-700">
                  <tr>
                    <th className="p-4">Role</th>
                    <th className="p-4">Gamertag</th>
                    <th className="p-4 text-center">AIM</th>
                    <th className="p-4 text-center">IQ</th>
                    <th className="p-4 text-center">OVR</th>
                    {season.mode === 'dynasty' && <th className="p-4 text-center">Morale</th>}
                    <th className="p-4 text-right">Contract</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700/50 text-sm">
                  {playerTeam?.roster.slice(5).map(p => {
                      const colors = ROLE_COLORS[p.role];
                      return (
                          <tr key={p.id} className="hover:bg-zinc-900/50">
                          <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${colors.bg} ${colors.text} ${colors.border}`}>{p.role}</span></td>
                          <td className="p-4 font-bold text-zinc-400">{p.gamertag}</td>
                          <td className="p-4 text-center font-digital text-zinc-500">{p.aim}</td>
                          <td className="p-4 text-center font-digital text-zinc-500">{p.iq}</td>
                          <td className="p-4 text-center font-black text-zinc-400">{getPlayerOverall(p)}</td>
                          {season.mode === 'dynasty' && (
                            <td className="p-4 text-center">
                              <div className="w-16 h-1.5 bg-zinc-700 rounded-full mx-auto overflow-hidden">
                                <div className={`h-full ${p.morale > 80 ? 'bg-emerald-500' : p.morale > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${p.morale}%` }}></div>
                              </div>
                            </td>
                          )}
                          <td className="p-4 text-right text-zinc-500 font-mono">${p.salary}k {season.mode === 'dynasty' && <span className="text-zinc-600 text-xs">({p.contractYears}y)</span>}</td>
                          <td className="p-4 text-right"><button onClick={() => handleRelease(p.id)} className="bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white px-2 py-1 rounded text-[10px] font-black uppercase">Release</button></td>
                          </tr>
                      )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      );
      case 'schedule': return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
          <h2 className="text-2xl font-black text-white mb-6 tracking-tighter uppercase italic px-2">Season Schedule</h2>
          {Array.from({ length: TOTAL_SEASON_WEEKS }).map((_, i) => {
            const wk = i + 1;
            const playerMatch = (schedule[wk] || []).find(m => m.homeId === playerTeamId || m.awayId === playerTeamId);
            if (!playerMatch) return null;
            const isCompleted = wk < season.week;
            const opponent = teams.find(t => t.id === (playerMatch.homeId === playerTeamId ? playerMatch.awayId : playerMatch.homeId));
            if (!opponent || !playerTeam) return null;
            return (
              <div key={wk} className={`p-6 rounded-3xl border flex flex-col gap-6 shadow-xl transition-all ${wk === season.week ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-zinc-900/50 border-zinc-800'}`}>
                <div className="flex items-center justify-between px-4">
                  <div className="flex items-center gap-6 flex-1">
                    <div className="flex flex-col items-end text-right"><span className="text-white font-black text-lg uppercase italic tracking-tighter">{playerTeam.name}</span></div>
                    {renderLogo(playerTeam, 'sm')}
                  </div>
                  <div className="flex flex-col items-center px-10">
                    {isCompleted && playerMatch.result ? (
                      <div className="text-3xl font-black text-white font-digital tracking-widest">
                        {playerMatch.homeId === playerTeamId ? playerMatch.result.homeScore : playerMatch.result.awayScore}
                        <span className="mx-2 text-zinc-700">-</span>
                        {playerMatch.homeId === playerTeamId ? playerMatch.result.awayScore : playerMatch.result.homeScore}
                      </div>
                    ) : <div className="text-4xl font-black text-white/10 italic font-orbitron">VS</div>}
                  </div>
                  <div className="flex items-center gap-6 flex-1 justify-end">
                    {renderLogo(opponent, 'sm')}
                    <div className="flex flex-col items-start text-left"><span className="text-white font-black text-lg uppercase italic tracking-tighter">{opponent.name}</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
      default: return null;
    }
  };

  const handleDragStart = (idx: number) => { setDraggedIdx(idx); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (targetIdx: number) => { if (draggedIdx !== null) { swapPlayers(draggedIdx, targetIdx); setDraggedIdx(null); } };

  const hasStrategist = !!playerTeam?.staff["Strategist"];
  const hasHeadCoach = !!playerTeam?.staff["Head Coach"];

  const getSidebarButtonLabel = () => {
    if (season.playoffStage === 'semis') return isPlayerInHunt ? 'Play Semi-Finals' : 'Simulate Semis';
    if (season.playoffStage === 'finals') return isPlayerInHunt ? 'Play Finals' : 'Simulate Finals';
    if (season.playoffStage === 'complete') return 'Season Summary';
    if (season.week > TOTAL_SEASON_WEEKS && !season.playoffStage) return 'Setup Playoffs';
    return 'Next Match';
  };

  const playerPickPosition = useMemo(() => {
    return draftOrder.indexOf(playerTeamId) + 1;
  }, [draftOrder, playerTeamId]);

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 overflow-hidden">
      <audio ref={titleAudio} loop src="https://www.dropbox.com/scl/fi/352afiwuk0ml7ekccqr1i/Dameon-Angell-TWDT-Manager-Start-Screen.wav?rlkey=z4nlllxfnqwd4xofmxmyp7qu5&st=ygiyb5xr&raw=1" />
      <audio ref={gameAudio} onEnded={handleTrackEnded} src={GAME_PLAYLIST[currentTrackIdx]} />
      
      {/* VIEW: Title Screen */}
      {view === 'title' && (
        <section className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-50 overflow-hidden font-orbitron">
          <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover -z-10">
            <source src="https://www.dropbox.com/scl/fi/eujcflk7zterpozmkai0b/TWDTStartScreen.mp4?rlkey=tflbkjmi9h5ttyo4qhfg3c6aq&st=c6os3sht&raw=1" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/50 -z-10 backdrop-blur-[2px]"></div>
          
          <button 
            onClick={() => setMusicOn(!musicOn)} 
            className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-black/20 border border-white/10 hover:border-emerald-500/50 hover:bg-black/40 text-white transition-all backdrop-blur-md group"
          >
            <i className={`fas ${musicOn ? 'fa-volume-high' : 'fa-volume-xmark text-red-500'} group-hover:scale-110 transition-transform`}></i>
          </button>

          <div className="text-center space-y-12 animate-in zoom-in-95 duration-1000">
            <div className="drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
              <i className="fas fa-shield-halved text-emerald-500 text-6xl mb-4 animate-pulse"></i>
              <h1 className="text-7xl font-black text-white tracking-tighter uppercase italic">TWDT <span className="text-emerald-500">Manager 2026</span></h1>
              <p className="text-zinc-300 text-lg uppercase tracking-[0.3em] mt-2 font-black border-y border-zinc-100/10 py-2">Trench Wars Draft Tournament</p>
            </div>
            <div className="flex flex-col gap-4 w-72 mx-auto font-sans">
              <button onClick={loadGame} disabled={!hasSave} className={`group bg-white/5 border border-white/10 hover:border-white/30 text-white font-black py-4 rounded transition-all uppercase tracking-widest flex items-center justify-center gap-3 backdrop-blur-md ${!hasSave ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:bg-white/10'}`}>Continue Game</button>
              <button onClick={() => { setSeason(prev => ({ ...prev, mode: 'standard' })); setView('onboarding'); }} className="bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600 hover:text-emerald-400 font-black py-4 rounded transition-all uppercase tracking-widest flex items-center justify-center gap-3 backdrop-blur-md">Single Season</button>
              <button onClick={() => { setSeason(prev => ({ ...prev, mode: 'dynasty' })); setView('onboarding'); }} className="bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600 hover:text-blue-400 font-black py-4 rounded transition-all uppercase tracking-widest flex items-center justify-center gap-3 backdrop-blur-md">Dynasty Mode</button>
              <button onClick={() => setView('options')} className="bg-white/5 border border-white/10 hover:border-white/30 text-white font-black py-4 rounded transition-all uppercase tracking-widest flex items-center justify-center gap-3 backdrop-blur-md">Options</button>
            </div>
          </div>
        </section>
      )}

      {/* VIEW: Onboarding (Squad Creation) */}
      {view === 'onboarding' && (
        <section className="absolute inset-0 flex items-center justify-center bg-zinc-950 p-4 z-40 overflow-y-auto">
          <div className="bg-zinc-900 p-8 md:p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-5xl w-full border border-zinc-800 animate-in zoom-in-95 duration-500 flex flex-col md:flex-row gap-16 relative">
            <img src="https://i.imgur.com/RQRFZzd.png" className="absolute top-6 right-6 md:top-10 md:right-10 w-16 md:w-20 opacity-80 hover:opacity-100 transition-opacity z-50" alt="League Logo" />
            <div className="w-full md:w-2/5 flex flex-col items-center justify-center bg-black/40 rounded-[2.5rem] p-10 border border-zinc-800 shadow-inner">
               <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-12 font-orbitron">Logo Preview</h3>
               {renderLogo({ name: obName, colors: { primary: obPrimary, secondary: obSecondary }, logoConfig: { shape: obShape, gradient: obGradient } }, 'lg')}
               <div className="mt-14 text-center">
                  <div className="text-3xl font-black text-white uppercase tracking-tighter font-orbitron italic drop-shadow-lg">{obName}</div>
                  <div className="text-[11px] text-emerald-500 font-bold uppercase tracking-[0.2em] mt-3 bg-emerald-500/5 px-4 py-1 rounded-full border border-emerald-500/20">{obTitle}</div>
               </div>
            </div>
            <div className="flex-1 space-y-8">
              <div><h2 className="text-4xl font-black text-white font-orbitron uppercase italic tracking-tighter mb-2">Squad Creation</h2><p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Welcome to the League ...</p></div>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Designation</label><input value={obName} onChange={(e) => setObName(e.target.value)} type="text" placeholder="SQUAD NAME" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all" /></div>
                  <div><label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Prestige Title</label><select value={obTitle} onChange={(e) => setObTitle(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all">{AVAILABLE_TITLES.map(title => (<option key={title.id} value={title.label} disabled={careerChampionships < title.minWins}>{title.label}</option>))}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800"><label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Primary</label><input value={obPrimary} onChange={(e) => setObPrimary(e.target.value)} type="color" className="w-full h-10 rounded-lg cursor-pointer bg-zinc-900 border-none p-0 overflow-hidden" /></div>
                  <div className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800"><label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Secondary</label><input value={obSecondary} onChange={(e) => setObSecondary(e.target.value)} type="color" className="w-full h-10 rounded-lg cursor-pointer bg-zinc-900 border-none p-0 overflow-hidden" /></div>
                </div>
                <div><label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Geometry</label><div className="grid grid-cols-4 gap-2">{(['square', 'rounded', 'circle', 'hexagon'] as LogoShape[]).map(s => (<button key={s} onClick={() => setObShape(s)} className={`py-3 rounded-xl border font-black text-[10px] uppercase transition-all ${obShape === s ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}>{s}</button>))}</div></div>
                <div><label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">Gradient</label><div className="grid grid-cols-3 gap-2">{(['linear', 'radial', 'conic'] as LogoGradient[]).map(g => (<button key={g} onClick={() => setObGradient(g)} className={`py-3 rounded-xl border font-black text-[10px] uppercase transition-all ${obGradient === g ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}>{g}</button>))}</div></div>
              </div>
              <div className="pt-6 space-y-4"><button onClick={() => initGame(obName, obTitle, obPrimary, obSecondary, obShape, obGradient, season.mode)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all uppercase tracking-[0.25em] font-orbitron text-lg flex items-center justify-center gap-3">Confirm Squad <i className="fas fa-check-circle"></i></button></div>
            </div>
          </div>
        </section>
      )}

      {/* VIEW: Options Menu */}
      {view === 'options' && (
        <section className="absolute inset-0 flex items-center justify-center bg-zinc-950 p-4 z-40">
           <div className="bg-zinc-900 p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-xl w-full border border-zinc-800 animate-in zoom-in-95 duration-500 font-orbitron">
              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-8 text-center">Options</h2>
              <div className="space-y-8 font-sans">
                <div className="flex justify-between items-center">
                  <label className="text-zinc-400 font-black uppercase text-xs tracking-widest">Music</label>
                  <button onClick={() => setMusicOn(!musicOn)} className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase border transition-all ${musicOn ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-900/20 border-red-500/30 text-red-500'}`}>{musicOn ? 'Enabled' : 'Muted'}</button>
                </div>
                <div className="space-y-3">
                  <label className="text-zinc-400 font-black uppercase text-xs tracking-widest block">Music Volume</label>
                  <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                  <div className="flex justify-between text-[9px] text-zinc-600 font-black uppercase"><span>0%</span><span>{Math.round(volume*100)}%</span><span>100%</span></div>
                </div>
                <div className="pt-8 flex flex-col gap-4">
                  <button onClick={() => setView('title')} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all">BACK</button>
                </div>
              </div>
           </div>
        </section>
      )}

      {/* VIEW: Draft Phase */}
      {view === 'draft' && (
        <section className="absolute inset-0 flex flex-col bg-zinc-950 z-30">
          <header className="bg-black border-b border-zinc-800 p-6 flex justify-between items-center shadow-2xl font-orbitron z-20">
             <div className="flex items-center gap-6">
                <div><h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Draft Room</h2></div>
                <div className="flex flex-col">{draftOrder[currentPickIdx] === playerTeamId ? (<div className="flex items-center gap-5"><div className="text-emerald-400 font-bold text-xl animate-pulse tracking-[0.3em]">YOUR TURN TO PICK</div><div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-1 rounded-xl text-emerald-400 font-digital text-3xl">{formatTime(timeLeft)}</div></div>) : (<div className="text-zinc-600 text-sm font-black italic uppercase tracking-widest">{teams.find(t => t.id === draftOrder[currentPickIdx])?.name} is calculating...</div>)}</div>
             </div>
             <div className="flex items-center gap-12 border-x border-zinc-800 px-12">
               <div className="flex gap-2">
                <button 
                  onClick={() => setIsAutoDraft(!isAutoDraft)} 
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${isAutoDraft ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.8)]' : 'bg-red-900/20 border-red-500/50 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:border-red-500'}`}
                >
                  Auto-Draft: {isAutoDraft ? 'ON' : 'OFF'}
                </button>
                {/* Feature: End Draft early when roster is full for Dynasty Mode */}
                {playerTeam && playerTeam.roster.length >= 8 && season.mode === 'dynasty' && (
                   <button 
                    onClick={endDraftEarly} 
                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-yellow-500/50 bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600 hover:text-white transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                   >
                    End Draft (Skip Rem.)
                   </button>
                )}
               </div>
               <div className="flex flex-col text-right"><span className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">Commitments</span><span className="font-digital text-xl font-bold text-orange-400">${totalCommitments}k</span></div>
               <div className="flex flex-col text-right"><span className="text-[10px] text-emerald-500 uppercase font-black tracking-widest">Available</span><span className="font-digital text-xl font-bold text-emerald-400">${availableFunds}k</span></div>
             </div>
             <div className="text-right"><div className="text-xl font-black text-white uppercase italic">{teams.find(t => t.id === draftOrder[currentPickIdx])?.name}</div></div>
          </header>
          <div className="flex-1 flex overflow-hidden">
             {/* Left: Pilot Selection */}
             <div className="flex-1 overflow-y-auto bg-zinc-900/20">
               <table className="w-full text-left">
                 <thead className="bg-zinc-950 text-zinc-600 text-[10px] uppercase font-black tracking-widest sticky top-0 z-10 shadow-md border-b border-zinc-800">
                   <tr>
                     <th className="p-5">Role</th>
                     <th className="p-5">Gamertag</th>
                     <th className="p-5 text-center">AIM</th>
                     <th className="p-5 text-center">IQ</th>
                     <th className="p-5 text-center">OVR</th>
                     <th className="p-5 text-right">Cost</th>
                     <th className="p-5 text-right">Action</th>
                   </tr>
                 </thead>
                 <tbody className="text-sm divide-y divide-zinc-800/50">
                   {draftPool.slice(0, 50).map(p => { 
                     const colors = ROLE_COLORS[p.role]; 
                     return (
                       <tr key={p.id} className="hover:bg-white/[0.02] transition-all group">
                         <td className="p-5"><span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border ${colors.bg} ${colors.text} ${colors.border} shadow-sm`}>{p.role}</span></td>
                         <td className="p-5 font-black text-zinc-100 uppercase italic">{p.gamertag}</td>
                         <td className="p-5 text-center text-zinc-400 font-digital">{p.aim}</td>
                         <td className="p-5 text-center text-zinc-400 font-digital">{p.iq}</td>
                         <td className="p-5 text-center font-black text-white bg-white/5">{getPlayerOverall(p)}</td>
                         <td className="p-5 text-right text-emerald-500 font-mono font-bold">${p.salary}k</td>
                         <td className="p-5 text-right">
                           <button 
                             onClick={() => handleDraftPick(p, playerTeamId)} 
                             disabled={draftOrder[currentPickIdx] !== playerTeamId} 
                             className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                           >
                             Draft
                           </button>
                         </td>
                       </tr>
                     ) 
                   })}
                 </tbody>
               </table>
             </div>

             {/* Middle: Draft Feed */}
             <aside className="w-72 bg-zinc-900 border-x border-zinc-800 flex flex-col shadow-xl">
               <div className="p-6 border-b border-zinc-800 bg-zinc-950/50">
                  <h3 className="text-zinc-500 font-black text-[10px] uppercase tracking-[0.3em] font-orbitron flex items-center gap-2">
                    <i className="fas fa-rss text-emerald-500 animate-pulse"></i> Draft Feed
                  </h3>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {draftLog.map((log, i) => {
                    const pickTeam = teams.find(t => t.id === log.teamId);
                    return (
                      <div key={i} className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter">Round {log.round}</span>
                          <span className="text-[10px] font-black text-emerald-500 font-orbitron">OVR {log.overall}</span>
                        </div>
                        <div className="text-[10px] font-black text-white uppercase italic truncate" style={{ color: pickTeam?.colors.primary }}>{log.team}</div>
                        <div className="text-[11px] font-bold text-zinc-300 mt-1">Selects: <span className="text-white italic">{log.player}</span></div>
                      </div>
                    );
                  })}
                  {draftLog.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center p-8">
                       <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest italic">Awaiting first pick...</p>
                    </div>
                  )}
               </div>
             </aside>

             {/* Right: Squad Roster */}
             <aside className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl">
               <div className="p-6 border-b border-zinc-800 bg-zinc-900/30">
                 <h3 className="text-zinc-500 font-black text-[10px] uppercase tracking-[0.3em] mb-6 flex justify-between font-orbitron">
                   <span>Squad Roster</span>
                   <span className="text-white">{playerTeam?.roster.length}/8</span>
                 </h3>
                 <div className="space-y-3 overflow-y-auto max-h-[70vh]">
                   {playerTeam?.roster.map(p => { 
                     const colors = ROLE_COLORS[p.role]; 
                     return (
                       <div key={p.id} className={`bg-zinc-900/50 p-4 rounded-2xl border flex justify-between items-center ${colors.border}`}>
                         <div className="flex flex-col">
                           <div className="text-[11px] font-black text-white uppercase italic">{p.gamertag}</div>
                           <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${colors.text}`}>{p.role}</div>
                           <div className="flex gap-2 mt-1">
                             <span className="text-[8px] text-zinc-500 uppercase">AIM: <span className="text-zinc-300 font-digital">{p.aim}</span></span>
                             <span className="text-[8px] text-zinc-500 uppercase">IQ: <span className="text-zinc-300 font-digital">{p.iq}</span></span>
                           </div>
                         </div>
                         <div className="text-emerald-500 font-black font-orbitron text-base">{getPlayerOverall(p)}</div>
                       </div>
                     ) 
                   })}
                 </div>
               </div>
             </aside>
          </div>

          {/* Owner Welcome Modal */}
          {showOwnerWelcome && (
            <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-xl">
               <div className="bg-zinc-900 border-2 border-zinc-800 p-12 rounded-[3rem] max-w-2xl w-full shadow-[0_0_100px_rgba(0,0,0,1)] font-orbitron animate-in zoom-in-95 duration-500 relative">
                  <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
                  <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl mb-4 border border-zinc-700 shadow-xl text-yellow-500">
                      <i className="fas fa-crown"></i>
                    </div>
                    <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase">Message from Ownership</h2>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Season {season.season} Operations</p>
                  </div>

                  <div className="space-y-6 bg-black/40 p-8 rounded-3xl border border-zinc-800 mb-8 shadow-inner">
                    <div>
                      <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                        "Congratulations, GM. We've entrusted you with the future of the <span className="text-emerald-500 font-bold">{playerTeam?.name}</span>. The fans expect results, and the board has set high targets for this tournament cycle."
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Season Objectives:</h4>
                      <ul className="space-y-2">
                        {currentObjectives.map((obj, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex gap-3">
                            <span className="text-emerald-500 font-black">•</span> {obj}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-4 border-t border-zinc-800 mt-4">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Draft Strategy:</span>
                         <span className="text-white font-black italic bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/30">PICK ORDER: #{playerPickPosition}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowOwnerWelcome(false)} 
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-xl font-orbitron"
                  >
                    Accept Objectives & Start Draft
                  </button>
               </div>
            </div>
          )}
        </section>
      )}

      {/* VIEW: Season Summary Debrief */}
      {view === 'seasonSummary' && (
        <section className="absolute inset-0 bg-zinc-950 z-[160] overflow-y-auto p-12 flex flex-col font-sans animate-in fade-in duration-700">
           <header className="mb-12 text-center">
              <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-2 font-orbitron">Season {season.season} Debrief</h1>
              <p className="text-zinc-500 text-sm uppercase tracking-[0.3em] font-bold">Performance Evaluation</p>
           </header>
           
           <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
              {/* Left: Campaign Stats */}
              <div className="space-y-8">
                 <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-xl">
                    <h3 className="text-lg font-black text-white uppercase italic tracking-tighter mb-6 flex items-center gap-2"><i className="fas fa-chart-bar text-blue-500"></i> Campaign Results</h3>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                          <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Regular Season</span>
                          <span className="text-white font-black font-digital text-xl">{playerTeam?.wins} - {playerTeam?.losses}</span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                          <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Final Ranking</span>
                          <span className="text-white font-black font-digital text-xl">#{sortedStandings.findIndex(t => t.id === playerTeamId) + 1}</span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                          <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Championships</span>
                          <span className="text-yellow-500 font-black font-digital text-xl">{playerTeam?.championships}</span>
                       </div>
                       <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">K/D Differential</span>
                          <span className={`font-black font-digital text-xl ${(playerTeam?.kills || 0) - (playerTeam?.deaths || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{(playerTeam?.kills || 0) - (playerTeam?.deaths || 0)}</span>
                       </div>
                    </div>
                 </div>

                 <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-xl">
                    <h3 className="text-lg font-black text-white uppercase italic tracking-tighter mb-6 flex items-center gap-2"><i className="fas fa-check-circle text-emerald-500"></i> Owner Objectives</h3>
                    <div className="space-y-3">
                       {currentObjectives.map((obj, i) => {
                          const met = checkObjective(obj);
                          return (
                             <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${met ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-red-950/20 border-red-900/30'}`}>
                                <div className={`mt-0.5 ${met ? 'text-emerald-500' : 'text-red-500'}`}><i className={`fas ${met ? 'fa-check' : 'fa-times'}`}></i></div>
                                <div className={`text-xs font-medium leading-tight ${met ? 'text-emerald-100' : 'text-red-200'}`}>{obj}</div>
                             </div>
                          )
                       })}
                    </div>
                 </div>
              </div>

              {/* Middle: Player Development */}
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-xl flex flex-col">
                 <h3 className="text-lg font-black text-white uppercase italic tracking-tighter mb-6 flex items-center gap-2"><i className="fas fa-dumbbell text-orange-500"></i> Pilot Development</h3>
                 <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[60vh]">
                    {playerTeam?.roster.map(p => {
                       const aimGain = p.originalStats ? p.aim - p.originalStats.aim : 0;
                       const iqGain = p.originalStats ? p.iq - p.originalStats.iq : 0;
                       return (
                          <div key={p.id} className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-2xl flex justify-between items-center">
                             <div>
                                <div className="text-white font-bold text-sm">{p.gamertag}</div>
                                <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{p.role}</div>
                             </div>
                             <div className="flex gap-4 text-xs font-mono">
                                <div className="flex flex-col items-center">
                                   <span className="text-zinc-600 text-[9px] uppercase font-bold">AIM</span>
                                   <span className={aimGain > 0 ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>{aimGain > 0 ? '+' : ''}{aimGain}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                   <span className="text-zinc-600 text-[9px] uppercase font-bold">IQ</span>
                                   <span className={iqGain > 0 ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>{iqGain > 0 ? '+' : ''}{iqGain}</span>
                                </div>
                             </div>
                          </div>
                       )
                    })}
                 </div>
              </div>

              {/* Right: Contract Status (Dynasty only) or Generic Info */}
              <div className="flex flex-col gap-8">
                 {season.mode === 'dynasty' ? (
                    <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-xl flex-1 flex flex-col">
                       <h3 className="text-lg font-black text-white uppercase italic tracking-tighter mb-6 flex items-center gap-2"><i className="fas fa-file-contract text-yellow-500"></i> Contract Ledger</h3>
                       <div className="flex-1 overflow-y-auto space-y-2 pr-2 max-h-[60vh]">
                          {playerTeam?.roster.map(p => {
                             // Logic: contractYears will be decremented next season. So if it's 1 now, it expires.
                             const isExpiring = p.contractYears <= 1;
                             return (
                                <div key={p.id} className={`p-3 rounded-xl border flex justify-between items-center ${isExpiring ? 'bg-red-950/20 border-red-900/50' : 'bg-zinc-950/30 border-zinc-800'}`}>
                                   <span className="text-zinc-200 text-xs font-bold">{p.gamertag}</span>
                                   <span className={`text-[10px] font-black uppercase tracking-widest ${isExpiring ? 'text-red-400 animate-pulse' : 'text-emerald-500'}`}>
                                      {isExpiring ? 'EXPIRING' : `${p.contractYears} Seasons Left`}
                                   </span>
                                </div>
                             )
                          })}
                       </div>
                       <p className="text-[10px] text-zinc-500 mt-4 text-center">Expiring contracts will enter the draft pool immediately.</p>
                    </div>
                 ) : (
                    <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-xl flex-1 flex items-center justify-center text-center">
                        <div>
                           <i className="fas fa-info-circle text-4xl text-zinc-700 mb-4"></i>
                           <p className="text-zinc-400 text-sm">Standard Season Mode active.<br/>Rosters will reset for the next draft cycle.</p>
                        </div>
                    </div>
                 )}
              </div>
           </div>

           <div className="mt-12 text-center">
              {season.mode === 'dynasty' && !currentObjectives.every(obj => checkObjective(obj)) ? (
                <div className="flex flex-col items-center animate-in zoom-in-95 duration-500">
                   <div className="w-20 h-20 bg-red-500/20 border border-red-500 text-red-500 rounded-full flex items-center justify-center text-4xl mb-6 shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse">
                      <i className="fas fa-ban"></i>
                   </div>
                   <h2 className="text-3xl font-black text-red-500 uppercase italic tracking-tighter mb-2">Contract Terminated</h2>
                   <p className="text-zinc-400 text-sm max-w-md mx-auto mb-8 font-medium">The board has reviewed your performance. Failure to meet the agreed strategic objectives has resulted in your immediate dismissal.</p>
                   <button 
                    onClick={() => setView('title')} 
                    className="bg-red-600 hover:bg-red-500 text-white font-black py-5 px-12 rounded-2xl shadow-2xl transition-all uppercase tracking-[0.25em] font-orbitron text-xl hover:scale-105 border border-red-400"
                  >
                    Leave Front Office
                  </button>
                </div>
              ) : (
                <button 
                  onClick={startNextSeason} 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 px-12 rounded-2xl shadow-2xl transition-all uppercase tracking-[0.25em] font-orbitron text-xl hover:scale-105"
                >
                  Proceed to Season {season.season + 1}
                </button>
              )}
           </div>
        </section>
      )}

      {/* VIEW: Game Over Screen (Bankruptcy) */}
      {view === 'gameOver' && (
        <section className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 overflow-hidden font-orbitron">
           <div className="absolute inset-0 bg-red-900/10 animate-pulse"></div>
           <div className="relative z-10 text-center p-10 max-w-2xl">
              <div className="text-9xl text-red-600 font-black italic tracking-tighter mb-4 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]">INSOLVENT</div>
              <h2 className="text-3xl text-white uppercase tracking-[0.5em] font-bold mb-8">Financial Collapse</h2>
              <div className="bg-zinc-900/80 border border-red-500/30 p-8 rounded-3xl shadow-2xl mb-10">
                 <p className="text-zinc-300 font-sans text-sm leading-relaxed">
                    The <span className="text-red-500 font-bold">{playerTeam?.name}</span> organization has declared bankruptcy. With insufficient funds to pay pilot salaries and league dues, the franchise has been dissolved.
                 </p>
                 <div className="mt-6 pt-6 border-t border-red-500/20 grid grid-cols-2 gap-4 text-center">
                    <div>
                       <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Seasons</div>
                       <div className="text-2xl text-white font-digital">{season.season}</div>
                    </div>
                    <div>
                       <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Championships</div>
                       <div className="text-2xl text-yellow-500 font-digital">{playerTeam?.championships}</div>
                    </div>
                 </div>
              </div>
              <button 
                onClick={() => setView('title')} 
                className="bg-white text-black hover:bg-zinc-200 font-black py-4 px-10 rounded-xl uppercase tracking-[0.3em] transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105"
              >
                Return to Title
              </button>
           </div>
        </section>
      )}

      {/* VIEW: Main Dashboard */}
      {view === 'dashboard' && (
        <>
          <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0 shadow-2xl z-10">
             <div className="p-8 border-b border-zinc-800 flex flex-col items-center bg-zinc-900/50 font-orbitron">{playerTeam && renderLogo(playerTeam, 'md')}<h2 className="font-black text-xl text-center leading-none tracking-tighter uppercase italic mt-4">{playerTeam?.name}</h2></div>
             <nav className="flex-1 py-6 px-4 space-y-2">
                {[{ id: 'overview', icon: 'crosshairs', label: 'Team HQ' }, { id: 'social', icon: 'hashtag', label: 'Social Feed' }, { id: 'hq', icon: 'briefcase', label: 'Free Agency' }, ...(season.mode === 'dynasty' ? [{ id: 'trading', icon: 'handshake', label: 'Trading Block' }] : []), { id: 'personnel', icon: 'id-card-clip', label: 'Personnel' }, { id: 'roster', icon: 'users-gear', label: 'Squad' }, { id: 'league', icon: 'list-ol', label: 'Rankings' }, { id: 'schedule', icon: 'calendar-check', label: 'Matches' }].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full text-left px-5 py-3 rounded-xl flex items-center gap-4 font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-emerald-500/10 text-emerald-400 border-l-4 border-emerald-500 shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}><i className={`fas fa-${tab.icon} w-5 text-center`}></i> {tab.label}</button>
                ))}
             </nav>
             <div className="p-6 border-t border-zinc-800 bg-zinc-950/50">
               <button 
                 onClick={() => {
                   if (season.week > TOTAL_SEASON_WEEKS && !season.playoffStage) { advanceWeek(); return; }
                   if (season.playoffStage && !isPlayerInHunt) { advanceWeek(); return; }
                   if (season.playoffStage === 'complete') { advanceWeek(); return; }
                   setView('briefing');
                 }} 
                 className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-3 font-orbitron transition-all"
               >
                 <span>{getSidebarButtonLabel()}</span><i className="fas fa-chevron-right"></i>
               </button>
             </div>
          </aside>
          <main className="flex-1 flex flex-col overflow-hidden bg-zinc-950/50">
             <header className="h-20 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-10 shrink-0 shadow-lg">
                <div className="flex items-center gap-12 font-orbitron">
                   <div className="flex flex-col"><span className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">Season Record</span><span className="font-digital text-lg font-bold text-white tracking-[0.2em]">{playerTeam?.wins} - {playerTeam?.losses}</span></div>
                   <div className="w-px h-10 bg-zinc-800"></div>
                   <div className="flex items-center gap-8">
                      <div className="flex flex-col"><span className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">Season Commitments</span><span className="font-digital text-lg font-bold text-orange-400 tracking-[0.1em]">${totalCommitments}k</span></div>
                      <div className="flex flex-col"><span className="text-[10px] text-emerald-500 uppercase font-black tracking-widest">Available</span><span className="font-digital text-lg font-bold text-emerald-400 tracking-[0.1em]">${availableFunds}k</span></div>
                   </div>
                </div>
                <div className="flex items-center gap-6 font-orbitron">
                  <button onClick={() => setMusicOn(!musicOn)} className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-500 transition-all bg-zinc-900">
                    <i className={`fas ${musicOn ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
                  </button>
                  <div className="h-8 w-px bg-zinc-800"></div>
                  <button onClick={() => setView('title')} className="text-zinc-600 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">Main Menu</button>
                </div>
             </header>
             <div className="flex-1 overflow-y-auto p-10">{renderTab()}</div>
          </main>
        </>
      )}

      {/* Roster Inspection Modal */}
      {inspectedTeam && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-6 backdrop-blur-xl">
           <div className="bg-zinc-900 border-2 border-zinc-800 p-10 rounded-[3rem] max-w-4xl w-full shadow-[0_0_100px_rgba(0,0,0,1)] font-orbitron animate-in zoom-in-95 duration-500 relative">
              <button onClick={() => setInspectTeamId(null)} className="absolute top-8 right-8 text-zinc-600 hover:text-white"><i className="fas fa-times text-2xl"></i></button>
              <div className="flex flex-col items-center mb-8">
                {renderLogo(inspectedTeam, 'md')}
                <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase mt-4">{inspectedTeam.name}</h2>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Personnel Record: {inspectedTeam.wins}-{inspectedTeam.losses}</div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[50vh] pr-4">
                <h3 className="text-emerald-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800 pb-2">Active Pilots</h3>
                <div className="grid grid-cols-2 gap-4">
                  {inspectedTeam.roster.map(p => {
                    const colors = ROLE_COLORS[p.role];
                    return (
                      <div key={p.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex justify-between items-center group">
                        <div className="flex flex-col">
                          <span className="text-white font-bold text-sm uppercase italic">{p.gamertag}</span>
                          <span className={`text-[9px] uppercase font-black tracking-widest mt-1 ${colors.text}`}>{p.role}</span>
                        </div>
                        <div className="text-emerald-500 font-black text-xl font-orbitron">{getPlayerOverall(p)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-zinc-800 flex justify-between gap-4">
                 <button onClick={() => setInspectTeamId(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Close Dossier</button>
              </div>
           </div>
        </div>
      )}

      {/* Trade Modal */}
      {tradeModal && tradeTargetTeam && (
        <div className="fixed inset-0 bg-black/95 z-[130] flex flex-col p-6 font-sans">
           <header className="flex justify-between items-center mb-6">
             <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter font-orbitron">Trade Negotiation</h2>
             <button onClick={() => setTradeModal(null)} className="text-zinc-500 hover:text-white"><i className="fas fa-times text-2xl"></i></button>
           </header>
           
           <div className="flex-1 flex gap-8 overflow-hidden">
             {/* My Team */}
             <div className="flex-1 bg-zinc-900 rounded-3xl p-6 border border-zinc-800 flex flex-col">
                <h3 className="text-emerald-500 font-black uppercase tracking-widest text-center mb-4">Your Assets</h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                   {playerTeam?.roster.map(p => (
                     <div 
                       key={p.id} 
                       onClick={() => setMyTradeOffer(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                       className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${myTradeOffer.includes(p.id) ? 'bg-emerald-500/20 border-emerald-500' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800'}`}
                     >
                       <div>
                         <div className="text-white font-bold text-sm">{p.gamertag}</div>
                         <div className="text-zinc-500 text-[10px]">{p.role} • {p.contractYears}y</div>
                       </div>
                       <div className="font-orbitron font-black text-lg">{getPlayerOverall(p)}</div>
                     </div>
                   ))}
                </div>
             </div>

             {/* Center Action */}
             <div className="w-48 flex flex-col items-center justify-center gap-4">
                <div className="text-center">
                  <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Chemistry Impact</div>
                  <div className="text-red-500 font-black text-xl">-10%</div>
                </div>
                <button onClick={handleTrade} className="bg-white text-black w-full py-4 rounded-xl font-black uppercase tracking-widest hover:scale-105 transition-transform font-orbitron">Propose Deal</button>
             </div>

             {/* Their Team */}
             <div className="flex-1 bg-zinc-900 rounded-3xl p-6 border border-zinc-800 flex flex-col">
                <h3 className="text-blue-500 font-black uppercase tracking-widest text-center mb-4">{tradeTargetTeam.name} Assets</h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                   {tradeTargetTeam.roster.map(p => (
                     <div 
                       key={p.id} 
                       onClick={() => setTheirTradeOffer(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                       className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${theirTradeOffer.includes(p.id) ? 'bg-blue-500/20 border-blue-500' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800'}`}
                     >
                       <div>
                         <div className="text-white font-bold text-sm">{p.gamertag}</div>
                         <div className="text-zinc-500 text-[10px]">{p.role} • {p.contractYears}y</div>
                       </div>
                       <div className="font-orbitron font-black text-lg">{getPlayerOverall(p)}</div>
                     </div>
                   ))}
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Recruitment Modal */}
      {recruitmentRole && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-6 backdrop-blur-xl">
           <div className="bg-zinc-900 border-2 border-zinc-800 p-10 rounded-[3rem] max-w-4xl w-full shadow-[0_0_100px_rgba(0,0,0,1)] font-orbitron animate-in zoom-in-95 duration-500 relative">
              <button onClick={() => setRecruitmentRole(null)} className="absolute top-8 right-8 text-zinc-600 hover:text-white"><i className="fas fa-times text-2xl"></i></button>
              <div className="text-center mb-12"><h2 className="text-4xl font-black italic tracking-tighter text-white">RECRUIT {recruitmentRole.toUpperCase()}</h2></div>
              <div className="grid grid-cols-3 gap-6">
                {[0, 1, 2].map((tierIdx) => {
                  const tiers = ["Bronze", "Silver", "Gold"] as const;
                  const costs = [10, 25, 50];
                  const tierColors = ["text-orange-400", "text-zinc-300", "text-yellow-400"];
                  const candidateName = CANDIDATE_NAMES[(Math.floor(Math.random() * CANDIDATE_NAMES.length) + tierIdx) % CANDIDATE_NAMES.length];
                  return (
                    <div key={tierIdx} className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 flex flex-col items-center text-center group hover:border-emerald-500/50 transition-all">
                      <div className={`text-[10px] font-black uppercase tracking-widest mb-4 ${tierColors[tierIdx]}`}>{tiers[tierIdx]} Tier</div>
                      <div className="text-white font-bold text-sm mb-2">{candidateName}</div>
                      <div className="text-zinc-400 text-[10px] font-mono mb-4">{STAFF_BONUS_DESCS[recruitmentRole][tierIdx]}</div>
                      <div className="text-emerald-500 font-mono font-black text-lg mb-4">${costs[tierIdx]}k</div>
                      <button onClick={() => hireStaff(recruitmentRole, tierIdx, candidateName)} className="w-full bg-zinc-900 hover:bg-emerald-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Sign Contract</button>
                    </div>
                  );
                })}
              </div>
           </div>
        </div>
      )}

      {/* Training Result Modal */}
      {trainingResult && (
        <div className="fixed inset-0 bg-black/90 z-[150] flex items-center justify-center p-6 backdrop-blur-xl">
           <div className="bg-zinc-900 border-2 border-zinc-800 p-10 rounded-[3rem] max-w-lg w-full shadow-[0_0_100px_rgba(0,0,0,1)] font-orbitron animate-in zoom-in-95 duration-500 relative">
              <div className={`absolute top-0 left-0 w-full h-2 ${trainingResult.success ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <div className="text-center mb-8">
                 <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl mb-4 ${trainingResult.success ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    <i className={`fas ${trainingResult.success ? 'fa-check' : 'fa-times'}`}></i>
                 </div>
                 <h2 className={`text-3xl font-black italic tracking-tighter uppercase ${trainingResult.success ? 'text-emerald-500' : 'text-red-500'}`}>
                    {trainingResult.success ? 'SESSION SUCCESS' : 'SESSION FAILED'}
                 </h2>
                 <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Impact Analysis: {trainingResult.stat.toUpperCase()}</p>
              </div>

              <div className="space-y-3 mb-8">
                 {trainingResult.changes.map((change, i) => (
                   <div key={i} className="bg-black/40 p-4 rounded-2xl border border-zinc-800 flex justify-between items-center">
                      <span className="text-zinc-200 font-bold text-sm uppercase italic">{change.pilot}</span>
                      <span className={`font-digital text-lg font-black ${change.delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {change.delta > 0 ? '+' : ''}{change.delta}
                      </span>
                   </div>
                 ))}
              </div>

              <button onClick={() => setTrainingResult(null)} className="w-full bg-zinc-100 hover:bg-white text-black py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all font-orbitron">Dismiss Report</button>
           </div>
        </div>
      )}

      {/* VIEW: Match Briefing (Prepare for Match) */}
      {view === 'briefing' && (
        <section className="absolute inset-0 flex flex-col bg-zinc-950 z-50 font-orbitron">
           <header className="bg-black border-b border-zinc-800 p-6 flex justify-between items-center shadow-xl"><div className="flex items-center gap-6"><button onClick={() => setView('dashboard')} className="text-zinc-500 hover:text-white transition p-3 rounded-xl hover:bg-zinc-800 font-sans"><i className="fas fa-arrow-left"></i></button><h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Prepare for Match</h2></div></header>
           <div className="flex-1 flex overflow-hidden font-sans">
              <aside className="w-1/3 bg-zinc-900 border-r border-zinc-800 p-8 space-y-8 shadow-2xl">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 mb-1">Combat Doctrine</label>
                    <select onChange={(e) => { const val = e.target.value as StrategyType; setTeams(prev => prev.map(t => t.id === playerTeamId ? { ...t, strategy: val } : t)); }} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl p-5 font-black uppercase tracking-widest font-orbitron shadow-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"><option value="Rush">Rush</option><option value="Control">Control</option><option value="Trap">Trap</option></select>
                  </div>
                  <div className="bg-zinc-800 p-5 rounded-2xl border border-zinc-700 relative overflow-hidden group">
                    <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fas fa-user-tie text-blue-400"></i> Coach Suggestion</h4>
                    {hasHeadCoach ? <p className="text-xs text-zinc-300 italic">"Focus on ship synergy. Strategy is lookin' tight, boss."</p> : <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight">Hire a Head Coach to unlock tactical insights.</p>}
                  </div>
                </div>
                <button 
                  disabled={isSimulating}
                  onClick={() => advanceWeek()} 
                  className={`w-full bg-emerald-600 hover:bg-emerald-500 text-white py-6 rounded-2xl font-black shadow-2xl transition-all uppercase tracking-[0.25em] font-orbitron text-lg ${isSimulating ? 'opacity-50 cursor-not-allowed' : 'animate-pulse hover:animate-none'}`}
                >
                  {isSimulating ? 'Simulating...' : 'Ready Up for Match'}
                </button>
              </aside>
              <div className="flex-1 p-10 bg-zinc-950 overflow-y-auto">
                 <div className="grid grid-cols-2 gap-16">
                    <div className="space-y-6">
                       <div className="flex items-center justify-between border-b-2 border-emerald-500/20 pb-4 mb-6">
                          <div>
                              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{playerTeam?.name}</h2>
                              <div className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-1">Your Squad</div>
                          </div>
                          <div className="text-right bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800">
                              <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Rating</div>
                              <div className="text-3xl font-black text-emerald-500 font-digital">{playerTeam ? getTeamOverall(playerTeam) : 0}</div>
                          </div>
                       </div>
                       <div>
                           <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fas fa-bolt text-emerald-500"></i> Active Duty</h3>
                           <div className="space-y-3">
                              {playerTeam?.roster.slice(0, 5).map((p, i) => {
                                const colors = ROLE_COLORS[p.role];
                                return (
                                    <div key={p.id} draggable onDragStart={() => handleDragStart(i)} onDragOver={handleDragOver} onDrop={() => handleDrop(i)} className={`bg-zinc-900/80 p-4 rounded-2xl border flex justify-between items-center text-xs shadow-lg backdrop-blur-md cursor-move hover:border-emerald-500/50 transition-colors ${colors.border}`}>
                                        <div className="flex items-center gap-4"><i className="fas fa-grip-vertical text-zinc-700"></i><div className="flex flex-col"><span className="font-black text-white text-sm uppercase italic">{p.gamertag}</span><span className={`text-[9px] uppercase font-black tracking-widest mt-1 ${colors.text}`}>{p.role}</span></div></div>
                                        <div className="text-right"><div className="text-emerald-500 font-black font-orbitron text-lg">{getPlayerOverall(p)}</div></div>
                                    </div>
                                )
                              })}
                           </div>
                       </div>
                       <div>
                           <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mt-8 mb-4 flex items-center gap-2"><i className="fas fa-users text-zinc-600"></i> Reserves</h3>
                           <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity">
                              {playerTeam?.roster.slice(5).map((p, i) => {
                                const actualIdx = i + 5;
                                const colors = ROLE_COLORS[p.role];
                                return (
                                    <div key={p.id} draggable onDragStart={() => handleDragStart(actualIdx)} onDragOver={handleDragOver} onDrop={() => handleDrop(actualIdx)} className={`bg-zinc-900/50 p-4 rounded-2xl border flex justify-between items-center text-xs shadow-lg backdrop-blur-md cursor-move hover:border-zinc-500 transition-colors ${colors.border}`}>
                                        <div className="flex items-center gap-4"><i className="fas fa-grip-vertical text-zinc-800"></i><div className="flex flex-col"><span className="font-black text-zinc-300 text-sm uppercase italic">{p.gamertag}</span><span className={`text-[9px] uppercase font-black tracking-widest mt-1 ${colors.text} opacity-50`}>{p.role}</span></div></div>
                                        <div className="text-right"><div className="text-zinc-500 font-black font-orbitron text-lg">{getPlayerOverall(p)}</div></div>
                                    </div>
                                )
                              })}
                           </div>
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="flex items-center justify-between border-b-2 border-red-500/20 pb-4 mb-6">
                          <div>
                              <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{nextOpponent?.name || 'Unknown'}</h2>
                              <div className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mt-1">Opponent</div>
                          </div>
                          {nextOpponent && (
                              <div className="text-right bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800">
                                  <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Rating</div>
                                  <div className="text-3xl font-black text-red-500 font-digital">{getTeamOverall(nextOpponent)}</div>
                              </div>
                          )}
                       </div>
                       <div>
                           <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fas fa-crosshairs text-red-500"></i> Enemy Intel</h3>
                           {hasStrategist && nextOpponent ? (
                             <div className="space-y-3 animate-in fade-in duration-500">
                               {nextOpponent.roster.slice(0, 5).map(p => {
                                 const colors = ROLE_COLORS[p.role];
                                 return (
                                   <div key={p.id} className={`bg-red-500/5 p-4 rounded-2xl border flex justify-between items-center text-xs shadow-lg ${colors.border} border-red-500/20`}>
                                     <div className="flex flex-col"><span className="font-black text-white text-sm uppercase italic">{p.gamertag}</span><span className={`text-[9px] uppercase font-black tracking-widest mt-1 ${colors.text}`}>{p.role}</span></div>
                                     <div className="text-right"><div className="text-red-500 font-black font-orbitron text-lg">{getPlayerOverall(p)}</div></div>
                                   </div>
                                 )
                               })}
                             </div>
                           ) : (
                             <div className="space-y-3">
                               {Array.from({ length: 5 }).map((_, i) => (
                                 <div key={i} className="bg-zinc-800 h-16 rounded-2xl border border-zinc-700/50 flex items-center px-6 relative overflow-hidden">
                                     <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]"><i className="fas fa-eye-slash text-zinc-600 text-xs"></i></div>
                                 </div>
                               ))}
                               <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 text-center mt-10"><i className="fas fa-lock text-zinc-700 text-2xl mb-4"></i><p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em]">Strategist Required</p></div>
                             </div>
                           )}
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>
      )}

      {/* Match Loading Screen */}
      {isSimulating && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-10 font-orbitron">
           <div className="relative w-64 h-64 mb-12">
              <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-t-4 border-emerald-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <i className="fas fa-crosshairs text-emerald-500 text-5xl animate-pulse"></i>
              </div>
           </div>
           <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4 animate-pulse">MATCH SIMULATION IN PROGRESS</h2>
           <p className="text-zinc-500 text-[10px] uppercase font-black tracking-[0.5em] animate-pulse">{loadingMessage}</p>
        </div>
      )}

      {/* VIEW: Alert Modal */}
      {alert && (<div className="fixed inset-0 bg-black/80 z-[140] flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-zinc-900 border border-zinc-700 p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl font-orbitron animate-in zoom-in-95 duration-300"><h3 className="text-xl font-black text-white mb-2 uppercase italic">{alert.title}</h3><p className="text-zinc-400 text-sm mb-6 font-sans leading-relaxed" dangerouslySetInnerHTML={{ __html: alert.desc }} /><button onClick={() => setAlert(null)} className="w-full bg-emerald-600 py-4 rounded-xl text-white font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 hover:bg-emerald-500 transition-all">Acknowledge</button></div></div>)}
      
      {/* VIEW: Confirm Modal */}
      {confirm && (<div className="fixed inset-0 bg-black/80 z-[140] flex items-center justify-center p-6 backdrop-blur-sm"><div className="bg-zinc-900 border border-zinc-700 p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl font-orbitron animate-in zoom-in-95 duration-300"><h3 className="text-xl font-black text-white mb-2 uppercase italic">{confirm.title}</h3><p className="text-zinc-400 text-sm mb-6 font-sans leading-relaxed" dangerouslySetInnerHTML={{ __html: confirm.desc }} /><div className="grid grid-cols-2 gap-3"><button onClick={() => setConfirm(null)} className="bg-zinc-800 py-4 rounded-xl text-zinc-400 font-black uppercase tracking-widest border border-zinc-700 hover:bg-zinc-700 transition-all">Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className="bg-emerald-600 py-4 rounded-xl text-white font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 hover:bg-emerald-500 transition-all">Confirm</button></div></div></div>)}
      
      {/* VIEW: Match Result Modal */}
      {showResult && (
        <div className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-6 backdrop-blur-xl">
           <div className="bg-zinc-900 border-2 border-zinc-800 p-12 rounded-[3rem] max-w-3xl w-full shadow-[0_0_100px_rgba(0,0,0,1)] font-orbitron animate-in zoom-in-95 duration-500 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
              <div className="text-center mb-10"><h2 className={`text-6xl font-black italic tracking-tighter ${showResult.result.winnerId === playerTeamId ? 'text-emerald-500' : 'text-red-500'}`}>{showResult.result.winnerId === playerTeamId ? 'VICTORY' : 'DEFEAT'}</h2><div className="text-zinc-400 mt-4 text-2xl font-digital tracking-widest">{showResult.result.homeId === playerTeamId ? showResult.result.homeScore : showResult.result.awayScore} — {showResult.result.homeId === playerTeamId ? showResult.result.awayScore : showResult.result.homeScore}</div></div>
              <div className="bg-black/40 rounded-3xl p-8 border border-zinc-800 mb-8 shadow-inner"><p className="text-zinc-200 text-sm italic leading-relaxed font-sans text-center">"{showResult.recap}"</p></div>
              
              <div className="grid grid-cols-2 gap-6 mb-10">
                <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800 text-center">
                  <div className="text-[9px] text-zinc-600 uppercase font-black mb-1">Financial Yield</div>
                  <div className="text-2xl font-black text-emerald-400 font-digital">+${showResult.earnings}k</div>
                </div>
                
                {/* Twitch Viewership Card */}
                <div className="bg-purple-950/20 p-6 rounded-2xl border border-purple-500/20 text-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-20"><i className="fab fa-twitch text-purple-500 text-4xl"></i></div>
                  <div className="text-[9px] text-purple-400 uppercase font-black mb-1 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> LIVE Viewers
                  </div>
                  <div className="text-2xl font-black text-white font-digital group-hover:scale-110 transition-transform">
                    {showResult.viewership.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-zinc-500 mt-2 font-mono">Stream Rev: <span className="text-emerald-400">+${Math.floor(showResult.viewership/5000)}k</span></div>
                </div>
              </div>

              <button onClick={() => { 
                setShowResult(null); 
                setView('dashboard');
                if (pendingPlayoffAnnouncement) {
                  setAlert({
                    title: "REGULAR SEASON CONCLUDED",
                    desc: "The standings are finalized. The Top 4 squads have secured their spots in the Championship Bracket. Prepare for the Playoffs!"
                  });
                  setPendingPlayoffAnnouncement(false);
                }
              }} className="w-full bg-zinc-100 hover:bg-white text-black py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-xl font-orbitron">Return to Team HQ</button>
           </div>
        </div>
      )}
      
      <style>{`.scale-102 { transform: scale(1.02); } @keyframes pulse-vs { 0%, 100% { opacity: 0.3; transform: scale(0.95); filter: blur(2px); } 50% { opacity: 0.9; transform: scale(1.05); filter: blur(0px); } } .animate-pulse-vs { animation: pulse-vs 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; } @keyframes pulse-slow { 0%, 100% { opacity: 0.05; } 50% { opacity: 0.15; } } .animate-pulse-slow { animation: pulse-slow 5s ease-in-out infinite; } @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } } .animate-marquee { animation: marquee 30s linear infinite; } .animate-marquee:hover { animation-play-state: paused; }`}</style>
    </div>
  );
};