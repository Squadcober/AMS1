"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sidebar } from "@/components/Sidebar"
import { Line, Bar, Radar } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
import PerformanceChart from "./components/PerformanceChart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react"

// Helper function to get base URL for API calls
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
)

const calculateOverallRating = (attributes: any): number => {
  if (!attributes) return 0;
  
  const ratings = [
    Number(attributes.Attack) || 0,
    Number(attributes.pace) || 0,
    Number(attributes.Physicality) || 0,
    Number(attributes.Defense) || 0,
    Number(attributes.passing) || 0,
    Number(attributes.Technique) || 0
  ];
  
  const sum = ratings.reduce((acc, val) => acc + val, 0);
  const average = sum / ratings.length;
  
  return isNaN(average) ? 0 : Number(average.toFixed(1));
};

// Add this helper function to safely get match points
const getMatchPoints = (matchEntry: any): number => {
  if (!matchEntry?.stats?.matchPoints) return 0;
  const points = matchEntry.stats.matchPoints;
  
  // Handle the nested 'current' structure
  if (typeof points === 'object') {
    if (points.current) {
      // Navigate through nested current objects if they exist
      let currentValue = points.current;
      while (typeof currentValue === 'object' && currentValue.current) {
        currentValue = currentValue.current;
      }
      return Number(currentValue) || 0;
    }
    return Number(points.edited) || 0;
  }
  
  return Number(points) || 0;
};

// Function to calculate average attributes for OVERALL filter
const calculateAverageAttributes = (player: any, sessionsAttended: number) => {
  if (!player?.performanceHistory?.length || sessionsAttended <= 0) {
    return player?.attributes || {};
  }

  const attributeKeys = ['Attack', 'pace', 'Physicality', 'Defense', 'passing', 'Technique'];
  const averageAttributes: any = {};

  attributeKeys.forEach(key => {
    // Sum all attribute scores from performance history
    let totalScore = 0;
    let validEntries = 0;

    player.performanceHistory.forEach((entry: any) => {
      if (entry.attributes && typeof entry.attributes[key] === 'number' && entry.attributes[key] > 0) {
        totalScore += entry.attributes[key];
        validEntries++;
      }
    });

    // Add latest attribute score to the total
    const latestScore = player.attributes?.[key] || 0;
    if (latestScore > 0) {
      totalScore += latestScore;
      validEntries++;
    }

    // Calculate average: (total attribute score + latest attribute score) / total sessions
    const average = validEntries > 0 ? totalScore / validEntries : 0;
    averageAttributes[key] = Math.round(average * 10) / 10; // Round to 1 decimal place
  });

  return averageAttributes;
};

// Fixed function to calculate sessions attended from API
const calculateSessionsAttended = async (playerId: string, academyId: string): Promise<number> => {
  try {
    console.log('Calculating sessions for player:', playerId, 'academy:', academyId);
    const response = await fetch(`${getBaseUrl()}/api/db/ams-sessions?academyId=${academyId}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      console.error('Failed to fetch sessions:', response.status);
      return 0;
    }

    const result = await response.json();
    console.log('Sessions API result:', result);
    
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
      
      console.log(`Session ${session.name}: assigned=${isAssigned}, status=${attendanceStatus}`);
      
      // Case-insensitive check for "present" status
      return isAssigned && attendanceStatus?.toLowerCase() === 'present';
    });

    console.log('Total attended sessions:', attendedSessions.length);
    return attendedSessions.length;
  } catch (error) {
    console.error('Error calculating sessions attended:', error);
    return 0;
  }
};

// Update getLastNDays function
const getLastNDays = (n: number, timeOffset: number, timeRange: string) => {
  const result = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const offsetDays = timeOffset * (
    timeRange === 'daily' ? 10 :
    timeRange === 'weekly' ? 70 :
    timeRange === 'monthly' ? 300 :
    timeRange === 'yearly' ? 3650 : 10
  );

  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(now);
    // Subtract days to go back in time
    date.setDate(date.getDate() - i - offsetDays);
    // Don't add future dates
    if (date <= now) {
      result.push(date);
    }
  }
  return result;
};

export default function Performance() {
  const { user } = useAuth()
  const [playerData, setPlayerData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [timeOffset, setTimeOffset] = useState(0)
  const [sessionsAttended, setSessionsAttended] = useState<number>(0)
  const [attributeFilter, setAttributeFilter] = useState<"latest" | "overall">("latest")
  type ChartDataType = {
    training: { labels: string[]; data: number[] };
    match: { labels: string[]; data: number[] };
    attributes: { labels: string[]; data: number[] };
  };

  const [chartData, setChartData] = useState<ChartDataType>({
    training: { labels: [], data: [] },
    match: { labels: [], data: [] },
    attributes: { labels: [], data: [] }
  })
  const [attributeHistory, setAttributeHistory] = useState<any[]>([])
  const [timeRange, setTimeRange] = useState('weekly')

  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        setLoading(true);

        if (!user?.username) {
          console.error("Missing username:", user?.username);
          throw new Error("Username is required");
        }

        console.log('Loading performance data for username:', user.username);

        // Use the same approach as settings page - direct API call without base URL helper
        const response = await fetch(
          `/api/db/ams-player-data/user/${encodeURIComponent(user.username)}`,
          { 
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );

        console.log('Player response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Player fetch failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`Failed to fetch player data: ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw player data:", data);
        
        if (!data) {
          throw new Error('No player data returned');
        }

        // Calculate overall rating from attributes
        const attributes = data.attributes || {};
        const overallRating = calculateOverallRating(attributes);

        // Process performance history
        const performanceHistory = data.performanceHistory || [];
        
        // Training performance calculation
        const trainingEntries = performanceHistory.filter((p: any) => 
          p.type === 'training' && p.attributes && Object.keys(p.attributes).length > 0
        );

        const trainingPerformance = trainingEntries.length > 0
          ? trainingEntries.reduce((acc: number, curr: any) => {
              const attrValues = Object.values(curr.attributes).filter((v: any) => typeof v === 'number' && v > 0);
              return acc + ((attrValues as number[]).reduce((sum, val) => sum + val, 0) / attrValues.length);
            }, 0) / trainingEntries.length
          : 0;

        // Match performance calculation - only count matches with valid points
        const matchEntries = performanceHistory.filter((p: any) => 
          p.type === 'match' && p.stats?.matchPoints
        );

        const validMatchPoints = matchEntries
          .map((entry: any) => getMatchPoints(entry))
          .filter((points: number) => points > 0);

        const matchPerformance = validMatchPoints.length > 0
          ? validMatchPoints.reduce((sum: number, points: number) => sum + points, 0) / validMatchPoints.length
          : 0;

        // Calculate match stats
        const matchStats = performanceHistory
          .filter((p: any) => p.type === 'match' && p.stats)
          .reduce((acc: any, curr: any) => ({
            goals: acc.goals + (Number(curr.stats?.goals) || 0),
            assists: acc.assists + (Number(curr.stats?.assists) || 0),
            cleanSheets: acc.cleanSheets + (Number(curr.stats?.cleanSheets) || 0)
          }), { goals: 0, assists: 0, cleanSheets: 0 });

        // Process performance history for charts
        const trainingData = performanceHistory
          .filter((p: any) => p.type === 'training' || !p.type)
          .map((entry: any) => ({
            date: new Date(entry.date).toLocaleDateString(),
            rating: entry.sessionRating || entry.rating || 0,
            attributes: entry.attributes || {}
          }))
          .filter((entry: any) => entry.rating > 0);

        const matchData = performanceHistory
          .filter((p: any) => p.type === 'match')
          .map((entry: any) => ({
            date: new Date(entry.date).toLocaleDateString(),
            points: getMatchPoints(entry)
          }))
          .filter((entry: any) => entry.points > 0); // Only include entries with valid points

        setChartData({
          training: {
            labels: trainingData.map((d: any) => d.date),
            data: trainingData.map((d: any) => d.rating)
          },
          match: {
            labels: matchData.map((d: { date: string; points: number }) => d.date),
            data: matchData.map((d: { date: string; points: number }) => d.points)
          },
          attributes: {
            labels: ["Attack", "Pace", "Physicality", "Defense", "passing", "Technique"],
            data: [
              data.attributes?.Attack || 0,
              data.attributes?.pace || 0,
              data.attributes?.Physicality || 0,
              data.attributes?.Defense || 0,
              data.attributes?.passing || 0,
              data.attributes?.Technique || 0
            ]
          }
        });

        // Process attribute history for the growth chart - use actual historical data
        console.log('Processing performanceHistory for attributes:', performanceHistory);
        
        const processedHistory = performanceHistory
          .filter((entry: any) => {
            // Only include entries that have attributes and are training type (which have attribute changes)
            const hasAttributes = entry.attributes && Object.keys(entry.attributes).length > 0;
            console.log('Entry:', entry.date, 'hasAttributes:', hasAttributes, 'attributes:', entry.attributes);
            return hasAttributes;
          })
          .map((entry: any) => {
            const processedEntry = {
              date: new Date(entry.date).toLocaleDateString(),
              Attack: Number(entry.attributes?.Attack) || null,
              pace: Number(entry.attributes?.pace) || null,
              Physicality: Number(entry.attributes?.Physicality) || null,
              Defense: Number(entry.attributes?.Defense) || null,
              passing: Number(entry.attributes?.passing) || null,
              Technique: Number(entry.attributes?.Technique) || null,
            };
            console.log('Processed entry:', processedEntry);
            return processedEntry;
          })
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort by date
          .filter((entry: any) => {
            // Only include entries where at least one attribute has a valid number
            const hasValidData = Object.values(entry).some(val => 
              val !== null && val !== undefined && typeof val === 'number' && val > 0
            );
            console.log('Entry has valid data:', hasValidData, entry);
            return hasValidData;
          });

        console.log('Final processedHistory:', processedHistory);
        setAttributeHistory(processedHistory);

        setPlayerData({
          id: data.id,
          name: data.name,
          age: data.age,
          attributes: data.attributes || {},
          performanceHistory: data.performanceHistory || [],
          calculatedMetrics: {
            overallRating: Number(overallRating.toFixed(1))*10, // This is already out of 10
            trainingPerformance: Number(trainingPerformance.toFixed(1)),
            matchPerformance: Number(matchPerformance.toFixed(1)),
            matchStats
          }
        });
        // Calculate sessions attended for the player
        const academyId = data.academyId || ""; // Adjust if academyId is stored elsewhere
        if (data.id && academyId) {
          const sessionsCount = await calculateSessionsAttended(data.id, academyId);
          setSessionsAttended(sessionsCount);
        }

      } catch (error) {
        console.error('Error fetching player data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load player data');
      } finally {
        setLoading(false);
      }
    };

    if (user?.username) {
      fetchPlayerData();
    }
  }, [user?.username]);
  
  // Update chartData.attributes.data when attributeFilter or sessionsAttended changes
  useEffect(() => {
    if (!playerData) return;
    
    // Get the latest attributes from the player data structure
    const latestAttributes = playerData.attributes || {};
    let attributesToUse = latestAttributes;
    
    if (attributeFilter === "overall") {
      attributesToUse = calculateAverageAttributes(playerData, sessionsAttended);
    }
    
    setChartData(prev => ({
      ...prev,
      attributes: {
        labels: ["Attack", "Pace", "Physicality", "Defense", "passing", "Technique"],
        data: [
          attributesToUse.Attack || 0,
          attributesToUse.pace || 0,
          attributesToUse.Physicality || 0,
          attributesToUse.Defense || 0,
          attributesToUse.passing || 0,
          attributesToUse.Technique || 0
        ]
      }
    }));
  }, [attributeFilter, sessionsAttended, playerData]);

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
        grid: { color: "rgba(255, 255, 255, 0.1)" },
        ticks: { color: "rgb(255, 255, 255)" }
      },
      x: {
        grid: { color: "rgba(255, 255, 255, 0.1)" },
        ticks: { color: "rgb(255, 255, 255)" }
      }
    },
    plugins: {
      legend: { display: false }
    }
  };

  const radarOptions = {
    scales: {
      r: {
        beginAtZero: true,
        max: 10,
        ticks: {
          display: false, // Hide numerical values
          backdropColor: 'transparent', // Remove background
        },
        grid: {
          color: "rgba(255, 255, 255, 0.05)", // More subtle grid
          circular: true,
        },
        pointLabels: {
          color: "rgb(255, 255, 255)",
          font: {
            size: 14,
            weight: "bold" as "bold"
          },
          padding: 25, // More spacing around labels
        },
        angleLines: {
          color: "rgba(255, 255, 255, 0.05)", // More subtle lines
        },
      }
    },
    plugins: {
      legend: {
        display: false,
      }
    },
    maintainAspectRatio: false,
  };

  // Add chart configuration
  const attributeColors = {
    Attack: "#ef4444",     // Red
    pace: "#3b82f6",        // Blue
    Physicality: "#10b981",  // Green
    Defense: "#f59e0b",     // Yellow
    passing: "#8b5cf6",  // Purple
    Technique: "#ec4899"      // Pink
  };

  // Replace the existing filterDataByTimeRange function
  const filterDataByTimeRange = (data: any[], range: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Sort data by date
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Track first appearance dates for each attribute
    const firstAppearance: {
      Attack: Date | null;
      pace: Date | null;
      Physicality: Date | null;
      Defense: Date | null;
      passing: Date | null;
      Technique: Date | null;
    } = {
      Attack: null,
      pace: null,
      Physicality: null,
      Defense: null,
      passing: null,
      Technique: null
    };

    // Track last known values for each attribute
    let lastKnownValues = {
      Attack: null,
      pace: null,
      Physicality: null,
      Defense: null,
      passing: null,
      Technique: null
    };

    // Find first appearance dates and update last known values
    sortedData.forEach(entry => {
      Object.keys(lastKnownValues).forEach(attr => {
        if (entry[attr] !== null && entry[attr] !== undefined) {
          if (firstAppearance[attr as keyof typeof firstAppearance] === null) {
            firstAppearance[attr as keyof typeof firstAppearance] = new Date(entry.date);
          }
          lastKnownValues[attr as keyof typeof lastKnownValues] = entry[attr];
        }
      });
    });

    // Helper function to create entry with appropriate values
    const createEntryWithValues = (date: Date) => {
      const entry: any = { date: date.toLocaleDateString() };
      
      Object.keys(lastKnownValues).forEach(attr => {
        const firstDate = firstAppearance[attr as keyof typeof firstAppearance];
        if (firstDate === null || date < firstDate) {
          entry[attr] = 0; // Before first appearance, value is 0
        } else {
          entry[attr] = lastKnownValues[attr as keyof typeof lastKnownValues];
        }
      });
      
      return entry;
    };

    switch(range) {
      case 'daily':
        const last10Days = getLastNDays(10, timeOffset, timeRange);
        return last10Days.map(date => {
          const entry = sortedData.find(d => 
            new Date(d.date).toDateString() === date.toDateString()
          );
          
          if (entry) {
            Object.keys(lastKnownValues).forEach(attr => {
              if (entry[attr] !== null && entry[attr] !== undefined) {
                lastKnownValues[attr as keyof typeof lastKnownValues] = entry[attr];
              }
            });
          }
          
          return createEntryWithValues(date);
        });

      case 'weekly':
        const last10Weeks = getLastNDays(70, timeOffset, timeRange).filter(d => d.getDay() === now.getDay()).slice(0, 10);
        return last10Weeks.map(weekDate => {
          const weekEnd = new Date(weekDate);
          const weekStart = new Date(weekDate);
          weekStart.setDate(weekStart.getDate() - 7);
          
          const weekData = sortedData.filter(d => {
            const date = new Date(d.date);
            return date >= weekStart && date <= weekEnd;
          });

          if (weekData.length > 0) {
            const lastEntry = weekData[weekData.length - 1];
            Object.keys(lastKnownValues).forEach(attr => {
              if (lastEntry[attr] !== null && lastEntry[attr] !== undefined) {
                lastKnownValues[attr as keyof typeof lastKnownValues] = lastEntry[attr];
              }
            });
          }

          return createEntryWithValues(weekDate);
        });

      case 'monthly':
        const last10Months = Array.from({length: 10}, (_, i) => {
          const date = new Date(now);
          date.setMonth(date.getMonth() - i);
          return date;
        }).reverse();

        return last10Months.map(monthDate => {
          const monthEnd = new Date(monthDate);
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          
          const monthData = sortedData.filter(d => {
            const date = new Date(d.date);
            return date >= monthStart && date <= monthEnd;
          });

          if (monthData.length > 0) {
            const lastEntry = monthData[monthData.length - 1];
            Object.keys(lastKnownValues).forEach(attr => {
              if (lastEntry[attr] !== null && lastEntry[attr] !== undefined) {
                lastKnownValues[attr as keyof typeof lastKnownValues] = lastEntry[attr];
              }
            });
          }

          return createEntryWithValues(monthDate);
        });

      case 'yearly':
        const last10Years = Array.from({length: 10}, (_, i) => {
          const date = new Date(now);
          date.setFullYear(date.getFullYear() - i);
          return date;
        }).reverse();

        return last10Years.map(yearDate => {
          const yearEnd = new Date(yearDate);
          const yearStart = new Date(yearDate.getFullYear(), 0, 1);
          
          const yearData = sortedData.filter(d => {
            const date = new Date(d.date);
            return date >= yearStart && date <= yearEnd;
          });

          if (yearData.length > 0) {
            const lastEntry = yearData[yearData.length - 1];
            Object.keys(lastKnownValues).forEach(attr => {
              if (lastEntry[attr] !== null && lastEntry[attr] !== undefined) {
                lastKnownValues[attr as keyof typeof lastKnownValues] = lastEntry[attr];
              }
            });
          }

          return createEntryWithValues(yearDate);
        });

      default:
        return data;
    }
  }

  // Update navigateTime function
  const navigateTime = (direction: 'forward' | 'backward') => {
    if (direction === 'forward' && timeOffset > 0) {
      // Moving forward in time (reducing offset)
      setTimeOffset(prev => prev - 1);
    } else if (direction === 'backward') {
      // Moving backward in time (increasing offset)
      setTimeOffset(prev => prev + 1);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2">Loading performance data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500">Error: {error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p>No player data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-auto">
        <div className="space-y-6">
          {/* Player Info Section */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{playerData.name}</h1>
              <p className="text-muted-foreground">
                Age: {playerData.age || 'N/A'}
                <br />
                ID: {playerData.id}
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>OVR</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {playerData.calculatedMetrics.overallRating}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Training Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {playerData.calculatedMetrics.trainingPerformance}/10
                </div>
                <p className="text-muted-foreground">TRAINING</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Match Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {playerData.calculatedMetrics.matchPerformance}/10
                </div>
                <p className="text-muted-foreground">MATCH</p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Growth Chart with Time Range Selector */}
          <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Attributes Growth</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateTime('backward')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTimeOffset(0)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateTime('forward')}
                disabled={timeOffset <= 0}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Select value={timeRange} onValueChange={(value) => {
                setTimeRange(value);
                setTimeOffset(0); // Reset offset when changing time range
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
            <CardContent className="pt-6">
              <PerformanceChart
                data={filterDataByTimeRange(attributeHistory, timeRange)}
                attributes={["Attack", "pace", "Physicality", "Defense", "passing", "Technique"]}
                colors={Object.values(attributeColors)}
              />
            </CardContent>
          </Card>

          {/* Performance Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Training Performance Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <Line
                  data={{
                    labels: chartData.training.labels,
                    datasets: [{
                      data: chartData.training.data,
                      borderColor: "rgb(147, 51, 234)",
                      tension: 0.1
                    }]
                  }}
                  options={lineOptions}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Match Performance Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <Line
                  data={{
                    labels: chartData.match.labels,
                    datasets: [{
                      data: chartData.match.data,
                      borderColor: "rgb(52, 211, 153)",
                      tension: 0.1
                    }]
                  }}
                  options={lineOptions}
                />
              </CardContent>
            </Card>
          </div>

          {/* Attributes Radar Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Player Attributes Overview</CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant={attributeFilter === "latest" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAttributeFilter("latest")}
                >
                  Latest
                </Button>
                <Button
                  variant={attributeFilter === "overall" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAttributeFilter("overall")}
                >
                  Overall
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex justify-center items-center">
              <div className="w-full max-w-[500px] h-[500px]">
                <Radar
                  data={{
                    labels: chartData.attributes.labels,
                    datasets: [{
                      data: chartData.attributes.data,
                      backgroundColor: "rgba(99, 102, 241, 0.2)", // Indigo
                      borderColor: "rgba(99, 102, 241, 0.8)",
                      borderWidth: 2,
                      fill: true,
                      pointBackgroundColor: "rgb(99, 102, 241)",
                      pointBorderColor: "#fff",
                      pointHoverBackgroundColor: "#fff",
                      pointHoverBorderColor: "rgb(99, 102, 241)",
                      pointRadius: 4,
                    }]
                  }}
                  options={radarOptions}
                />
              </div>
            </CardContent>
          </Card>

          {/* Match Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Total Match Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">
                    {playerData.calculatedMetrics.matchStats.goals}
                  </div>
                  <p className="text-muted-foreground">Goals</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {playerData.calculatedMetrics.matchStats.assists}
                  </div>
                  <p className="text-muted-foreground">Assists</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {playerData.calculatedMetrics.matchStats.cleanSheets}
                  </div>
                  <p className="text-muted-foreground">Clean Sheets</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}