import { GoogleGenAI } from "@google/genai";
import { Player, MatchResult, Team } from "../src/types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getScoutingReport = async (player: Player) => {
  try {
    // Fixed: Updated to use correct Player properties: gamertag instead of name, role instead of ship, and direct stat fields instead of a stats object.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a short scouting report (2 sentences) for a Subspace Trench Wars pilot named ${player.gamertag}. 
      Role: ${player.role}. Stats: Aim ${player.aim}, IQ ${player.iq}, Potential ${player.potential}. 
      Make it sound like tournament Intel.`,
    });
    return response.text || "No intelligence available.";
  } catch (err) {
    return "Standard league scouting report available.";
  }
};

export const getMatchSummary = async (result: MatchResult, home: Team, away: Team) => {
  try {
    // Fixed: Removed homeFlags and awayFlags as they do not exist on the MatchResult type.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a 2-sentence sports recap of a Subspace Trench Wars match.
      Home: ${home.name} (${result.homeScore} points).
      Away: ${away.name} (${result.awayScore} points).
      The winner was ${result.winnerId === home.id ? home.name : away.name}. 
      Mention the intense ship combat and flag capping.`,
    });
    return response.text || "Match complete. Standard results recorded.";
  } catch (err) {
    return "The squads clashed in deep space. Results finalized.";
  }
};