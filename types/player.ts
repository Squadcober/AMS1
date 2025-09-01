/// <reference path="./drill.ts" />

import { Drill } from "./drill"

export interface PlayerAttributes {
  Attack: number;
  pace: number;
  Physicality: number;
  Defense: number;
  passing: number;
  Technique: number;
  tackling: number;
  vision: number;
  stamina: number;
  strength: number;
  agility: number;
  speed: number;
  overall: number;
  matchPoints: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  sessionRating: number;
  trainingPoints: number;
}

export interface Player {
  feesPaid: any;
  age: any;
  id: string;
  _id: string;
  userId: string;
  username: string;
  name: string;
  email: string;
  academyId: string;
  role: string;
  position: string;
  playingStyle: string;
  photoUrl: string;
  attributes: PlayerAttributes;
  performanceHistory: any[];
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export type PerformanceHistoryEntry = {
  date: string;
  sessionId?: string | number;
  sessionName?: string;
  rating?: number;
  attendance?: boolean;
  position?: string;
  attributes?: {
    Attack: number;
    pace: number;
    Physicality: number;
    Defense: number;
    passing: number;
    Technique: number;
    matchPoints?: number;
    trainingPoints?: number;
  };
}

export type Batch = {
  academyId: string
  id: string // Corrected to string
  name: string
  coachId: string
  coachName: string
  players: string[]
}

