"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, isPast } from 'date-fns';
import { toast } from "@/components/ui/use-toast";

// Helper function to get base URL for API calls
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

interface Session {
  _id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  coachNames: string[];
  status: string;
  assignedPlayers: string[];
  attendance: {
    [key: string]: {
      status: string;
      updatedAt?: string;
      markedAt?: string;
      markedBy?: string;
    }
  };
}

const isPlayerAssignedToSession = (session: Session, playerId: string): boolean => {
  return session.assignedPlayers.includes(playerId) || 
         Object.keys(session.attendance || {}).includes(playerId);
};

interface PlayerData {
  id: string;
  name: string;
}

export default function Training() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [displayLimit, setDisplayLimit] = useState(20); // New state for pagination

  // Fetch player data using the same method as profile page
  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        if (!user?.username) return;

        const response = await fetch(`/api/db/ams-player-data/user/${encodeURIComponent(user.username)}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load player data');
        }

        const data = await response.json();
        setPlayerData(data);
      } catch (error) {
        console.error('Error fetching player data:', error);
        toast({
          title: "Error",
          description: "Failed to load player data",
          variant: "destructive",
        });
      }
    };

    fetchPlayerData();
  }, [user]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        if (!user?.academyId || !playerData?.id) return;

        setLoading(true);
        const response = await fetch(
          `${getBaseUrl()}/api/db/ams-sessions?academyId=${user.academyId}`,
          { credentials: 'include' }
        );

        if (!response.ok) throw new Error('极速赛车开奖结果历史记录 Failed to fetch sessions');

        const result = await response.json();
        if (result.success) {
          // Filter sessions to only include those assigned to the player
          const playerSessions = result.data.filter((session: Session) => 
            session.assignedPlayers.includes(playerData.id)
          );
          setSessions(playerSessions);
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to load sessions",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error fetching sessions:', error);
        toast({
          title: "Error",
          description: "Failed to load sessions",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (playerData?.id) {
      fetchSessions();
    }
  }, [user, playerData]);

  const getAttendanceStatus = (session: Session): string => {
    if (!playerData?.id) return "Not marked";
    
    if (session.attendance?.[playerData.id]) {
      return session.attendance[playerData.id].status;
    }
    
    return "Not marked";
  };

  const getSessionStatus = (session: Session): string => {
    const sessionStart = new Date(`${session.date}T${session.startTime}`);
    const sessionEnd = new Date(`${session.date}T${session.endTime}`);
    const now = new Date();

    if (now > sessionEnd) {
      return "Finished";
    } else if (now >= sessionStart && now <= sessionEnd) {
      return "On-going";
    } else {
      return "Upcoming";
    }
  };

  const filteredSessions = sessions
    .filter(session => {
      const sessionStatus = getSessionStatus(session);
      return filter === "All" || filter === sessionStatus;
    })
    .sort((a, b) => {
      // Create Date objects combining date and start time
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      // Sort in descending order (most recent first)
      return dateB.getTime() - dateA.getTime();
    });

  const displayedSessions = filteredSessions.slice(0, displayLimit);
  const hasMoreSessions = filteredSessions.length > displayLimit;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Training Sessions</h1>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Finished">Finished</SelectItem>
              <SelectItem value="On-going">On-going</SelectItem>
              <SelectItem value="Upcoming">Upcoming</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-[#1a1f2b] border-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-[#85FFC4]">
                <TableRow>
                  <TableHead className="text-black">Session Name</TableHead>
                  <TableHead className="text-black">Date</TableHead>
                  <TableHead className="text-black">Time</TableHead>
                  <TableHead className="text-black">Coach</TableHead>
                  <TableHead className="text-black">Status</TableHead>
                  <TableHead className="text-black">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">Loading sessions...</TableCell>
                  </TableRow>
                ) : filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">No sessions found.</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {displayedSessions.map((session) => (
                      <TableRow key={session._id}>
                        <TableCell className="text-white">{session.name}</TableCell>
                        <TableCell className="text-white">{format(parseISO(session.date), 'yyyy-MM-dd')}</TableCell>
                        <TableCell className="text-white">{`${session.startTime} - ${session.endTime}`}</TableCell>
                        <TableCell className="text-white">{session.coachNames.join(', ')}</TableCell>
                        <TableCell className="text-white">{getSessionStatus(session)}</TableCell>
                        <TableCell className="text-white">{getAttendanceStatus(session)}</TableCell>
                      </TableRow>
                    ))}
                    {hasMoreSessions && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4">
                          <Button 
                            variant="outline" 
                            onClick={() => setDisplayLimit(prev => prev + 20)}
                            className="bg-[#85FFC4] text-black hover:bg-[#6be0a7]"
                          >
                            View More
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}