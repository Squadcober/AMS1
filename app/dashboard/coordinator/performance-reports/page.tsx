"use client"

import { useEffect, useState } from "react"
import { PerformanceLineGraph } from "@/components/charts/PerformanceLineGraph"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Radar } from "react-chartjs-2"
import { usePlayers } from "@/contexts/PlayerContext"
import { useBatches } from "@/contexts/BatchContext"
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from "chart.js"
import Slider from "@/components/Slider"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Sidebar } from "@/components/Sidebar" // Import the Sidebar component
import { useAuth } from "@/contexts/AuthContext" // Add this line
import { useToast } from "@/components/ui/use-toast" // Add this line

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface PlayerAttributes {
  shooting: number;
  pace: number;
  positioning: number;
  passing: number;
  ballControl: number;
  crossing: number;
  overall: number;
}

interface Player {
  id: string;
  _id?: string;
  name: string;
  position: string;
  academyId: string;
  photoUrl?: string;
  age?: number;
  attributes: PlayerAttributes;
  performanceHistory: PerformanceEntry[];
  sessionsAttended?: Array<{
    name: string;
    date: string;
    performance: string;
  }>;
  coachReviews?: Array<{
    coachName: string;
    comment: string;
  }>;
}

interface PerformanceEntry {
  date: string;
  sessionId?: string;
  matchId?: string;
  attributes: {
    shooting?: number;
    pace?: number;
    positioning?: number;
    passing?: number;
    ballControl?: number;
    crossing?: number;
  };
  stats?: {
    [key: string]: number;
  };
  type: 'session' | 'match' | 'drill';
}

export default function PerformanceReports() {
  const { user } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { batches } = useBatches()
  const [selectedPerson, setSelectedPerson] = useState<Player | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [entryDates, setEntryDates] = useState<{[key: string]: string}>({})
  const [view, setView] = useState<"players" | "coaches">("players")
  const [selectedplayer, setSelectedplayer] = useState<string>("")
  const [attributeFilter, setAttributeFilter] = useState<"latest" | "overall">("latest")
  const [sessionsAttended, setSessionsAttended] = useState<{[key: string]: number}>({})
  interface PerformanceData {
    date: string;
    value: number;
    attribute: string;
  }

  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([])

  // Mock data - Replace with actual API call
  const mockPerformanceData = [
    { date: "2024-01-01", value: 75, attribute: "Speed" },
    { date: "2024-01-01", value: 80, attribute: "Strength" },
    { date: "2024-01-01", value: 65, attribute: "Agility" },
    { date: "2024-02-01", value: 78, attribute: "Speed" },
    { date: "2024-02-01", value: 82, attribute: "Strength" },
    { date: "2024-02-01", value: 70, attribute: "Agility" },
    // Add more data points as needed
  ]

  // Update the calculation function to properly scale to 100
  const calculateOverall = (attributes: Partial<PlayerAttributes>) => {
    if (!attributes) return 0;
    const keys = ['shooting', 'pace', 'positioning', 'passing', 'ballControl', 'crossing'];
    const values = keys.map(key => attributes[key as keyof PlayerAttributes] || 0);
    if (values.length === 0) return 0;
    // Calculate average out of 10 and convert to scale of 100
    const avgOutOfTen = values.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.round(avgOutOfTen * 100) / 10; // This will convert 9.1 to 91
  };

  // Function to calculate average attributes for OVERALL filter
  const calculateAverageAttributes = (player: Player, sessionsAttendedCount: number): PlayerAttributes => {
    if (!player?.performanceHistory?.length) {
      return player?.attributes || {
        shooting: 0,
        pace: 0,
        positioning: 0,
        passing: 0,
        ballControl: 0,
        crossing: 0,
        overall: 0
      };
    }

    const attributeKeys: (keyof PlayerAttributes)[] = ['shooting', 'pace', 'positioning', 'passing', 'ballControl', 'crossing'];
    const averageAttributes: PlayerAttributes = {
      shooting: 0,
      pace: 0,
      positioning: 0,
      passing: 0,
      ballControl: 0,
      crossing: 0,
      overall: 0
    };

    attributeKeys.forEach(key => {
      // Sum all attribute scores from performance history
      let totalScore = 0;
      let validEntries = 0;

      player.performanceHistory.forEach((entry: any) => {
        if (entry.attributes && typeof entry.attributes[key] === 'number' && entry.attributes[key] > 0) {
          totalScore += entry.attributes[key];
          validEntries++;
          console.log(`Performance entry for ${key}: ${entry.attributes[key]}`);
        }
      });

      // Calculate average from performance history only (not including latest)
      const average = validEntries > 0 ? totalScore / validEntries : player.attributes?.[key] || 0;
      console.log(`Calculated average for ${key}: ${average} (from ${validEntries} entries)`);
      averageAttributes[key] = Math.round(average * 10) / 10; // Round to 1 decimal place
    });

    // Calculate overall score
    averageAttributes.overall = calculateOverall(averageAttributes);

    return averageAttributes;
  };

  // Fixed function to calculate sessions attended from API
  const calculateSessionsAttended = async (playerId: string, academyId: string): Promise<number> => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/db/ams-sessions?academyId=${academyId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        console.error('Failed to fetch sessions:', response.status);
        return 0;
      }

      const result = await response.json();

      if (!result.success) {
        console.error('Sessions API returned success: false');
        return 0;
      }

      // Filter sessions assigned to the player and count those marked as present
      const attendedSessions = result.data.filter((session: any) => {
        // Check if player is assigned to this session
        const isAssigned = session.assignedPlayers.includes(playerId);

        // Check if player's attendance is marked as present (case-insensitive check)
        const attendanceStatus = session.attendance?.[playerId]?.status;

        // Case-insensitive check for "present" status
        return isAssigned && attendanceStatus?.toLowerCase() === 'present';
      });

      return attendedSessions.length;
    } catch (error) {
      console.error('Error calculating sessions attended:', error);
      return 0;
    }
  };

  // Helper function to get base URL for API calls
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  };

  // Function to fetch session date
  const fetchSessionDate = async (sessionId: string): Promise<string | null> => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/db/ams-sessions/${sessionId}`, {
        credentials: 'include'
      });
      if (!response.ok) return null;
      const result = await response.json();
      if (result.success && result.data) {
        return result.data.date || result.data.startDate || null;
      }
      return null;
    } catch (error) {
      console.error('Error fetching session date:', error);
      return null;
    }
  };

  // Function to fetch match date
  const fetchMatchDate = async (matchId: string): Promise<string | null> => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/db/ams-matches?academyId=${user?.academyId}`, {
        credentials: 'include'
      });
      if (!response.ok) return null;
      const result = await response.json();
      if (result.success && result.data) {
        const match = result.data.find((m: any) => m._id === matchId || m.id === matchId);
        if (match) {
          return match.date || match.matchDate || null;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching match date:', error);
      return null;
    }
  };

  useEffect(() => {
    const loadPlayerData = async () => {
      try {
        if (!user?.academyId) {
          console.error("No academy ID found");
          return;
        }

        setLoading(true);
        const response = await fetch(`/api/db/ams-player-data?academyId=${encodeURIComponent(user.academyId)}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("API Response:", result);

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error("Invalid data format received");
        }

        const formattedPlayers = result.data.map((player: any) => ({
          id: player._id?.toString() || player.id,
          name: player.name || player.username || "Unknown Player",
          position: player.position || "Not specified",
          academyId: player.academyId,
          photoUrl: player.photoUrl || "/default-avatar.png",
          attributes: {
            shooting: player.attributes?.shooting || 0,
            pace: player.attributes?.pace || 0,
            positioning: player.attributes?.positioning || 0,
            passing: player.attributes?.passing || 0,
            ballControl: player.attributes?.ballControl || 0,
            crossing: player.attributes?.crossing || 0,
            overall: calculateOverall(player.attributes)
          },
          performanceHistory: player.performanceHistory || []
        }));

        console.log("Formatted players:", formattedPlayers);
        setPlayers(formattedPlayers);
      } catch (error) {
        console.error("Error loading player data:", error);
        toast({
          title: "Error",
          description: "Failed to load player data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPlayerData();
  }, [user?.academyId, toast]);

  useEffect(() => {
    // Replace with actual API call to fetch performance data
    setPerformanceData(mockPerformanceData)
  }, [selectedplayer])

  // Load sessions attended data for all players
  useEffect(() => {
    const loadSessionsAttended = async () => {
      if (!players.length || !user?.academyId) return;

      const sessionsData: {[key: string]: number} = {};

      for (const player of players) {
        try {
          const count = await calculateSessionsAttended(player.id, user.academyId);
          sessionsData[player.id] = count;
        } catch (error) {
          console.error(`Error loading sessions for player ${player.id}:`, error);
          sessionsData[player.id] = 0;
        }
      }

      setSessionsAttended(sessionsData);
    };

    loadSessionsAttended();
  }, [players, user?.academyId]);

  // Fetch dates for performance history entries
  useEffect(() => {
    const fetchEntryDates = async () => {
      if (!selectedPerson || !selectedPerson.performanceHistory.length) return;

      setEntryDates({}); // Clear previous dates

      const filteredHistory = selectedPerson.performanceHistory.filter(entry => entry.type !== 'drill');
      const datePromises = filteredHistory.map(async (entry, index) => {
        let date = entry.date;
        if (entry.type === 'session' && entry.sessionId) {
          const fetchedDate = await fetchSessionDate(entry.sessionId);
          if (fetchedDate) date = fetchedDate;
        } else if (entry.type === 'match' && entry.matchId) {
          const fetchedDate = await fetchMatchDate(entry.matchId);
          if (fetchedDate) date = fetchedDate;
        }
        return { index, date };
      });

      const results = await Promise.all(datePromises);
      const newDates: {[key: string]: string} = {};
      results.forEach(({ index, date }) => {
        newDates[index] = date;
      });
      setEntryDates(newDates);
    };

    fetchEntryDates();
  }, [selectedPerson]);

  const handlePersonClick = (person: any) => {
    if (person.academyId !== user?.academyId) {
      console.log("Player not in same academy")
      return
    }
    setSelectedPerson(person)
    setIsDialogOpen(true)
  }

  const radarData = (attributes: PlayerAttributes) => ({
    labels: ["Shooting", "Pace", "Positioning", "Passing", "Ball Control", "Crossing"],
    datasets: [
      {
        label: "Attributes",
        data: [
          attributes.shooting,
          attributes.pace,
          attributes.positioning,
          attributes.passing,
          attributes.ballControl,
          attributes.crossing,
        ],
        backgroundColor: "rgba(147, 51, 234, 0.2)",
        borderColor: "rgb(147, 51, 234)",
        borderWidth: 1,
        fill: true,
      },
    ],
  })

  // New function to get filtered attributes based on attributeFilter state
  const getFilteredAttributes = (player: Player): PlayerAttributes => {
    if (attributeFilter === "latest") {
      return player.attributes;
    } else if (attributeFilter === "overall") {
      const sessionsCount = sessionsAttended[player.id] || 0;
      console.log(`Player ${player.name}: sessionsCount = ${sessionsCount}, performanceHistory length = ${player.performanceHistory?.length || 0}`);
      const result = calculateAverageAttributes(player, sessionsCount);
      console.log(`Calculated average attributes for ${player.name}:`, result);
      return result;
    }
    return player.attributes;
  };

  const radarOptions = {
    scales: {
      r: {
        beginAtZero: true,
        max: 10, // Keep this at 10 since individual attributes are still 0-10
        min: 0,
        ticks: {
          stepSize: 1,
          display: false,
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        pointLabels: {
          color: "rgb(255, 255, 255)",
          font: {
            size: 12,
          },
        },
        angleLines: {
          color: "rgba(255, 255, 255, 0.1)",
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
    maintainAspectRatio: false,
  }

  const renderPerformanceHistory = (history: PerformanceEntry[]) => {
    // Filter to only show session and match entries, exclude drill training
    const filteredHistory = history.filter(entry => entry.type !== 'drill');
    return filteredHistory.map((entry, index) => (
      <div key={index} className="border-b border-gray-700 pb-4">
        <div className="flex justify-between mb-2">
          <p className="font-semibold">{new Date(entryDates[index] || entry.date).toLocaleDateString()}</p>
          <Badge>{entry.type}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* Show attributes if present */}
          {entry.attributes && Object.entries(entry.attributes).map(([key, value]) => (
            typeof value === 'number' && (
              <div key={key} className="space-y-1">
                <div className="flex justify-between">
                  <p className="text-sm text-gray-400 capitalize">{key}</p>
                  <span className="text-sm font-medium">{value}/10</span>
                </div>
                <Progress value={value * 10} className="h-2" />
              </div>
            )
          ))}
          {/* Show stats if present */}
          {entry.stats && Object.entries(entry.stats).map(([key, value]) => (
            typeof value === 'number' && (
              <div key={key} className="space-y-1">
                <div className="flex justify-between">
                  <p className="text-sm text-gray-400 capitalize">{key}</p>
                  <span className="text-sm font-medium">{value}</span>
                </div>
                <Progress value={value} className="h-2" />
              </div>
            )
          ))}
        </div>
      </div>
    ));
  };

  const PlayerDetailsDialog = () => {
    if (!selectedPerson) return null;

    const filteredAttributes = getFilteredAttributes(selectedPerson);
    const overallScore = calculateOverall(filteredAttributes);

    return (
      <Dialog open={!!selectedPerson} onOpenChange={() => setSelectedPerson(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>{selectedPerson.name}'s Performance Progress</DialogTitle>
              <div className="flex gap-2">
                <Button
                  variant={attributeFilter === "latest" ? "default" : "outline"}
                  onClick={() => setAttributeFilter("latest")}
                  size="sm"
                >
                  Latest
                </Button>
                <Button
                  variant={attributeFilter === "overall" ? "default" : "outline"}
                  onClick={() => setAttributeFilter("overall")}
                  size="sm"
                >
                  Overall
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {Object.entries(filteredAttributes || {}).map(([attr, value]) => (
              <div key={attr} className="text-center p-3 bg-secondary rounded-lg">
                <div className="text-lg font-bold">{value}</div>
                <div className="text-sm text-muted-foreground">
                  {attr.charAt(0).toUpperCase() + attr.slice(1)}
                </div>
              </div>
            ))}
          </div>

          {selectedPerson.performanceHistory.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Performance History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {renderPerformanceHistory(selectedPerson.performanceHistory)}
                </div>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  // Update the table rendering to show loading state
  const renderPlayersTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Overall</TableHead>
          <TableHead>Latest Performance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-4">
              Loading players...
            </TableCell>
          </TableRow>
        ) : players.length > 0 ? (
          players.map((player) => {
            const filteredAttributes = getFilteredAttributes(player);
            const overallScore = calculateOverall(filteredAttributes);
            return (
              <TableRow
                key={player.id}
                onClick={() => handlePersonClick(player)}
                className="cursor-pointer hover:bg-secondary/50"
              >
                <TableCell className="font-medium">{player.name}</TableCell>
                <TableCell>{player.position}</TableCell>
                <TableCell>
                  <Badge variant={overallScore >= 70 ? "success" : "secondary"}>
                    {overallScore}/100
                  </Badge>
                </TableCell>
                <TableCell>
                  {player.performanceHistory?.length > 0
                    ? new Date(player.performanceHistory[0].date).toLocaleDateString()
                    : "No data"
                  }
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
              No players found in your academy
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar /> {/* Add the Sidebar component here */}
      <div className="flex-1 flex flex-col space-y-6 overflow-auto p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Performance Report</h1>
          {loading && <p className="text-muted-foreground">Loading...</p>}
        </div>

        <div className="text-sm text-muted-foreground">
          Academy ID: {user?.academyId}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Players ({players.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {renderPlayersTable()}
          </CardContent>
        </Card>

        {selectedPerson && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-h-[80vh] max-w-3xl  overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedPerson.name}</DialogTitle>
              </DialogHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold">Position: {selectedPerson.position || "Coach"}</h2>
                      <p className="text-gray-400">Age: {selectedPerson.age || "N/A"}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge variant={selectedPerson.attributes?.overall >= 70 ? "success" : "secondary"}>
                        OVR {selectedPerson.attributes?.overall || "N/A"}/100
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Profile Photo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="aspect-square relative overflow-hidden rounded-lg w-64 h-64">
                          <img
                            src={selectedPerson.photoUrl || "/placeholder.svg"}
                            alt={selectedPerson.name}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Top Attributes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          {Object.entries(getFilteredAttributes(selectedPerson)).map(([key, value]) => (
                            <div key={key} className="text-center">
                              <div className="w-16 h-16 rounded-full border-4 border-emerald-400 flex items-center justify-center mx-auto">
                                <span className="text-2xl font-bold">{String(value)}</span>
                              </div>
                              <span className="text-sm mt-2 block">{key}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>Attributes Overview</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              variant={attributeFilter === "latest" ? "default" : "outline"}
                              onClick={() => setAttributeFilter("latest")}
                              size="sm"
                            >
                              Latest
                            </Button>
                            <Button
                              variant={attributeFilter === "overall" ? "default" : "outline"}
                              onClick={() => setAttributeFilter("overall")}
                              size="sm"
                            >
                              Overall
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[400px]">
                          <Radar data={radarData(getFilteredAttributes(selectedPerson))} options={radarOptions} />
                        </div>
                      </CardContent>
                    </Card>

                    {selectedPerson.performanceHistory && (
                      <Card className="md:col-span-2">
                        <CardHeader>
                          <CardTitle>Performance History</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {renderPerformanceHistory(selectedPerson.performanceHistory)}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {selectedPerson.sessionsAttended && (
                      <Card className="md:col-span-2">
                        <CardHeader>
                          <CardTitle>Sessions Attended</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Session Name</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Performance</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedPerson.sessionsAttended.map((session: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell>{session.name}</TableCell>
                                  <TableCell>{new Date(session.date).toLocaleDateString()}</TableCell>
                                  <TableCell>{session.performance}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {selectedPerson.coachReviews && (
                      <Card className="md:col-span-2">
                        <CardHeader>
                          <CardTitle>Coach Reviews</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {selectedPerson.coachReviews.map((review: any, index: number) => (
                              <div key={index} className="border-b border-gray-700 pb-4">
                                <p className="font-semibold">{review.coachName}</p>
                                <p className="text-sm text-gray-400">{review.comment}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </CardContent>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
