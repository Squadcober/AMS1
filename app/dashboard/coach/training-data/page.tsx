"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePlayers } from "@/contexts/PlayerContext"
import { useBatches } from "@/contexts/BatchContext"
import { useAuth } from "@/contexts/AuthContext"
import { useCoaches } from "@/contexts/CoachContext"
import SliderComponent from "@/components/Slider"
import { BackendSetup } from '@/lib/backend-setup'
import { TimePicker } from "@/components/ui/timepicker"
import { Switch } from "@/components/ui/switch"
import Sidebar from "@/components/Sidebar" // Import the Sidebar component
import { format } from "date-fns" // Import format from date-fns
import { Calendar } from "@/components/ui/calendar"

import { toast, useToast } from "@/components/ui/use-toast"; // Import useToast hook
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs" // Add this import
import type { User } from "@/types/user" // Add User interface import
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useRouter } from 'next/navigation'; // Add this import
import { Slider } from "@/components/ui/slider" // Add this import
import { getAll, create, update, remove, getByFilter } from '@/lib/db'
import { StorageUtils } from '@/lib/utils/storage';
import { CoachProvider } from "@/contexts/CoachContext" // Add this import
// import sessions from "@/app/api/sessions" // REMOVE or RENAME this import to avoid conflict

export interface Session {
  id: string | number
  _id?: string;
  name: string
  status: "Finished" | "On-going" | "Upcoming"
  date: string
  startTime: string
  endTime: string
  assignedBatch?: string
  assignedPlayers: string[] // Change this to just array of IDs
  coachId: string | string[]
  playerRatings?: { [playerId: string]: number }
  userId: string
  recurrenceDays?: string[]
  numberOfSessions?: number
  isRecurring?: boolean;
  recurringEndDate?: string;
  selectedDays?: string[];
  totalOccurrences?: number;
  coachNames?: string[];
  assignedPlayersData: { id: string, name: string, position: string, photoUrl?: string }[] // Add this new property with photoUrl
  playerMetrics?: {
    [playerId: string]: {
      Attack: number;
      pace: number;
      Physicality: number;
      Defense: number;
      passing: number;
      Technique: number;
      sessionRating: number;
    }
  };
  attendance: {
    [playerId: string]: {
      status: "Present" | "Absent" | "Unmarked"; // Change this to include "Unmarked"
      markedAt: string
      markedBy: string
    }
  }
  parentSessionId?: number;  // ID of the parent recurring session
  occurrenceDate?: string;   // Specific date for this occurrence
  isOccurrence?: boolean;    // Flag to identify if this is a recurring occurrence
  academyId: string; // Add this property
}

// Add this interface near the top of the file, after the Session interface
export interface Batch {
  id: string
  name: string
  coachId: string
  coachName: string
  players: string[]
  coachIds?: string[]
  coachNames?: string[]
  academyId: string
}

// Move exportToFile inside SessionsContent component




const MAX_SESSIONS = 50;



// Add this helper function after other helper functions
const getNextSessionDate = (session: Session, startDate: string, endDate: string) => {
  const today = new Date();
  const currentDate = new Date(startDate);
  const selectedDays = session.selectedDays || [];
  let pastOccurrences = 0; // Initialize pastOccurrences
  let futureOccurrences = 0; // Initialize futureOccurrences

  while (currentDate <= new Date(endDate)) {
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (selectedDays.includes(dayName)) {
      if (currentDate > today) {
        // Return the correct next date (do not increment further)
        return currentDate.toISOString().split('T')[0];
      }
      if (currentDate < today) {
        pastOccurrences++;
      } else if (currentDate > today) {
        futureOccurrences++;
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (futureOccurrences > 0) {
    return currentDate.toISOString().split('T')[0];
  }

  return null;
};

// Update the generateRecurringOccurrences function
const generateRecurringOccurrences = (session: Session): Session[] => {
  console.log('Starting generateRecurringOccurrences with session:', {
    name: session.name,
    date: session.date,
    recurringEndDate: session.recurringEndDate,
    selectedDays: session.selectedDays
  });

  if (!session.isRecurring || !session.selectedDays) return [session];

  const startDate = new Date(session.date);
  const endDate = new Date(session.recurringEndDate || "");
  const selectedDays = session.selectedDays;
  const occurrences: Session[] = [];
  
  // Get current date at the start of the day (midnight)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  console.log('Time references:', {
    now: now.toISOString(),
    today: today.toISOString(),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  // Create a copy of start date to iterate through
  const currentDate = new Date(startDate);
  
  // Ensure we're working with the correct day starting at midnight
  currentDate.setHours(0, 0, 0, 0);
  
  let occurrenceCounter = 0;
  while (currentDate <= endDate) {
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    if (selectedDays.includes(dayName)) {
      // Create occurrence date string in YYYY-MM-DD format
      const occurrenceDate = currentDate.toISOString().split('T')[0];

      // Create session start and end times for this occurrence
      const sessionDateTime = new Date(occurrenceDate);
      const [startHour, startMinute] = session.startTime.split(':').map(Number);
      const [endHour, endMinute] = session.endTime.split(':').map(Number);

      const sessionStart = new Date(sessionDateTime);
      sessionStart.setHours(startHour, startMinute, 0);

      const sessionEnd = new Date(sessionDateTime);
      sessionEnd.setHours(endHour, endMinute, 0);

      // Determine status based on the current time
      let status: Session['status'];
      if (currentDate < today) {
      status = 'Finished';
      } else if (currentDate.getTime() === today.getTime()) {
      if (now >= sessionEnd) {
        status = 'Finished';
      } else if (now >= sessionStart && now <= sessionEnd) {
        status = 'On-going';
      } else {
        status = 'Upcoming';
      }
      } else {
      status = 'Upcoming';
      }

      // Create numeric occurrence ID using parent session id and occurrence counter as decimal
      const parentIdNum = typeof session.id === "number" ? session.id : Number(session.id);
      const occurrenceNumber = occurrenceCounter + 1; // start counting occurrences at 1
      const occurrenceId = Number(`${Math.trunc(parentIdNum)}.${occurrenceNumber}`);

      occurrences.push({
        ...session,
        id: occurrenceId,
        parentSessionId: parentIdNum,
        date: occurrenceDate,
        isOccurrence: true,
        status,
        attendance: {},
        playerMetrics: {},
        playerRatings: {}
      });
      occurrenceCounter++;
        }
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return occurrences;
};

// Add this function to clean up duplicates when saving sessions
const cleanupDuplicateSessions = (sessions: Session[]): Session[] => {
  console.log('Starting cleanup with sessions:', {
    total: sessions.length,
    recurring: sessions.filter(s => s.isRecurring).length,
    occurrences: sessions.filter(s => s.isOccurrence).length
  });

  // First, separate sessions into different categories
  const regularSessions = new Map<string, Session>();
  const parentSessions = new Map<number, Session>();
  const occurrences = new Map<string, Session>();

  sessions.forEach(session => {
    if (session.isOccurrence && session.parentSessionId) {
      // Handle occurrences
      const key = `${session.parentSessionId}-${session.date}`;
      if (occurrences.has(key)) {
        const existing = occurrences.get(key)!;
        // Keep the most "final" status
        if (session.status === 'Finished' || (session.status === 'On-going' && existing.status === 'Upcoming')) {
          occurrences.set(key, session);
        }
      } else {
        occurrences.set(key, session);
      }
    } else if (session.isRecurring && !session.isOccurrence) {
      // Handle parent recurring sessions
      parentSessions.set(Number(session.id), session);
    } else {
      // Handle regular sessions
      const key = `${session.id}-${session.date}`;
      regularSessions.set(key, session);
    }
  });

  // Combine all sessions
  const cleanedSessions = [
    ...Array.from(regularSessions.values()),
    ...Array.from(parentSessions.values()),
    ...Array.from(occurrences.values())
  ];

  console.log('Cleanup result:', {
    originalCount: sessions.length,
    cleanedCount: cleanedSessions.length,
    byStatus: {
      Finished: cleanedSessions.filter(s => s.status === 'Finished').length,
      'On-going': cleanedSessions.filter(s => s.status === 'On-going').length,
      Upcoming: cleanedSessions.filter(s => s.status === 'Upcoming').length
    }
  });

  return cleanedSessions;
};

const validateRecurringDates = (startDate: string, endDate: string, selectedDays: string[]) => {
  if (!startDate || !endDate || !selectedDays.length) return false;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if the dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  
  // Check if end date is after start date
  if (end < start) return false;

  // Check if at least one selected day occurs between start and end dates
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (selectedDays.includes(dayName)) {
      return true; // Found at least one valid occurrence
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return false; // No valid occurrences found
};

const updateSessionStatus = (sessions: Session[]): Session[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return sessions.map(session => {
    if (session.isOccurrence) {
      const occurrenceDateTime = new Date(session.occurrenceDate || session.date);
      const [startHour, startMinute] = session.startTime.split(':').map(Number);
      const [endHour, endMinute] = session.endTime.split(':').map(Number);

      const sessionStart = new Date(occurrenceDateTime);
      sessionStart.setHours(startHour, startMinute, 0);

      const sessionEnd = new Date(occurrenceDateTime);
      sessionEnd.setHours(endHour, endMinute, 0);

      let status: Session['status'];
      if (occurrenceDateTime < today) {
        status = 'Finished';
      } else if (occurrenceDateTime.getTime() === today.getTime()) {
        if (now >= sessionEnd) {
          status = 'Finished';
        } else if (now >= sessionStart && now <= sessionEnd) {
          status = 'On-going';
        } else {
          status = 'Upcoming';
        }
      } else {
        status = 'Upcoming';
      }

      return { ...session, status };
    }
    return session;
  });
};

// Update getDateLimits to use 60 days for both past and future
const getDateLimits = () => {
  const today = new Date();
  
  // Set past limit to 60 days ago (changed from 14)
  const past60Days = new Date(today);
  past60Days.setDate(today.getDate() - 60);
  
  const future60Days = new Date(today);
  future60Days.setDate(today.getDate() + 60);
  
  return {
    minDate: past60Days.toISOString().split('T')[0],
    maxDate: future60Days.toISOString().split('T')[0],
    today: today.toISOString().split('T')[0]
  };
};

// Add this helper to filter and organize sessions
const organizeRecurringSessions = (sessions: Session[]) => {
  // Group sessions by parent ID
  const groupedSessions = sessions.reduce((acc, session) => {
    if (session.isOccurrence && session.parentSessionId) {
      // Add to occurrences group
      if (!acc.occurrences[session.parentSessionId]) {
        acc.occurrences[session.parentSessionId] = [];
      }
      acc.occurrences[session.parentSessionId].push(session);
    } else if (session.isRecurring && !session.isOccurrence) {
      // Add to parents group
      acc.parents[session.id] = session;
    } else {
      // Add to regular sessions
      acc.regular.push(session);
    }
    return acc;
  }, { parents: {}, occurrences: {}, regular: [] } as any);

  // Create virtual parent sessions if missing
  Object.keys(groupedSessions.occurrences).forEach(parentId => {
    if (!groupedSessions.parents[parentId]) {
      const occurrences = groupedSessions.occurrences[parentId];
      if (occurrences.length > 0) {
        // Create parent from first occurrence
        const firstOccurrence = occurrences[0];
        groupedSessions.parents[parentId] = {
          ...firstOccurrence,
          id: parseInt(parentId),
          isRecurring: true,
          isOccurrence: false,
          parentSessionId: undefined,
          occurrenceDate: undefined,
          totalOccurrences: occurrences.length
        };
      }
    }
  });

  // Combine all sessions
  return [
    ...Object.values(groupedSessions.parents),
    ...groupedSessions.regular
  ];
};

const DEFAULT_AVATAR = "/default-avatar.png"; // Update path to match new location

// Add this type near the top with other interfaces
interface MetricsCache {
  [key: string]: {
    data: any;
    timestamp: number;
    isDirty: boolean;
  }
}

// Add this outside the component
const metricsCache: MetricsCache = {};

const POLLING_INTERVAL = 300000; // 30 seconds

// Define LOCAL_STORAGE_KEY for session storage
const LOCAL_STORAGE_KEY = 'ams-sessions';

export default function SessionsPage() {
  return (
    <CoachProvider>
      <SessionsContent />
    </CoachProvider>
  )
}

function SessionsContent() {
  const { user } = useAuth();  // Keep this at the top
  const { toast } = useToast();
  
  // Move isPolling state declaration to the top with other states
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [viewDetailsSessionData, setViewDetailsSessionData] = useState<Session | null>(null);// Add this new state for the toggle
  const [showMySessions, setShowMySessions] = useState(false);

  // Define fetchSessions function
  const fetchSessions = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!user?.academyId) {
        return;
      }
      try {
        const response = await fetch(`/api/db/ams-sessions?academyId=${encodeURIComponent(user.academyId)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch sessions');
        }
        const result = await response.json();
        if (!Array.isArray(result.data)) {
          console.warn('Invalid response format:', result);
          return;
        }
        const updatedSessions = updateSessionStatus(result.data);
        setSessions(updatedSessions);
        setLastUpdate(Date.now());
      } catch (error) {
        console.error('Error loading sessions:', error);
        return;
      }
    },
    [user?.academyId]
  );
  
  // Define handleShowMySessionsToggle to filter sessions by coachId matching user.id
  const handleShowMySessionsToggle = (show: boolean) => {
    // If show is true, filter sessions to only those where user.id is in coachId array
    if (show && user?.id) {
      setSessions(prev =>
        prev.filter(session => {
          const coachIds = Array.isArray(session.coachId) ? session.coachId : [session.coachId];
          return coachIds.includes(user.id);
        })
      );
    } else {
      // If show is false, reload all sessions from backend
      fetchSessions(true);
    }
    // Update the state
    setShowMySessionsState(true);
  };
  // Alias for the state setter to avoid conflict
  const [showMySessionsState, setShowMySessionsState] = useState(false);

  // Add this state near other state declarations, before OccurrencesDialog is used
  const [isOccurrencesDialogOpen, setIsOccurrencesDialogOpen] = useState(false);

  // Move mapSessionPlayers definition here, before the useEffect
  // (Removed duplicate declaration to avoid redeclaration error)

  // Get players from context
  const { players } = usePlayers();

  // Define mapSessionPlayers before any useEffect that uses it
  const mapSessionPlayers = useCallback((session: any) => ({
    ...session,
    assignedPlayers: session.assignedPlayers.map((playerId: string) => {
      const player = players.find(p => p.id === playerId)
      return playerId // Just return the ID since we've updated the type
    })
  }), [players]);

  const [isSaving, setIsSaving] = useState(false);

  // Replace the sessions loading useEffect
  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.academyId) {
        console.log('Waiting for academyId...');
        return;
      }
      try {
        const response = await fetch(`/api/db/ams-sessions?academyId=${encodeURIComponent(user?.academyId || '')}`);
        if (!response.ok) {
          throw new Error('Failed to fetch sessions');
        }
        const result = await response.json();
        if (!Array.isArray(result.data)) {
          console.warn('Invalid response format:', result);
          // Do NOT clear sessions on error, just return
          return;
        }
        const updatedSessions = updateSessionStatus(result.data);
        setSessions(updatedSessions);
        setLastUpdate(Date.now());
      } catch (error) {
        console.error('Error loading sessions:', error);
        // Do NOT clear sessions on error, just return
        return;
      }
    };

    if (user?.academyId) {
      loadSessions();

      const pollInterval = setInterval(() => {
        if (isPolling) {
          loadSessions();
        }
      }, POLLING_INTERVAL);

      return () => {
        clearInterval(pollInterval);
        setIsPolling(false);
      };
    }
  }, [mapSessionPlayers, isPolling, user?.academyId]);

  // Polling effect - now isPolling is declared before use
  useEffect(() => {
    if (!user?.academyId || !isPolling) return;

    console.log('Starting polling for sessions...');
    const poll = async () => {
      try {
        await fetchSessions(true);
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Initial poll
    poll();

    const interval = setInterval(() => {
      console.log('Polling for sessions...');
      poll();
    }, POLLING_INTERVAL);

    return () => {
      console.log('Stopping polling...');
      clearInterval(interval);
    };
  }, [user?.academyId, isPolling, fetchSessions]);

  // Visibility change effect
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.academyId) {
        console.log('Tab became visible. Forcing session refresh...');
        fetchSessions(true); // Force refresh when tab becomes visible
      }
      setIsPolling(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.academyId, fetchSessions]);

  useEffect(() => {
    BackendSetup.initialize()
  }, [])

  // const { players } = usePlayers()
  const { batches, setBatches } = useBatches()
  const { coaches, setCoaches } = useCoaches() // Fetch coaches from context
  const [newSession, setNewSession] = useState<Omit<Session, "id" | "status" | "playerRatings" | "attendance">>({
    name: "",
    date: new Date().toISOString().split('T')[0], // Set default date to today
    startTime: "11:00",
    endTime: "12:00",
    assignedBatch: "",
    assignedPlayers: [] as string[], // Change to string array
    coachId: [],
    userId: user?.id || "",
    coachNames: [],
    assignedPlayersData: [],
    academyId: user?.academyId || "", // Add academyId
  })
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none")
  const [recurrenceLimit, setRecurrenceLimit] = useState<number>(10)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedSessions, setSelectedSessions] = useState<number[]>([])
  const [activeLog, setActiveLog] = useState<"All" | "Finished" | "On-going" | "Upcoming">("All")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showCheckboxes, setShowCheckboxes] = useState(false)
  const [unsavedSessions, setUnsavedSessions] = useState<Session[]>([])
  const [isRecurring, setIsRecurring] = useState(false)
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [dateRange, setDateRange] = useState({ from: "", to: "" })
  const [users, setUsers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [viewDetailsSessionId, setViewDetailsSessionId] = useState<number | null>(null)
  const [visibleSessionsCount, setVisibleSessionsCount] = useState(10)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date()) // State for selected date
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [trimDates, setTrimDates] = useState(false);
  const router = useRouter();
  const [playerMetrics, setPlayerMetrics] = useState<{
    [playerId: string]: {
      Attack: string;
      pace: string;
      Physicality: string;
      Defense: string;
      passing: string;
      Technique: string;
      sessionRating: string;
    }
  }>({});
  const [selectedPlayerForMetrics, setSelectedPlayerForMetrics] = useState<{
    id: string;
    name: string;
    sessionId: number;
  } | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState(""); // Add this new state
  const [dateLimits] = useState(getDateLimits());
  const [detailsPlayerSearchQuery, setDetailsPlayerSearchQuery] = useState("");

  // Move mapSessionPlayers outside useEffect and memoize it
  // (Removed duplicate declaration to avoid redeclaration error)

  // Update the chunked data loading effect
  useEffect(() => {
    const loadSessions = () => {
      try {
        const chunkCount = parseInt(localStorage.getItem(`${LOCAL_STORAGE_KEY}_count`) || "0");
        let allSessions: Session[] = [];
        for (let i = 0; i < chunkCount; i++) {
          const chunk = StorageUtils.getItem(`${LOCAL_STORAGE_KEY}_${i}`);
          if (Array.isArray(chunk)) {
            allSessions = [...allSessions, ...chunk];
          }
        }
        return allSessions;
      } catch (error) {
        console.error('Error loading sessions:', error);
        // Do NOT clear sessions on error, just return previous state
        return [];
      }
    };

    const savedSessions = loadSessions();
    const updatedSessions = updateSessionStatus(Array.isArray(savedSessions) ? savedSessions.map(mapSessionPlayers) : []);
    // Only update if we have valid data
    if (Array.isArray(savedSessions) && savedSessions.length > 0) {
      setSessions(updatedSessions);
    }
  }, [mapSessionPlayers]);

  useEffect(() => {
    const mapSessionPlayers = (session: any) => ({
      ...session,
      assignedPlayers: session.assignedPlayers.map((playerId: string) => {
        const player = players.find(p => p.id === playerId)
        return playerId // Just return the ID since we've updated the type
      })
    })

    // Use StorageUtils instead of localStorage directly
    const savedSessions = StorageUtils.getItem(LOCAL_STORAGE_KEY) || [];
    const sessionsArray = Array.isArray(savedSessions) ? savedSessions : [];
    const updatedSessions = updateSessionStatus(sessionsArray.map(mapSessionPlayers));
    // Only update if we have valid data
    if (sessionsArray.length > 0) {
      setSessions(updatedSessions);
    }

    const interval = setInterval(async () => {
      const updatedSessions = await updateSessionStatus(sessionsArray.map(mapSessionPlayers));
      // Only update if we have valid data
      if (sessionsArray.length > 0) {
        setSessions(updatedSessions.map(mapSessionPlayers));
      }
    }, 60000);
    const updateSessions = async () => {
      try {
        const updatedSessions = await updateSessionStatus(sessionsArray.map(mapSessionPlayers));
        // Only update if we have valid data
        if (sessionsArray.length > 0) {
          setSessions(updatedSessions.map(mapSessionPlayers));
        }
      } catch (error) {
        console.error('Error updating sessions:', error);
        // Do NOT clear sessions on error
      }
    };

    updateSessions(); // Initial update
    return () => clearInterval(interval);
  }, [players]);

  // Update the users loading effect
  useEffect(() => {
    // Load users from localStorage and filter by academy ID and role
    const storedUsers = JSON.parse(localStorage.getItem("users") || "[]");
    const filteredCoaches = storedUsers.filter((u: any) => 
      u.role === "coach" && u.academyId === user?.academyId
    );
    setUsers(filteredCoaches);
  }, [user?.academyId]);

  // Fix calculateTrimmedDates to properly trim to first and last valid occurrence
  const calculateTrimmedDates = (startDate: string, endDate: string, selectedDays: string[]) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let firstOccurrence: Date | null = null;
    let lastOccurrence: Date | null = null;
    
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (selectedDays.includes(dayName)) {
        if (!firstOccurrence) {
          firstOccurrence = new Date(currentDate);
        }
        lastOccurrence = new Date(currentDate);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  
    // Only return trimmed dates if both are found
    if (firstOccurrence && lastOccurrence) {
      return {
        start: firstOccurrence.toISOString().split('T')[0],
        end: lastOccurrence.toISOString().split('T')[0]
      };
    }
    // If no valid days found, return original dates
    return { start: startDate, end: endDate };
  };







// Update handleConfirmDelete to delete from the database using the correct DELETE API








// Add this state for occurrences
const [occurrences, setOccurrences] = useState<Session[]>([]);

// Update handleViewOccurrences function
const handleViewOccurrences = async (parentId: number) => {
  try {
    if (!user?.academyId) {
      toast({
        title: "Error",
        description: "No academy ID found",
        variant: "destructive",
      });
      return;
    }

    console.log('Fetching parent session:', parentId);

    // Fetch parent session
    const parentResponse = await fetch(`/api/db/ams-sessions/${parentId}`);
    if (!parentResponse.ok) throw new Error('Failed to fetch parent session');
    const parentResult = await parentResponse.json();

    if (!parentResult.success || !parentResult.data) {
      throw new Error('Invalid parent session response');
    }

    // Fetch occurrences
    const occurrencesResponse = await fetch(
      `/api/db/ams-sessions/occurrences?parentId=${parentId}&academyId=${user.academyId}`,
      {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      }
    );

    if (!occurrencesResponse.ok) throw new Error('Failed to fetch occurrences');
    const occurrencesResult = await occurrencesResponse.json();

    // Ensure the data is an array
    const occurrences = Array.isArray(occurrencesResult.data) ? occurrencesResult.data : [];

    // Calculate the status of each occurrence based on date and time
    const now = new Date();
    const updatedOccurrences = occurrences.map((occurrence: Session) => {
      const occurrenceDate = new Date(occurrence.date);
      const [startHour, startMinute] = occurrence.startTime.split(':').map(Number);
      const [endHour, endMinute] = occurrence.endTime.split(':').map(Number);

      const sessionStart = new Date(occurrenceDate);
      sessionStart.setHours(startHour, startMinute, 0);

      const sessionEnd = new Date(occurrenceDate);
      sessionEnd.setHours(endHour, endMinute, 0);

      let status: Session['status'];
      if (now < sessionStart) {
        status = "Upcoming";
      } else if (now >= sessionStart && now <= sessionEnd) {
        status = "On-going";
      } else {
        status = "Finished";
      }

      return { ...occurrence, status };
    });

    // Group occurrences by status
    const groupedOccurrences = updatedOccurrences.reduce((acc: { [key: string]: Session[] }, occurrence: Session) => {
      const status = occurrence.status || "Unknown";
      if (!acc[status]) acc[status] = [];
      acc[status].push(occurrence);
      return acc;
    }, {});

    setViewOccurrencesData({
      parentSession: parentResult.data,
      occurrences: updatedOccurrences,
      groupedOccurrences
    });

    setIsOccurrencesDialogOpen(true); // Explicitly open dialog

    console.log('Updated occurrences with status:', updatedOccurrences);
  } catch (error) {
    console.error('Error viewing occurrences:', error);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Failed to load occurrences",
      variant: "destructive",
    });
  }
};

const handleViewDetails = async (sessionId: number | string) => {
  try {
    if (!user?.academyId) {
      toast({
        title: "Error",
        description: "No academy ID found",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    console.log('Fetching details for session:', sessionId);

    // Fetch session details (including attendance)
    const response = await fetch(`/api/db/ams-sessions/${sessionId}?academyId=${user.academyId}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    if (!response.ok) throw new Error('Failed to fetch session details');

    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch session details');
    }

    const session = result.data;

    // Log attendance for this session
    console.log(
      `[ATTENDANCE] Session ID: ${session.id} | Recurring: ${!!session.isRecurring} | Occurrence: ${!!session.isOccurrence}`,
      session.attendance
    );

    // If recurring occurrence, also fetch parent session attendance
    if (session.isOccurrence && session.parentSessionId) {
      const parentResponse = await fetch(`/api/db/ams-sessions/${session.parentSessionId}?academyId=${user.academyId}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (parentResponse.ok) {
        const parentResult = await parentResponse.json();
        if (parentResult.success && parentResult.data) {
          console.log(
            `[ATTENDANCE] Parent Session ID: ${parentResult.data.id} | Recurring: ${!!parentResult.data.isRecurring}`,
            parentResult.data.attendance
          );
        }
      }
    }

    // ...existing code for fetching player details and updating state...
    if (session.assignedPlayers?.length > 0) {
      const playerIds = Array.isArray(session.assignedPlayers) ? session.assignedPlayers : [session.assignedPlayers];
      const playersResponse = await fetch(`/api/db/ams-player-data/batch?ids=${playerIds.join(',')}`);
      if (playersResponse.ok) {
        const playersResult = await playersResponse.json();
        if (playersResult.success && Array.isArray(playersResult.data)) {
          session.assignedPlayersData = playersResult.data.map((player: any) => ({
            id: player.id || player.id,
            name: player.name || player.username || 'Unknown Player',
            position: player.position || 'Not specified',
            photoUrl: player.photoUrl || DEFAULT_AVATAR,
          }));
        } else {
          session.assignedPlayersData = [];
        }
      } else {
        session.assignedPlayersData = playerIds.map((id: string) => ({
          id,
          name: 'Unknown Player',
          position: 'Not specified',
          photoUrl: DEFAULT_AVATAR,
        }));
      }
    } else {
      session.assignedPlayersData = [];
    }

    setSessions(prev => prev.map(s => 
      (s.id != null && s.id.toString() === sessionId.toString()) ? session : s
    ));
    setViewDetailsSessionId(Number(sessionId));
    setViewDetailsSessionData(session);

    // ...existing code...
  } catch (error) {
    console.error('Error viewing session details:', error);
    toast({
      title: "Error",
      description: "Failed to load session details",
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
};

const handleViewMore = () => {
  setVisibleSessionsCount(prevCount => prevCount + 30)
}

const sortedSessions = useCallback((sessions: Session[]) => {
  const now = new Date()
  
  return [...sessions].sort((a, b) => {
    // First sort by status priority (Upcoming > On-going > Finished)
    const statusPriority = {
      "Upcoming": 1,
      "On-going": 0,
      "Finished": 2
    }
    
    const statusDiff = statusPriority[a.status] - statusPriority[b.status]
    if (statusDiff !== 0) return statusDiff

    // Then sort within each status
    const dateA = new Date(a.date)
    const dateB = new Date(b.date)

    switch (a.status) {
      case "On-going":
        // Current sessions - most recent first
        return dateB.getTime() - dateA.getTime()
      case "Upcoming":
        // Future sessions - most recent first
        return dateB.getTime() - dateA.getTime()
      case "Finished":
        // Past sessions - most recent first
        return dateB.getTime() - dateA.getTime()
      default:
        return 0
    }
  })
}, [])

// Add this new helper function after getNextSessionDate
const getLastFinishedDate = (session: Session) => {
  if (!session.isRecurring) return null;
  
  const now = new Date();
  const finishedOccurrences = sessions
    .filter(s => {
      // Check if it's an occurrence of this recurring session
      if (s.parentSessionId !== session.id || !s.isOccurrence) return false;
      
      // Create date objects for comparison
      const occurrenceDate = new Date(s.date);
      const [endHour, endMinute] = s.endTime.split(':').map(Number);
      const sessionEnd = new Date(occurrenceDate);
      sessionEnd.setHours(endHour, endMinute, 0);
      
      // Check if the session has ended (compare with current date and time)
      return sessionEnd < now;
    })
    .sort((a, b) => {
      // Sort by date and time in descending order
      const dateA = new Date(`${a.date}T${a.endTime}`);
      const dateB = new Date(`${b.date}T${b.endTime}`);
      return dateB.getTime() - dateA.getTime();
    });

  if (finishedOccurrences.length === 0) return 'No finished sessions';
  
  // Format the most recent finished date with correct timezone adjustment
  const lastDate = new Date(finishedOccurrences[0].date);
  lastDate.setDate(lastDate.getDate() + 1); // Adjust for timezone offset
  return format(lastDate, "dd-MM-yyyy (EEE)");
};

// Add this helper function after getLastFinishedDate and before renderSessionTable
const getCompletedSessionsCount = (session: Session) => {
  if (!session.isRecurring) return "1 completed";

  const now = new Date();
  const finishedOccurrences = sessions.filter(s => 
    s.parentSessionId === session.id &&
    s.isOccurrence &&
    new Date(`${s.date}T${s.endTime}`) < now
  );

  return `${finishedOccurrences.length} completed`;
};

// Modify the renderSessionTable function to show different columns based on status
const renderSessionTable = (status: Session["status"] | "All") => {
  const now = new Date();
  
  // Ensure sessions is always an array
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  
  // Get all sessions for current academy that aren't occurrences
  let academySessions = safeSessions.filter(session => 
    session.academyId === user?.academyId && !session.isOccurrence
  );
  // Then filter by coach if showing only my sessions
  if (showMySessions && user?.id) {
    academySessions = academySessions.filter(session => {
      const coachIds = Array.isArray(session.coachId) ? session.coachId : [session.coachId];
      return coachIds.includes(user.id);
    });
  }
  // Filter based on status
  const filteredSessions = academySessions.filter((session) => {
    if (status === "All") return true;

    const now = new Date();
    
    if (session.isRecurring) {
      // Get all occurrences for this recurring session
      const occurrences = sessions.filter(s => s.parentSessionId === session.id);
      
      switch (status) {
        case "Upcoming":
          // Show if ANY occurrence is in the future
          return occurrences.some(occ => {
            const occurrenceDate = new Date(occ.date);
            const [startHour, startMinute] = occ.startTime.split(':').map(Number);
            const sessionStart = new Date(occurrenceDate);
            sessionStart.setHours(startHour, startMinute, 0);
            return sessionStart > now;
          });
        
        case "On-going":
          // Show if ANY occurrence is currently happening
          return occurrences.some(occ => {
            const occurrenceDate = new Date(occ.date);
            const [startHour, startMinute] = occ.startTime.split(':').map(Number);
            const [endHour, endMinute] = occ.endTime.split(':').map(Number);
            const sessionStart = new Date(occurrenceDate);
            const sessionEnd = new Date(occurrenceDate);
            sessionStart.setHours(startHour, startMinute, 0);
            sessionEnd.setHours(endHour, endMinute, 0);
            return now >= sessionStart && now <= sessionEnd;
          });
        
        case "Finished":
          // Show if ANY occurrence is finished
          return occurrences.some(occ => {
            const occurrenceDate = new Date(occ.date);
            const [endHour, endMinute] = occ.endTime.split(':').map(Number);
            const sessionEnd = new Date(occurrenceDate);
            sessionEnd.setHours(endHour, endMinute, 0);
            return sessionEnd < now;
          });
        
        default:
          return false;
      }
    } else {
      // For non-recurring sessions, use the existing logic
      const sessionDate = new Date(session.date);
      const [startHour, startMinute] = session.startTime.split(':').map(Number);
      const [endHour, endMinute] = session.endTime.split(':').map(Number);
      
      const sessionStart = new Date(sessionDate);
      const sessionEnd = new Date(sessionDate);
      sessionStart.setHours(startHour, startMinute, 0);
      sessionEnd.setHours(endHour, endMinute, 0);
      
      switch (status) {
        case "Upcoming":
          return sessionStart > now;
        case "On-going":
          return now >= sessionStart && now <= sessionEnd;
        case "Finished":
          return sessionEnd < now;
        default:
          return false;
      }
    }
  });

  // Apply search filter
  const searchedSessions = filteredSessions.filter((session) => {
    if (!session || typeof session !== 'object') return false;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Check session name
    const nameMatch = session.name && 
      typeof session.name === 'string' && 
      session.name.toLowerCase().includes(searchLower);
    
    // Check players
    const playerMatch = Array.isArray(session.assignedPlayers) && 
      session.assignedPlayers.some(playerId => {
        if (!playerId) return false;
        const player = players.find(p => 
          p.id === playerId && 
          p.academyId === user?.academyId // Add academy filter
        );
        return player?.name.toLowerCase().includes(searchLower);
      });
    
    // Check coach
    const coachIds = Array.isArray(session.coachId) 
      ? session.coachId 
      : [session.coachId];
    
    const coachMatch = coachIds.some(id => {
      if (!id) return false;
      const coach = users.find(user => user?.id === id);
      return coach?.name?.toLowerCase().includes(searchLower);
    });

    return nameMatch || playerMatch || coachMatch;
  });

  const visibleSessions = sortedSessions(searchedSessions).slice(0, visibleSessionsCount);
  const hasMore = searchedSessions.length > visibleSessionsCount;

  // Rest of the rendering code...
  return (
    <Card className="mt-2">
      <CardHeader className="flex justify-between items-center">
        <CardTitle>{status} Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full max-h-[calc(100vh-200px)] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {showCheckboxes && <TableHead className="w-[50px]">Select</TableHead>}
                <TableHead>Session Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>
                  {status === "Finished" ? "Last Finished Date" : "Next Date"}
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Duration</TableHead> {/* Add this line */}
                <TableHead>Batch/Players</TableHead>
                <TableHead>Day(s)</TableHead>
                <TableHead>Coach</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSessions.map((session) => (
                <TableRow 
                  // Use a compound key that includes all unique identifiers
                  key={`${session.id}-${session.date}-${session.isOccurrence ? 'occ' : 'reg'}`}
                >
                  
                  <TableCell>{session.name}</TableCell>
                  <TableCell>
                    {session.isRecurring 
                      ? `${session.date} to ${session.recurringEndDate}`
                      : session.date
                    }
                  </TableCell>
                  <TableCell>
                    {session.isRecurring && (
                      <span className="text-cyan-400">
                        {status === "Finished"
                          ? getLastFinishedDate(session) || 'No finished sessions'
                          : getNextSessionDate(session, session.date, session.recurringEndDate || session.date) || 'No upcoming dates'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{`${session.startTime} - ${session.endTime}`}</TableCell>
                  <TableCell>{calculateDuration(session.startTime, session.endTime)}</TableCell>
                  <TableCell>
                    {session.assignedBatch
                      ? batches.find((b) => b.id === session.assignedBatch)?.name
                      : `${session.assignedPlayers?.length || 0} players`}
                  </TableCell>
                  <TableCell>
                    {session.isRecurring
                      ? status === "Finished"
                        ? getCompletedSessionsCount(session)
                        : `${session.totalOccurrences} total`
                      : status === "Finished"
                        ? "1 completed"
                        : "1 session"}
                  </TableCell>
                  <TableCell>
                    {session.coachNames && session.coachNames.length > 0
                      ? session.coachNames.join(", ")
                      : "Not assigned"}
                  </TableCell>
                  <TableCell>
                    <Button variant="default" onClick={() => {
                      if (session.isRecurring) {
                        if (status === "Finished") {
                          handleViewFinishedOccurrences(Number(session.id), user);  // Pass user here
                        } else if (status === "Upcoming") {
                          handleViewUpcomingOccurrences(Number(session.id));
                        } else {
                          handleViewOccurrences(Number(session.id));
                        }
                      } else {
                        handleViewDetails(session.id);
                      }
                    }}>
                      {session.isRecurring 
                        ? status === "Finished"
                          ? "View Finished Sessions"
                          : status === "Upcoming"
                            ? "View Upcoming Occurrences"
                            : "View Occurrences"
                        : "View Details"
                      }
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => setVisibleSessionsCount(prev => prev + 10)}
              className="text-white hover:text-gray-300"
            >
              View More ({searchedSessions.length - visibleSessionsCount} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Add this new function to split recurring sessions
const splitRecurringSession = (session: Session) => {
  if (!session.isRecurring) return [session];

  const today = new Date();
  const startDate = new Date(session.date);
  const endDate = new Date(session.recurringEndDate || "");
  const selectedDays = session.selectedDays || [];
  
  // Find today's occurrence if any
  const todayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const isSessionToday = selectedDays.includes(todayName);
  const sessionStartTime = new Date(`${today.toISOString().split('T')[0]}T${session.startTime}`);
  const sessionEndTime = new Date(`${today.toISOString().split('T')[0]}T${session.endTime}`);
  const now = new Date();
  const isOngoing = isSessionToday && now >= sessionStartTime && now <= sessionEndTime;
  
  let pastOccurrences = 0;
  let futureOccurrences = 0;
  
  // Count occurrences before and after today
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    if (currentDate.toDateString() !== today.toDateString()) { // Skip today for past/future counts
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (selectedDays.includes(dayName)) {
        if (currentDate < today) {
          pastOccurrences++;
        } else {
          futureOccurrences++;
        }
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const sessions: Session[] = [];

  // Add past sessions if any
  if (pastOccurrences > 0) {
    sessions.push({
      ...session,
      status: "Finished" as const,
      totalOccurrences: pastOccurrences,
      recurringEndDate: today.toISOString().split('T')[0]
    });
  }

  // Add today's ongoing session if applicable
  if (isOngoing) {
    sessions.push({
      ...session,
      status: "On-going" as const,
      date: today.toISOString().split('T')[0],
      recurringEndDate: today.toISOString().split('T')[0],
      totalOccurrences: 1
    });
  }

  // Add future sessions if any
  if (futureOccurrences > 0) {
    sessions.push({
      ...session,
      status: "Upcoming" as const,
      date: today.toISOString().split('T')[0],
      totalOccurrences: futureOccurrences
    });
  }

  return sessions;
};

// Update the handleViewFinishedOccurrences function
const handleViewFinishedOccurrences = async (
  parentId: number, 
  user: { academyId?: string } | null
) => {
  try {
    if (!user?.academyId) {
      toast({
        title: "Error",
        description: "No academy ID found",
        variant: "destructive",
      });
      return;
    }

    console.log('Fetching parent session:', parentId);

    // Fetch parent session
    const parentResponse = await fetch(`/api/db/ams-sessions/${parentId}`);
    if (!parentResponse.ok) throw new Error('Failed to fetch parent session');
    const parentResult = await parentResponse.json();

    if (!parentResult.success || !parentResult.data) {
      throw new Error('Invalid parent session response');
    }

    // Fetch all occurrences
    const occurrencesResponse = await fetch(
      `/api/db/ams-sessions/occurrences?parentId=${parentId}&academyId=${user.academyId}`
    );
    if (!occurrencesResponse.ok) throw new Error('Failed to fetch occurrences');
    const occurrencesResult = await occurrencesResponse.json();

    // Ensure the data is an array
    const allOccurrences = Array.isArray(occurrencesResult.data) ? occurrencesResult.data : [];

    // Calculate status for each occurrence based on date and time
    const now = new Date();
    const finishedOccurrences = allOccurrences
      .map((occurrence: Session) => {
        // Adjust the date to handle timezone offset
        let occurrenceDate = new Date(occurrence.date);
        // Add one day to adjust for timezone offset (if needed)
        occurrenceDate.setDate(occurrenceDate.getDate() + 1);
        
        const [endHour, endMinute] = occurrence.endTime.split(':').map(Number);
        const sessionEnd = new Date(occurrenceDate);
        sessionEnd.setHours(endHour, endMinute, 0);

        // Session is finished if end time has passed
        if (now > sessionEnd) {
          return {
            ...occurrence,
            date: occurrenceDate.toISOString().split('T')[0], // Use adjusted date
            status: "Finished" as const
          };
        }
        return null;
      })
      .filter(Boolean) // Remove null values
      .sort((a: Session, b: Session) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending

    setViewOccurrencesData({
      parentSession: parentResult.data,
      occurrences: finishedOccurrences,
      showOnlyFinished: true,
      totalOccurrences: allOccurrences.length,
      finishedCount: finishedOccurrences.length
    });

    // Ensure the dialog box opens
    setIsOccurrencesDialogOpen(true);

    console.log('Finished occurrences:', {
      total: allOccurrences.length,
      finished: finishedOccurrences.length,
      occurrences: finishedOccurrences
    });

  } catch (error) {
    console.error('Error viewing finished occurrences:', error);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Failed to load finished occurrences",
      variant: "destructive",
    });
  }
};

// Update the type definition for viewOccurrencesData
const [viewOccurrencesData, setViewOccurrencesData] = useState<{
  parentSession: Session;
  occurrences: Session[];
  groupedOccurrences?: { [status: string]: Session[] };
  showOnlyFinished?: boolean;
  totalOccurrences?: number;
  finishedCount?: number;
  upcomingCount?: number;
} | null>(null);

const OccurrencesDialog = () => {
  if (!viewOccurrencesData) return null;

  const { parentSession, occurrences } = viewOccurrencesData;
  
  // Group occurrences by status
  const groupedOccurrences = occurrences.reduce((acc, occ) => {
    const status = occ.status || "Unknown";
    if (!acc[status]) acc[status] = [];
    acc[status].push(occ);
    return acc;
  }, {} as Record<string, Session[]>);

  return (
    <Dialog 
      open={isOccurrencesDialogOpen} 
      onOpenChange={(open) => {
        setIsOccurrencesDialogOpen(open);
        if (!open) setViewOccurrencesData(null);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recurring Session: {parentSession.name}</DialogTitle>
          <DialogDescription>View and manage session information</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Session Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <div className="font-medium">
                {format(new Date(parentSession.date), "PPP")}
              </div>
            </div>
            <div>
              <Label>End Date</Label>
              <div className="font-medium">
                {format(new Date(parentSession.recurringEndDate || parentSession.date), "PPP")}
              </div>
            </div>
            <div>
              <Label>Days</Label>
              <div className="font-medium">
                {parentSession.selectedDays?.map(day => 
                  day.charAt(0).toUpperCase() + day.slice(1)
                ).join(", ") || "None"}
              </div>
            </div>
            <div>
              <Label>Total Occurrences</Label>
              <div className="font-medium">{occurrences.length}</div>
            </div>
          </div>

          {/* Occurrences Section */}
          <div className="space-y-4">
            {Object.entries(groupedOccurrences).map(([status, statusOccurrences]) => (
              <div key={status} className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3 flex justify-between items-center">
                  {status} <span className="text-sm text-muted-foreground">({statusOccurrences.length})</span>
                </h3>
                <div className="space-y-2">
                  {statusOccurrences.length > 0 ? (
                    statusOccurrences.map(occurrence => (
                      <div 
                        key={occurrence.id}
                        className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg hover:bg-secondary/30 transition-colors"
                      >
                        <div>
                          <div className="font-medium">
                            {format(new Date(occurrence.date), "PPP")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {occurrence.startTime} - {occurrence.endTime}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Attendance: {Object.values(occurrence.attendance || {})
                              .filter(a => a.status === "Present").length} / {
                              occurrence.assignedPlayers?.length || 0
                            }
                          </div>
                        </div>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => {handleViewDetails(occurrence.id);setIsOccurrencesDialogOpen(false)}}
                        >
                          View Details
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      No {status.toLowerCase()} occurrences
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Add new SessionTable component for reusability

// Add this useEffect to load coaches from localStorage
  

// Update getAvailableCoaches function


// Add state for available coaches
const [availableCoaches, setAvailableCoaches] = useState<any[]>([]);

// Add effect to load coaches when dialog opens


  // Add new handler for deselecting batch
  

  // Add this function to handle date selection properly
  

  // Update batch selection handler


  // Update individual player selection handler

  

  // Remove this duplicate line as we already have it at the top

  // Replace handleConfirmExport to clear all sessions from the database using DELETE API


  // Reset visible count when changing tabs or search
  useEffect(() => {
    setVisibleSessionsCount(10)
  }, [activeLog, searchTerm])

  const getPlayerCurrentMetrics = async (playerId: string, sessionId: number, sessions: Session[]) => {
  const cacheKey = `${playerId}-${sessionId}`;
  const now = Date.now();

  // Return cached data if available and not expired
  if (metricsCache[cacheKey] && now - metricsCache[cacheKey].timestamp < 300000) { // 5 minutes
    return metricsCache[cacheKey].data;
  }

  try {
    // Get player's data from MongoDB (including performanceHistory)
    const response = await fetch(`/api/db/ams-player-data/${playerId}`);
    if (!response.ok) throw new Error('Failed to fetch player data');
    const playerData = await response.json();

    if (!playerData.success || !playerData.data) {
      throw new Error('Invalid player data response');
    }

    const player = playerData.data;

    // Check if sessionId exists in player's performanceHistory
    const sessionMetrics = player.performanceHistory?.find((entry: any) => {
      // Handle both direct sessionId match and occurrence sessionId match
      return entry.sessionId === sessionId || 
             entry.sessionId === sessionId.toString() ||
             (typeof entry.sessionId === 'string' && entry.sessionId.includes(sessionId.toString()));
    });

    let metrics;
    
    if (sessionMetrics && sessionMetrics.attributes) {
      // If session-specific metrics exist, use them
      metrics = {
        Attack: sessionMetrics.attributes.Attack?.toString() || "0",
        pace: sessionMetrics.attributes.pace?.toString() || "0",
        Physicality: sessionMetrics.attributes.Physicality?.toString() || "0",
        Defense: sessionMetrics.attributes.Defense?.toString() || "0",
        passing: sessionMetrics.attributes.passing?.toString() || "0",
        Technique: sessionMetrics.attributes.Technique?.toString() || "0",
        sessionRating: sessionMetrics.sessionRating?.toString() || "0"
      };
    } else {
      // If no session-specific metrics, use player's current attributes (latest)
      metrics = {
        Attack: player.attributes?.Attack?.toString() || "0",
        pace: player.attributes?.pace?.toString() || "0",
        Physicality: player.attributes?.Physicality?.toString() || "0",
        Defense: player.attributes?.Defense?.toString() || "0",
        passing: player.attributes?.passing?.toString() || "0",
        Technique: player.attributes?.Technique?.toString() || "0",
        sessionRating: "0" // Default session rating for unmarked sessions
      };
    }

    // Cache the metrics
    metricsCache[cacheKey] = {
      data: metrics,
      timestamp: now,
      isDirty: false
    };

    return metrics;
  } catch (error) {
    console.error('Error getting player metrics:', error);
    return metricsCache[cacheKey]?.data || {
      Attack: "0", pace: "0", Physicality: "0",
      Defense: "0", passing: "0", Technique: "0",
      sessionRating: "0"
    };
  }
};
  
  const handleMetricsClick = async (playerId: string, playerName: string, sessionId: number | string) => {
    try {
      const currentMetrics = await getPlayerCurrentMetrics(playerId, sessionId as number, sessions);
      setPlayerMetrics(prev => ({
        ...prev,
        [playerId]: currentMetrics
      }));
      setSelectedPlayerForMetrics({
        id: playerId,
        name: playerName,
        sessionId: Number(sessionId)
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
      toast({
        title: "Error",
        description: "Failed to load player metrics",
        variant: "destructive",
      });
    }
  };

// Update the handleSaveMetrics function
const handleSaveMetrics = async (sessionId: number | string, playerId: string, metricsToSave: any) => {
  try {
    if (!metricsToSave || !sessionId || !playerId || !user?.academyId) {
      throw new Error('Missing required data');
    }

    const sessionObj = sessions.find(s => s.id?.toString() === sessionId.toString());
    const sessionDate = sessionObj ? sessionObj.date : new Date().toISOString();

    const numericMetrics = {
      Attack: Math.min(Math.max(Number(metricsToSave.Attack || 0), 0), 10),
      pace: Math.min(Math.max(Number(metricsToSave.pace || 0), 0), 10),
      Physicality: Math.min(Math.max(Number(metricsToSave.Physicality || 0), 0), 10),
      Defense: Math.min(Math.max(Number(metricsToSave.Defense || 0), 0), 10),
      passing: Math.min(Math.max(Number(metricsToSave.passing || 0), 0), 10),
      Technique: Math.min(Math.max(Number(metricsToSave.Technique || 0), 0), 10),
    };

    const sessionRating = Math.min(Math.max(Number(metricsToSave.sessionRating || 0), 0), 10);

    // Calculate overall
    const overall = Math.round(
      Object.values(numericMetrics).reduce((sum, val) => sum + val, 0) /
      Object.keys(numericMetrics).length
    );

    // Update the session metrics first
    const sessionResponse = await fetch(`/api/db/ams-player-data/update-session-metrics`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        sessionId,
        attributes: numericMetrics,
        sessionRating,
        overall,
        type: 'training',
        date: sessionDate,
        academyId: user.academyId
      }),
    });

    if (!sessionResponse.ok) {
      throw new Error('Failed to update metrics');
    }

    // Update the session state locally
    setSessions(prev => prev.map(session => {
      if (session.id?.toString() === sessionId.toString()) {
        return {
          ...session,
          playerMetrics: {
            ...session.playerMetrics,
            [playerId]: {
              ...numericMetrics,
              sessionRating,
              overall,
              updatedAt: new Date().toISOString()
            }
          }
        };
      }
      return session;
    }));

    // Update the mongoPlayers state so dialog shows latest metrics immediately
    setMongoPlayers(prevPlayers =>
      prevPlayers.map(player =>
        player.id === playerId
          ? {
              ...player,
              attributes: {
                ...player.attributes,
                ...numericMetrics
              },
              lastUpdated: new Date().toISOString()
            }
          : player
      )
    );

    // If we have a view details session open, update it too
    if (viewDetailsSessionData && viewDetailsSessionData.id?.toString() === sessionId.toString()) {
      setViewDetailsSessionData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          playerMetrics: {
            ...prev.playerMetrics,
            [playerId]: {
              ...numericMetrics,
              sessionRating,
              overall,
              updatedAt: new Date().toISOString()
            }
          }
        };
      });
    }

    toast({
      title: "Success",
      description: "Player metrics updated successfully",
      variant: "default",
    });

    return true;

  } catch (error) {
    console.error('Error saving metrics:', error);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Failed to save metrics",
      variant: "destructive",
    });
    return false;
  }
};

// Update the PlayerMetricsDialog component
const PlayerMetricsDialog = () => {
  const [localMetrics, setLocalMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const dialogRef = useRef<{ hasLoaded: boolean }>({ hasLoaded: false });

  useEffect(() => {
    const loadMetrics = async () => {
      if (!selectedPlayerForMetrics || dialogRef.current.hasLoaded) return;

      setIsLoading(true);
      try {
        const session = sessions.find(s => s.id === selectedPlayerForMetrics.sessionId);
        if (!session) {
          console.error('Session not found for metrics dialog');
          return;
        }

        // Fetch metrics from session's playerMetrics or fallback to player's original attributes
        const playerMetrics = session.playerMetrics?.[selectedPlayerForMetrics.id];
        const playerData = mongoPlayers.find(p => p.id === selectedPlayerForMetrics.id);

        const metrics = {
          Attack: playerMetrics?.Attack?.toString() || playerData?.attributes?.Attack?.toString() || "0",
          pace: playerMetrics?.pace?.toString() || playerData?.attributes?.pace?.toString() || "0",
          Physicality: playerMetrics?.Physicality?.toString() || playerData?.attributes?.Physicality?.toString() || "0",
          Defense: playerMetrics?.Defense?.toString() || playerData?.attributes?.Defense?.toString() || "0",
          passing: playerMetrics?.passing?.toString() || playerData?.attributes?.passing?.toString() || "0",
          Technique: playerMetrics?.Technique?.toString() || playerData?.attributes?.Technique?.toString() || "0",
          sessionRating: playerMetrics?.sessionRating?.toString() || "0",
        };

        setLocalMetrics(metrics);
        dialogRef.current.hasLoaded = true;
      } catch (error) {
        console.error('Error loading metrics:', error);
        toast({
          title: "Error",
          description: "Failed to load player metrics",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();
  }, [selectedPlayerForMetrics, sessions, mongoPlayers]);

  const handleDialogClose = () => {
    setSelectedPlayerForMetrics(null);
    setLocalMetrics(null);
    dialogRef.current.hasLoaded = false;
    
    // Don't reopen occurrences dialog if it wasn't open before
    if (!isOccurrencesDialogOpen) {
      setIsOccurrencesDialogOpen(false);
    }
  };
  const handleMetricChange = (key: string, value: number) => {
    setLocalMetrics((prev: any) => ({
      ...prev,
      [key]: value.toString()
    }));
  };

  const handleSaveAndClose = async () => {
    if (!selectedPlayerForMetrics || !localMetrics) return;

    const success = await handleSaveMetrics(
      selectedPlayerForMetrics.sessionId,
      selectedPlayerForMetrics.id,
      localMetrics
    );

    if (success) {
      setSelectedPlayerForMetrics(null);
      setLocalMetrics(null);
      handleDialogClose();
    }
  };

  return (
    <Dialog 
      open={!!selectedPlayerForMetrics} 
      onOpenChange={(open) => {
        if (!open) {
          setSelectedPlayerForMetrics(null);
          setLocalMetrics(null);
          dialogRef.current.hasLoaded = false;
          handleDialogClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Input Metrics for {selectedPlayerForMetrics?.name}
          </DialogTitle>
          <DialogDescription>
            Update performance metrics and session rating
          </DialogDescription>
        </DialogHeader>
        <div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {localMetrics && METRICS_CONFIG.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">{label}</Label>
                  <span className="text-sm text-muted-foreground">
                    {localMetrics[key as keyof typeof localMetrics]}/10
                  </span>
                </div>
                <Slider
                  value={[Number(localMetrics[key as keyof typeof localMetrics])]}
                  min={0}
                  max={10}
                  step={0.1}
                  onValueChange={([value]) => handleMetricChange(key, value)}
                />
              </div>
            ))}
            <div className="col-span-2 space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">Session Rating</Label>
                <span className="text-sm text-muted-foreground">
                  {localMetrics?.sessionRating}/10
                </span>
              </div>
              <Slider
                value={[Number(localMetrics?.sessionRating)]}
                min={0}
                max={10}
                step={0.1}
                onValueChange={([value]) => handleMetricChange('sessionRating', value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button onClick={handleSaveAndClose}>
            Save Metrics
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// AttendanceSelector component for three-state attendance
const AttendanceSelector = ({ 
  currentStatus, 
  onStatusChange, 
  disabled = false,
  playerId,
  sessionStatus 
}: {
  currentStatus?: "Present" | "Absent" | "Unmarked";
  onStatusChange: (status: "Present" | "Absent" | "Unmarked") => void;
  disabled?: boolean;
  playerId: string;
  sessionStatus: string;
}) => {
  const status = currentStatus || "Unmarked";
  
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "Present":
        return {
          color: "bg-green-500 hover:bg-green-600 text-white border-green-500",
          text: "Present",
          next: "Absent"
        };
      case "Absent":
        return {
          color: "bg-red-500 hover:bg-red-600 text-white border-red-500",
          text: "Absent", 
          next: "Unmarked"
        };
      case "Unmarked":
      default:
        return {
          color: "bg-gray-500 hover:bg-gray-600 text-white border-gray-500",
          text: "Unmarked",
          next: "Present"
        };
    }
  };

  const config = getStatusConfig(status);

  const handleClick = () => {
    if (disabled) return;
    onStatusChange(config.next as "Present" | "Absent" | "Unmarked");
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={disabled}
        className={`min-w-[90px] text-xs transition-colors ${config.color} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {config.text}
      </Button>
      {!disabled && (
        <span className="text-xs text-gray-400">
          Click → {config.next}
        </span>
      )}
    </div>
  );
};

  // Add this new function
  const handleSelectAllPlayers = (checked: boolean) => {
    if (newSession.assignedBatch) {
      // If batch is selected, select/deselect all filtered batch players
      const batchPlayers = batches
        .find((batch) => batch.id === newSession.assignedBatch)
        ?.players.filter(playerId => {
          const player = players.find(p => 
            p.id === playerId && 
            p.academyId === user?.academyId // Add academy filter
          );
          return player?.name.toLowerCase().includes(playerSearchQuery.toLowerCase());
        }) || [];
      setNewSession(prev => ({
        ...prev,
        assignedPlayers: checked ? batchPlayers.map(id => id.toString()) : []
      }));
    } else {
      // If no batch selected, select/deselect all filtered individual players
      const filteredPlayers = players
        .filter(player => 
          player.academyId === user?.academyId &&
          player.name.toLowerCase().includes(playerSearchQuery.toLowerCase())
        )
        .map(player => player.id.toString());
      setNewSession(prev => ({
        ...prev,
        assignedPlayers: checked ? filteredPlayers : []
      }));
    }
  };

const handleViewUpcomingOccurrences = async (parentId: number) => {
  try {
    if (!user?.academyId) {
      toast({
        title: "Error",
        description: "No academy ID found",
        variant: "destructive",
      });
      return;
    }

    console.log('Fetching parent session:', parentId);

    // Fetch parent session
    const parentResponse = await fetch(`/api/db/ams-sessions/${parentId}`);
    if (!parentResponse.ok) throw new Error('Failed to fetch parent session');
    const parentResult = await parentResponse.json();

    if (!parentResult.success || !parentResult.data) {
      throw new Error('Invalid parent session response');
    }

    // Fetch all occurrences
    const occurrencesResponse = await fetch(
      `/api/db/ams-sessions/occurrences?parentId=${parentId}&academyId=${user.academyId}`
    );
    if (!occurrencesResponse.ok) throw new Error('Failed to fetch occurrences');
    const occurrencesResult = await occurrencesResponse.json();

    // Ensure the data is an array
    const allOccurrences = Array.isArray(occurrencesResult.data) ? occurrencesResult.data : [];

    // Calculate status for each occurrence based on date and time
    const now = new Date();
    const upcomingOccurrences = allOccurrences
      .map((occurrence: Session) => {
        // Adjust the date to handle timezone offset
        const occurrenceDate = new Date(occurrence.date);
        occurrenceDate.setDate(occurrenceDate.getDate() + 1);  // Remove +1 adjustment
        
        const [startHour, startMinute] = occurrence.startTime.split(':').map(Number);
        const sessionStart = new Date(occurrenceDate);
        sessionStart.setHours(startHour, startMinute, 0);

        // Only include future sessions (upcoming)
        if (now < sessionStart) {
          return {
            ...occurrence,
            date: occurrenceDate.toISOString().split('T')[0], // Use adjusted date
            status: "Upcoming" as const
          };
        }
        return null;
      })
      .filter(Boolean) // Remove null values
      .sort((a: Session, b: Session) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by date ascending

    setViewOccurrencesData({
      parentSession: parentResult.data,
      occurrences: upcomingOccurrences,
      totalOccurrences: allOccurrences.length,
      upcomingCount: upcomingOccurrences.length
    });

    // Ensure the dialog box opens
    setIsOccurrencesDialogOpen(true);

    console.log('Upcoming occurrences:', {
      total: allOccurrences.length,
      upcoming: upcomingOccurrences.length,
      occurrences: upcomingOccurrences
    });

  } catch (error) {
    console.error('Error viewing upcoming occurrences:', error);
    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Failed to load upcoming occurrences",
      variant: "destructive",
    });
  }
};

const renderSessionDetails = (session: Session | undefined) => {
  if (!session) return null;

  console.log('Rendering session details:', session);

  // Helper function to calculate session status
  const calculateSessionStatus = (session: Session) => {
    const now = new Date();
    const sessionDate = new Date(session.date);
    const [startHour, startMinute] = session.startTime.split(':').map(Number);
    const [endHour, endMinute] = session.endTime.split(':').map(Number);

    const sessionStart = new Date(sessionDate);
    sessionStart.setHours(startHour, startMinute, 0);

    const sessionEnd = new Date(sessionDate);
    sessionEnd.setHours(endHour, endMinute, 0);

    if (now < sessionStart) {
      return "Upcoming" as const;
    } else if (now >= sessionStart && now <= sessionEnd) {
      return "On-going" as const;
    } else {
      return "Finished" as const;
    }
  };

  const currentStatus = calculateSessionStatus(session);
  // Ensure detailsPlayerSearchQuery is defined as a state variable
  // Add this at the top of your SessionsContent component if not already present:
  // const [detailsPlayerSearchQuery, setDetailsPlayerSearchQuery] = useState("");

  const filteredPlayers = (session.assignedPlayersData || []).filter(player => 
    player.name.toLowerCase().includes((detailsPlayerSearchQuery || "").toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Session Name</Label>
          <div className="font-medium">{session.name || "N/A"}</div>
        </div>
        <div>
          <Label>Date</Label>
          <div className="font-medium">
            {session.isOccurrence 
              ? format(new Date(session.date), "PPP")
              : session.isRecurring 
                ? `${format(new Date(session.date), "PPP")} to ${format(new Date(session.recurringEndDate || session.date), "PPP")}`
                : format(new Date(session.date), "PPP")}
          </div>
        </div>
        <div>
          <Label>Time</Label>
          <div className="font-medium">
            {session.startTime && session.endTime 
              ? `${session.startTime} - ${session.endTime}`
              : "N/A"}
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Badge 
            variant={
              currentStatus === "On-going" ? "default" : 
              currentStatus === "Finished" ? "secondary" : 
              "outline"
            }
          >
            {currentStatus || "Unknown"}
          </Badge>
        </div>
      </div>

      {/* Player List Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Label>Assigned Players ({filteredPlayers.length})</Label>
          <div className="w-1/3">
            <Input
              placeholder="Search players..."
              value={detailsPlayerSearchQuery}
              onChange={(e) => setDetailsPlayerSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        <div className="border rounded-md p-4 mt-2 max-h-[400px] overflow-y-auto">
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player) => {
              const attendanceStatus = session.attendance?.[player.id]?.status;
              const isPresent = attendanceStatus === "Present";

              return (
                <div key={player.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                      <img
                        src={player.photoUrl || DEFAULT_AVATAR}
                        alt={player.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{player.name}</span>
                      <span className="text-sm text-gray-500">{player.position}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                  <AttendanceSelector
                    currentStatus={session.attendance?.[player.id]?.status || "Unmarked"}
                    onStatusChange={async (newStatus) => {
                      if (!user?.academyId) {
                        toast({
                          title: "Error",
                          description: "No academy ID available. Please contact administrator.",
                          variant: "destructive",
                        });
                        return;
                      }
                      if (setSessions && setViewDetailsSessionData) {
                        await handleAttendanceChange(
                          Number(session.id),
                          player.id,
                          newStatus, // ✅ Now Defense string instead of boolean
                          viewDetailsSessionData ?? null,
                          setViewDetailsSessionData,
                          user ?? null,
                          sessions,
                          setSessions,
                          user?.academyId ?? ""
                        );
                      }
                    }}
                    disabled={currentStatus === "Upcoming"}
                    playerId={player.id}
                    sessionStatus={currentStatus}
                  />
                  {(session.attendance?.[player.id]?.status === "Present") && currentStatus === "Finished" && (
                    <Button
                      size="sm"
                      variant="outline" 
                      onClick={() => handleMetricsClick(player.id, player.name, session.id)}
                    >
                      Input Metrics
                    </Button>
                  )}
                </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-gray-500">
              No players found
            </div>
          )}
        </div>
      </div>

      {/* Additional Details */}
      <div>
        <Label>Coaches</Label>
        <div className="font-medium mt-1">
          {session.coachNames?.length ? session.coachNames.join(", ") : "Not assigned"}
        </div>
      </div>
      {session.isOccurrence && session.parentSessionId && (
        <div>
          <Label>Occurrence Details</Label>
          <div className="text-sm text-gray-500 mt-1">
            Part of recurring session #{session.parentSessionId}
          </div>
        </div>
      )}
    </div>
  );
};

 
  const handleAttendanceChange = async (
    sessionId: number | string,
    playerId: string,
    newStatus: string,
    viewDetailsSessionData: Session | null,
    setViewDetailsSessionData: (session: Session | null) => void,
    user: { academyId?: string; id?: string } | null,
    sessions: Session[],
    setSessions: React.Dispatch<React.SetStateAction<Session[]>>,
    academyId: string // <-- now required as 9th argument
  ) => {
    const effectiveAcademyId = academyId || user?.academyId;
    if (!effectiveAcademyId) {
      console.error('[ATTENDANCE] No academyId available');
      return;
    }

    // Find session in local state
    const session = sessions.find(s =>
      s._id?.toString() === sessionId.toString() ||
      s.id?.toString() === sessionId.toString()
    );

    if (!session) {
      console.error('[ATTENDANCE] Session not found:', sessionId);
      return;
    }

    // Create updated attendance object
    const updatedAttendance = {
      ...session.attendance,
      [playerId]: {
        status: newStatus,
        markedAt: new Date().toISOString(),
        markedBy: user?.id || ''
      }
    };

    // Update local state immediately for fast UI
    setSessions((prev: Session[]) => prev.map(s => {
      if (
        s._id?.toString() === sessionId.toString() ||
        s.id?.toString() === sessionId.toString()
      ) {
        const fixedAttendance: Session['attendance'] = Object.fromEntries(
          Object.entries(updatedAttendance).map(([pid, data]) => [
            pid,
            {
              ...data,
              status: data.status === "Present" ? "Present" : "Absent",
              markedBy: data.markedBy ?? (user?.id ?? "")
            }
          ])
        );
        return { ...s, attendance: fixedAttendance };
      }
      return s;
    }));

    // Update view details if open
    if (
      viewDetailsSessionData?._id?.toString() === sessionId.toString() ||
      viewDetailsSessionData?.id?.toString() === sessionId.toString()
    ) {
      setViewDetailsSessionData({
        ...viewDetailsSessionData!,
        attendance: Object.fromEntries(
          Object.entries(updatedAttendance).map(([pid, data]) => [
            pid,
            {
              ...data,
              status: data.status === "Present" ? "Present" : "Absent"
            } as { status: "Present" | "Absent"; markedAt: string; markedBy: string; }
          ])
        ) as { [playerId: string]: { status: "Present" | "Absent"; markedAt: string; markedBy: string; } }
      });
    }

    // Show immediate success toast
    if (typeof toast === "function") {
      toast({
        title: "Updating",
        description: `Marking as ${newStatus === "Present" ? "Present" : "Absent"}...`,
      });
    }

    // Update backend
    try {
      const updatePayload = {
        attendance: updatedAttendance,
        academyId: effectiveAcademyId,
        isOccurrence: session.isOccurrence || false,
        parentSessionId: session.parentSessionId,
        lastUpdated: new Date().toISOString()
      };

      const apiId = session._id || session.id;
      const response = await fetch(`/api/db/ams-sessions/${apiId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) throw new Error('Failed to update attendance');

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to update attendance');

      // Fetch latest attendance from backend and log it
      const fetchAttendanceResp = await fetch(`/api/db/ams-sessions/${sessionId}?academyId=${effectiveAcademyId}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (fetchAttendanceResp.ok) {
        const attendanceResult = await fetchAttendanceResp.json();
        if (attendanceResult.success && attendanceResult.data) {
          console.log(
            `[ATTENDANCE][AFTER UPDATE] Session ID: ${attendanceResult.data.id} | Recurring: ${!!attendanceResult.data.isRecurring} | Occurrence: ${!!attendanceResult.data.isOccurrence}`,
            attendanceResult.data.attendance
          );
        }
      }

      // Show final success toast
      if (typeof toast === "function") {
        toast({
          title: "Success",
          description: `Attendance saved as ${newStatus === "Present" ? "Present" : newStatus === "Absent" ? "Absent" : "Unmarked"}`,
          variant: "default",
        });
      }

    } catch (error) {
      // Revert local state on error
      

      // Update view details if open
      if (
        viewDetailsSessionData?._id?.toString() === sessionId.toString() ||
        viewDetailsSessionData?.id?.toString() === sessionId.toString()
      ) {
        setViewDetailsSessionData({
          ...viewDetailsSessionData!,
          attendance: session.attendance
        });
      }

      // Show error toast
      console.error('Error updating attendance:', error);
      if (typeof toast === "function") {
        toast({
          title: "Error",
          description: "Failed to save attendance. Changes reverted.",
          variant: "destructive",
        });
      }
    }
  };

  // Add this helper function for status calculation
  const calculateSessionStatus = (session: Session) => {
    const now = new Date();
    const sessionDate = new Date(session.date);
    const [startHour, startMinute] = session.startTime.split(':').map(Number);
    const [endHour, endMinute] = session.endTime.split(':').map(Number);
    
    const sessionStart = new Date(sessionDate);
    sessionStart.setHours(startHour, startMinute, 0);
    
    const sessionEnd = new Date(sessionDate);
    sessionEnd.setHours(endHour, endMinute, 0);
    
    if (now < sessionStart) {
      return "Upcoming" as const;
    } else if (now >= sessionStart && now <= sessionEnd) {
      return "On-going" as const;
    } else {
      return "Finished" as const;
    }
  };

  // Add this new handler for full metrics input
  const handleFullMetricsInput = (sessionId: number, playerId: string) => {
    // Redirect to coach dashboard metrics page with query parameters
    router.push(`/dashboard/coach/metrics/${playerId}?sessionId=${sessionId}`);  // Standardized parameter names
  };

  // Add this state for storing players from MongoDB
  const [mongoPlayers, setMongoPlayers] = useState<any[]>([]);

  // Add this effect to fetch players from MongoDB
  useEffect(() => {
    const fetchMongoPlayers = async () => {
      try {
        if (!user?.academyId) {
          console.log('No academyId available');
          return;
        }

        const response = await fetch(`/api/db/ams-player-data?academyId=${user.academyId}`);
        if (!response.ok) throw new Error('Failed to fetch players');
        
        const result = await response.json();
        
        // Ensure we're setting an array
        if (result.success && Array.isArray(result.data)) {
          setMongoPlayers(result.data.map((player: any) => ({
            ...player,
            id: player.id?.toString() || player.id,
            name: player.name || player.username || 'Unknown Player',
            academyId: player.academyId
          })));
        } else {
          console.error('Invalid player data format:', result);
          setMongoPlayers([]);
        }
      } catch (error) {
        console.error('Error fetching players:', error);
        setMongoPlayers([]);
      }
    };

    fetchMongoPlayers();
  }, [user?.academyId]);

  // Update the player selection section in the dialog
  const renderPlayerSelection = () => {
    // Ensure players are filtered correctly based on batch or academy
    const filteredPlayers = newSession.assignedBatch
      ? // If a batch is selected, filter players in the batch
        newSession.assignedPlayersData.filter(player =>
          player.name.toLowerCase().includes(playerSearchQuery.toLowerCase())
        )
      : // If no batch is selected, show all players in the academy
        mongoPlayers.filter(player =>
          player.academyId === user?.academyId &&
          player.name.toLowerCase().includes(playerSearchQuery.toLowerCase())
        );
  
    // Calculate if all visible players are selected
    const allSelected = filteredPlayers.length > 0 && 
      filteredPlayers.every(player => 
        newSession.assignedPlayers.includes(player.id.toString())
      );
  
    // Calculate if some but not all players are selected
    const someSelected = filteredPlayers.some(player => 
      newSession.assignedPlayers.includes(player.id.toString())
    );
  
    
  };



  // Move renderBatchPlayers inside SessionsContent so it can access handlePlayerSelect and state
  const renderBatchPlayers = (newSession: any, playerSearchQuery: string) => {
    if (!newSession.assignedBatch) return null;

    // Find the selected batch
    const selectedBatch = batches.find(batch => batch.id === newSession.assignedBatch);

    // If no batch is found, return null
    if (!selectedBatch) {
      return (
        <div className="text-sm text-gray-500 p-2">
          Selected batch not found
        </div>
      );
    }

    // Filter the players based on the search query
    const filteredPlayers = newSession.assignedPlayersData.filter((player: { id: string; name: string }) =>
      player.name.toLowerCase().includes(playerSearchQuery.toLowerCase())
    );
  };

  // Add helper function to calculate duration between two time strings
  const calculateDuration = (startTime: string, endTime: string) => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    let durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    if (durationMinutes < 0) durationMinutes += 24 * 60; // Handle overnight sessions
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar /> {/* Add the Sidebar component here */}
      <div className="flex-1 flex flex flex-col space-y-6 overflow-auto">
        <h1 className="text-3xl font-bold text-white p-4">Sessions</h1>
        <div className="flex justify-between p-4">
          <div className="flex space-x-4">
            {/* Add the toggle button here */}
            <Button
              variant={showMySessions ? "default" : "outline"}
              onClick={() => setShowMySessions(!showMySessions)}
              className="min-w-[150px]"
            >
              {showMySessions ? "My Sessions" : "All Sessions"}
            </Button>
          </div>
          <div>
            <div className="text-white">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </div>
          </div>
        </div>
        {/* Update the Unsaved Sessions card */}
        {unsavedSessions.length > 0 && (
          <div className="px-4">
            <Card className="border border-yellow-500">
              <CardHeader>
                <CardTitle className="text-yellow-500">Unsaved Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Batch/Players</TableHead>
                      <TableHead>Recurrence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Filter out occurrence sessions and only show parent recurring sessions or non-recurring sessions */}
                    {unsavedSessions
                      .filter(session => !session.isOccurrence)
                      .map((session) => (
                        <TableRow key={`unsaved-${session.id}-${Date.now()}`}>
                          <TableCell>{session.name}</TableCell>
                          <TableCell>
                            {session.isRecurring 
                              ? `${session.date} to ${session.recurringEndDate}` 
                              : session.date}
                          </TableCell>
                          <TableCell>{`${session.startTime} - ${session.endTime}`}</TableCell>
                          <TableCell>
                            {session.assignedBatch
                              ? batches.find((b) => b.id === session.assignedBatch)?.name
                              : `${session.assignedPlayers?.length || 0} players`}
                          </TableCell>
                          <TableCell>
                            {session.isRecurring ? (
                              <div className="flex flex-col">
                                <span>{session.selectedDays?.join(", ")}</span>
                                <span className="text-sm text-muted-foreground">
                                  {session.totalOccurrences} occurrences
                                </span>
                              </div>
                            ) : (
                              "Single Session"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div className="flex justify-between p-4">
          <Input
            type="text"
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="px-4">
          <Tabs
            defaultValue="All"
            value={activeLog}
            onValueChange={(value) => setActiveLog(value as typeof activeLog)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4 bg-gray-800">
              <TabsTrigger 
                value="All"
                className="data-[state=active]:bg-gray-900"
              >
                All
              </TabsTrigger>
              <TabsTrigger 
                value="Finished"
                className="data-[state=active]:bg-gray-900"
              >
                Finished
              </TabsTrigger>
              <TabsTrigger 
                value="On-going"
                className="data-[state=active]:bg-gray-900"
              >
                On-going
              </TabsTrigger>
              <TabsTrigger 
                value="Upcoming"
                className="data-[state=active]:bg-gray-900"
              >
                Upcoming
              </TabsTrigger>
            </TabsList>
            <TabsContent value="All">
              {renderSessionTable("All")}
            </TabsContent>
            <TabsContent value="Finished">
              {renderSessionTable("Finished")}
            </TabsContent>
            <TabsContent value="On-going">
              {renderSessionTable("On-going")}
            </TabsContent>
            <TabsContent value="Upcoming">
              {renderSessionTable("Upcoming")}
            </TabsContent>
          </Tabs>
        </div>
        <OccurrencesDialog />
        {/* Session Details Dialog */}
        <Dialog open={viewDetailsSessionId !== null} onOpenChange={() => setViewDetailsSessionId(null)}>
          <DialogContent className="max-w-4xl max-h-[100vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Session Details</DialogTitle>
              <DialogDescription>
                View and manage session information, attendance, and metrics
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {renderSessionDetails(viewDetailsSessionData ?? undefined)}
            </div>
            <DialogFooter>
              <Button variant="default" onClick={() => setViewDetailsSessionId(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog> 
      </div>
      <PlayerMetricsDialog />
    </div>
  )
}

// Add this after the interfaces and before the component
const METRICS_CONFIG = [
  { key: "Attack", label: "Attack" },
  { key: "pace", label: "Pace" },
  { key: "Physicality", label: "Physicality" },
  { key: "Defense", label: "Defense" },
  { key: "passing", label: "passing" },
  { key: "Technique", label: "Technique" },
  { key: "sessionRating", label: "Session Rating" }
] as const;








// ...rest of existing code remains unchanged...

// Update DialogContent component to fix hydration error
// Add this helper function for status calculation before renderSessionDetails
const calculateSessionStatus = (session: Session) => {
  const now = new Date();
  const sessionDate = new Date(session.date);
  const [startHour, startMinute] = session.startTime.split(':').map(Number);
  const [endHour, endMinute] = session.endTime.split(':').map(Number);

  const sessionStart = new Date(sessionDate);
  sessionStart.setHours(startHour, startMinute, 0);

  const sessionEnd = new Date(sessionDate);
  sessionEnd.setHours(endHour, endMinute, 0);

  if (now < sessionStart) {
    return "Upcoming" as const;
  } else if (now >= sessionStart && now <= sessionEnd) {
    return "On-going" as const;
  } else {
    return "Finished" as const;
  }
};

const renderSessionDetails = (
  session: Session | undefined,
  detailsPlayerSearchQuery: string = "",
  handleMetricsClickParam?: (playerId: string, playerName: string, sessionId: number | string) => void,
  viewDetailsSessionData?: Session | null,
  setViewDetailsSessionData?: (session: Session | null) => void,
  user?: { academyId?: string; id?: string } | null,
  sessions: Session[] = [],
  setSessions?: React.Dispatch<React.SetStateAction<Session[]>>
) => {
  if (!session) return null;

  console.log('Rendering session details:', session);

  const currentStatus = calculateSessionStatus(session);
  const filteredPlayers = (session.assignedPlayersData || []).filter(player => 
    player.name.toLowerCase().includes(detailsPlayerSearchQuery.toLowerCase())
  );
  // AttendanceSelector component for three-state attendance
const AttendanceSelector = ({ 
  currentStatus, 
  onStatusChange, 
  disabled = false,
  playerId,
  sessionStatus 
}: {
  currentStatus?: "Present" | "Absent" | "Unmarked";
  onStatusChange: (status: "Present" | "Absent" | "Unmarked") => void;
  disabled?: boolean;
  playerId: string;
  sessionStatus: string;
}) => {
  const status = currentStatus || "Unmarked";
  
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "Present":
        return {
          color: "bg-green-500 hover:bg-green-600 text-white border-green-500",
          text: "Present",
          next: "Absent"
        };
      case "Absent":
        return {
          color: "bg-red-500 hover:bg-red-600 text-white border-red-500",
          text: "Absent", 
          next: "Unmarked"
        };
      case "Unmarked":
      default:
        return {
          color: "bg-gray-500 hover:bg-gray-600 text-white border-gray-500",
          text: "Unmarked",
          next: "Present"
        };
    }
  };

  const config = getStatusConfig(status);

  const handleClick = () => {
    if (disabled) return;
    onStatusChange(config.next as "Present" | "Absent" | "Unmarked");
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={disabled}
        className={`min-w-[90px] text-xs transition-colors ${config.color} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {config.text}
      </Button>
      {!disabled && (
        <span className="text-xs text-gray-400">
          Click → {config.next}
        </span>
      )}
    </div>
  );
};

  // Use the passed-in function or fallback to a no-op to avoid errors
  const handleMetricsClickSafe =
    handleMetricsClickParam ||
    (() => {
      // Optionally log a warning if not provided
      console.warn("handleMetricsClick not provided to renderSessionDetails");
    });

  return (
    <div className="space-y-4">
      {/* Other session details */}
      <div className="border rounded-md p-4 mt-2 max-h-[400px] overflow-y-auto">
        {filteredPlayers.map((player) => {
          const attendanceStatus = session.attendance?.[player.id]?.status;
          const isPresent = attendanceStatus === "Present";
          
          return (
            <div key={player.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                  <img
                    src={player.photoUrl || DEFAULT_AVATAR}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{player.name || "Unknown Player"}</span>
                  {player.position && (
                    <span className="text-sm text-gray-500">{player.position}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                  <AttendanceSelector
                    currentStatus={session.attendance?.[player.id]?.status || "Unmarked"}
                    onStatusChange={async (newStatus) => {
                      if (!user?.academyId) {
                        toast({
                          title: "Error",
                          description: "No academy ID available. Please contact administrator.",
                          variant: "destructive",
                        });
                        return;
                      }
                      if (setSessions && setViewDetailsSessionData) {
                        await handleAttendanceChange(
                          Number(session.id),
                          player.id,
                          newStatus, // ✅ Now Defense string instead of boolean
                          viewDetailsSessionData ?? null,
                          setViewDetailsSessionData,
                          user ?? null,
                          sessions,
                          setSessions,
                          user?.academyId ?? ""
                        );
                      }
                    }}
                    disabled={currentStatus === "Upcoming"}
                    playerId={player.id}
                    sessionStatus={currentStatus}
                  />
                  {(session.attendance?.[player.id]?.status === "Present") && currentStatus === "Finished" && (
                    <Button
                      size="sm"
                      variant="outline" 
                      onClick={() => handleMetricsClickSafe(player.id, player.name, session.id)}
                    >
                      Input Metrics
                    </Button>
                  )}
                </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Update handleAttendanceChange to handle occurrence sessions correctly
// Update handleAttendanceChange to handle occurrence sessions correctly and always use the correct id for PATCH
// Improved handleAttendanceChange: ensures optimistic UI, but always fetches latest attendance from backend after PATCH to avoid stale state
const handleAttendanceChange = async (
  sessionId: number | string,
  playerId: string,
  newStatus: string,
  viewDetailsSessionData: Session | null,
  setViewDetailsSessionData: (session: Session | null) => void,
  user: { academyId?: string; id?: string } | null,
  sessions: Session[],
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>,
  academyId?: string
) => {
  const effectiveAcademyId = academyId || user?.academyId;
  if (!effectiveAcademyId) {
    if (typeof toast === "function") {
      toast({ title: "Error", description: "No academy ID available", variant: "destructive" });
    }
    return;
  }

  // Find session in local state
  const session = sessions.find(
    s => s._id?.toString() === sessionId.toString() || s.id?.toString() === sessionId.toString()
  );
  if (!session) {
    if (typeof toast === "function") toast({ title: "Error", description: "Session not found", variant: "destructive" });
    return;
  }

  // Snapshot original attendance to revert on error
  const originalAttendance = session.attendance ? { ...session.attendance } : {};

  const timestamp = new Date().toISOString();
  const newEntry = {
    status: newStatus,
    markedAt: timestamp,
    markedBy: user?.id || ''
  };

  // Optimistic UI update
  setSessions(prev =>
    prev.map(s => {
      if (s._id?.toString() === sessionId.toString() || s.id?.toString() === sessionId.toString()) {
        return {
          ...s,
          attendance: {
            ...s.attendance,
            [playerId]: {
              ...newEntry,
              status: (newStatus === "Present" ? "Present" : newStatus === "Absent" ? "Absent" : "Unmarked") as "Present" | "Absent" | "Unmarked"
            }
          }
        };
      }
      return s;
    })
  );
  if (
    viewDetailsSessionData &&
    (viewDetailsSessionData._id?.toString() === sessionId.toString() || viewDetailsSessionData.id?.toString() === sessionId.toString())
  ) {
    setViewDetailsSessionData({
      ...viewDetailsSessionData,
      attendance: {
        ...viewDetailsSessionData.attendance,
        [playerId]: { 
          ...newEntry, 
          status: (newStatus === "Present" ? "Present" : newStatus === "Absent" ? "Absent" : "Unmarked") as "Present" | "Absent" | "Unmarked"
        }
      }
    });
  }

  if (typeof toast === "function") {
    toast({ title: "Updating", description: `Marking as ${newStatus === "Present" ? "Present" : newStatus === "Absent" ? "Absent" : "Unmarked"}...` });
  }

  // Find correct API id
  let apiId: string | number | undefined = session._id ?? session.id;
  if (session.isOccurrence && !session._id && session.parentSessionId) {
    try {
      const occResp = await fetch(
        `/api/db/ams-sessions/occurrences?parentId=${encodeURIComponent(String(session.parentSessionId))}&academyId=${encodeURIComponent(effectiveAcademyId)}`,
        { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }
      );
      if (occResp.ok) {
        const occJson = await occResp.json();
        const occArray: Session[] = Array.isArray(occJson.data) ? occJson.data : [];
        const matched = occArray.find(o => {
          if (!o) return false;
          const oDate = (o.date || '').split('T')[0];
          const sDate = (session.date || '').split('T')[0];
          const timeMatch = (o.startTime || '') === (session.startTime || '') || (o.endTime || '') === (session.endTime || '');
          return oDate === sDate && timeMatch;
        }) || occArray.find(o => (o.date || '').split('T')[0] === (session.date || '').split('T')[0]);
        if (matched) apiId = matched._id ?? matched.id;
      }
    } catch {}
  }
  if (!apiId) {
    setSessions(prev => prev.map(s => (s._id?.toString() === sessionId.toString() || s.id?.toString() === sessionId.toString() ? { ...s, attendance: originalAttendance } : s)));
    if (viewDetailsSessionData) setViewDetailsSessionData({ ...viewDetailsSessionData, attendance: originalAttendance });
    if (typeof toast === "function") toast({ title: "Error", description: "Unable to determine session id for saving attendance", variant: "destructive" });
    return;
  }

  const apiIdStr = encodeURIComponent(String(apiId));
  const payload = {
    attendance: {
      ...session.attendance,
      [playerId]: newEntry
    },
    academyId: effectiveAcademyId,
    isOccurrence: !!session.isOccurrence,
    parentSessionId: session.parentSessionId,
    lastUpdated: new Date().toISOString()
  };

  try {
    const patchResp = await fetch(`/api/db/ams-sessions/${apiIdStr}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify(payload)
    });

    if (!patchResp.ok) throw new Error('PATCH failed');

    // Always fetch latest session from backend after PATCH to avoid stale state
    const refetch = await fetch(`/api/db/ams-sessions/${apiIdStr}?academyId=${encodeURIComponent(effectiveAcademyId)}`, { headers: { 'Cache-Control': 'no-cache' } });
    let savedSession: Session | undefined;
    if (refetch.ok) {
      const refJson = await refetch.json();
      if (refJson.success && refJson.data) savedSession = refJson.data;
    }

    if (savedSession) {
      const savedIdKey = savedSession._id ?? savedSession.id ?? apiId;
      setSessions(prev => prev.map(s => {
        if (
          s._id?.toString() === String(savedIdKey) ||
          s.id?.toString() === String(savedIdKey) ||
          s._id?.toString() === sessionId.toString() ||
          s.id?.toString() === sessionId.toString()
        ) {
          return { ...s, ...savedSession, attendance: savedSession.attendance };
        }
        return s;
      }));
      if (
        viewDetailsSessionData &&
        (viewDetailsSessionData._id?.toString() === String(savedIdKey) ||
          viewDetailsSessionData.id?.toString() === String(savedIdKey) ||
          viewDetailsSessionData._id?.toString() === sessionId.toString() ||
          viewDetailsSessionData.id?.toString() === sessionId.toString())
      ) {
        setViewDetailsSessionData({ ...viewDetailsSessionData, ...savedSession, attendance: savedSession.attendance });
      }
    }

    if (typeof toast === "function") {
      toast({ title: "Success", description: `Attendance saved as ${newStatus === "Present" ? 'Present' : newStatus === "Absent" ? 'Absent' : 'Unmarked'}`, variant: "default" });
    }
  } catch (error) {
    // Revert optimistic update on error
    setSessions(prev => prev.map(s => (s._id?.toString() === sessionId.toString() || s.id?.toString() === sessionId.toString() ? { ...s, attendance: originalAttendance } : s)));
    if (viewDetailsSessionData) setViewDetailsSessionData({ ...viewDetailsSessionData, attendance: originalAttendance });
    if (typeof toast === "function") {
      toast({ title: "Error", description: "Failed to save attendance. Changes reverted.", variant: "destructive" });
    }
  }
};

// Add this new function to render match details
const renderRecurringSessionDetails = (
  sessions: Session[],
  viewDetailsSessionId: number | null,
  handleViewDetailsParam: (id: number | string) => void
) => {
  const parentSession = sessions.find(s => s.id === viewDetailsSessionId);
  if (!parentSession) return null;

  // Find all occurrences for this session
  const occurrences = sessions.filter((s: Session) => 
    s.parentSessionId === parentSession.id || 
    (s.isOccurrence && s.id.toString().startsWith(parentSession.id.toString()))
  );

  return (
    <div className="space-y-6">
      {/* Parent Session Details */}
      <div className="border-b pb-4">
        <h3 className="text-lg font-semibold mb-4">Parent Session</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p><strong>Date:</strong> {format(new Date(parentSession.date), "PP")}</p>
            <p><strong>Time:</strong> {parentSession.startTime} - {parentSession.endTime}</p>
            <p><strong>Status:</strong> {parentSession.status}</p>
          </div>
          <div>
            <p><strong>Total Occurrences:</strong> {parentSession.totalOccurrences}</p>
            <p><strong>Recurring Until:</strong> {format(new Date(parentSession.recurringEndDate ?? parentSession.date), "PP")}</p>
            <p><strong>Repeat on:</strong> {parentSession.selectedDays?.join(", ")}</p>
          </div>
        </div>
      </div>

      {/* Occurrences */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Session Occurrences</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {occurrences.map((occurrence: Session) => (
              <TableRow key={occurrence.id}>
                <TableCell>{format(new Date(occurrence.date), "PP")}</TableCell>
                <TableCell>{occurrence.startTime} - {occurrence.endTime}</TableCell>
                <TableCell>
                  <Badge>{occurrence.status}</Badge>
                </TableCell>
                <TableCell>
                  {Object.keys(occurrence.attendance || {}).length} attended
                </TableCell>
                <TableCell>
                  <Button variant="ghost" onClick={() => handleViewDetailsParam(occurrence.id)}>
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Rest of existing session details */}
      {renderSessionDetails(parentSession)}
    </div>
  );
};
