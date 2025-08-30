"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Radar } from "react-chartjs-2"
import { usePlayers } from "@/contexts/PlayerContext"
import { useAuth } from "@/contexts/AuthContext"
import { FileUp } from "lucide-react"
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from "chart.js"
import { setCache, getCache } from "@/app/cache"
import { Sidebar } from "@/components/Sidebar" // Import the Sidebar component
import { cn } from '@/lib/utils'
import { toast } from "@/components/ui/use-toast"
import { updateUserData } from "@/utils/userDataSync"
import Link from 'next/link'
import { useRouter } from "next/navigation" // Change this line
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PaymentsTab from "./tabs/PaymentsTab"
import GalleryTab from "./tabs/GalleryTab"
import dynamic from 'next/dynamic'

const AchievementsTab = dynamic(() => import('./tabs/AchievementsTab'), {
  loading: () => <p>Loading achievements...</p>
})
// Update the dynamic import for InjuryRehabTab
const InjuryRehabTab = dynamic(() => import('./tabs/InjuryRehabTab'), {
  loading: () => (
    <Card className="w-full h-[300px] flex items-center justify-center">
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading injury and rehab data...</p>
        </div>
      </CardContent>
    </Card>
  ),
  ssr: false
})
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

// Helper function to get base URL for API calls
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

// Update the calculateOverallRating function to handle NaN
const calculateOverallRating = (attributes: any): number => {
  if (!attributes) return 0;
  
  const ratings = [
    Number(attributes.shooting) || 0,
    Number(attributes.pace) || 0,
    Number(attributes.positioning) || 0,
    Number(attributes.passing) || 0,
    Number(attributes.ballControl) || 0,
    Number(attributes.crossing) || 0
  ];
  
  // Calculate average out of 10, then convert to percentage
  const sum = ratings.reduce((acc, val) => acc + val, 0);
  const average = sum / ratings.length;
  
  // Return 0 if NaN, otherwise calculate percentage
  return isNaN(average) ? 0 : Math.round((average / 10) * 100);
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

// Add this helper function at the top of the file
const calculateAveragePerformance = (performanceHistory: any[] = []): number => {
  if (!performanceHistory?.length) return 0;

  let validEntries = 0;
  let totalSum = 0;

  performanceHistory.forEach(entry => {
    let entryScore = 0;
    let validScores = 0;

    // Handle training sessions
    if (entry.attributes) {
      const attributes = Object.values(entry.attributes).filter(val => typeof val === 'number' && val > 0);
      if (attributes.length > 0) {
        const numAttributes = attributes as number[];
        entryScore += numAttributes.reduce((sum, val) => sum + val, 0) / numAttributes.length;
        validScores++;
      }
    }

    // Handle session rating (could be in different fields based on data structure)
    const sessionRating = Number(entry.sessionRating) || Number(entry.rating);
    if (sessionRating > 0) {
      entryScore += sessionRating;
      validScores++;
    }

    // Handle match points
    if (entry.type === 'match' && entry.stats?.matchPoints?.current) {
      const matchPoints = Number(entry.stats.matchPoints.current);
      if (matchPoints > 0) {
        entryScore += matchPoints;
        validScores++;
      }
    }

    // Only count entries that have at least one valid score
    if (validScores > 0) {
      totalSum += entryScore / validScores;
      validEntries++;
    }
  });

  // Return average, or 0 if no valid entries
  return validEntries > 0 ? Number((totalSum / validEntries).toFixed(1)) : 0;
};

const renderPlayerProfile = (player: any, filter: "latest" | "overall", sessionsAttended: number, setAttributeFilter: (filter: "latest" | "overall") => void) => {
  // Get attributes based on filter
  const attributes = filter === "overall" 
    ? calculateAverageAttributes(player, sessionsAttended)
    : player?.attributes || {};

  const radarData = {
    labels: ["Shooting", "Pace", "Positioning", "Passing", "Ball Control", "Crossing"],
    datasets: [
      {
        label: filter === "overall" ? "Overall Attributes" : "Latest Attributes",
        data: [
          attributes.shooting || 0,
          attributes.pace || 0,
          attributes.positioning || 0,
          attributes.passing || 0,
          attributes.ballControl || 0,
          attributes.crossing || 0,
        ],
        backgroundColor: filter === "overall" ? "rgba(59, 130, 246, 0.2)" : "rgba(147, 51, 234, 0.2)",
        borderColor: filter === "overall" ? "rgb(59, 130, 246)" : "rgb(147, 51, 234)",
        borderWidth: 1,
        fill: true,
      },
    ],
  }

  const radarOptions = {
    scales: {
      r: {
        beginAtZero: true,
        max: 10,
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

  // Calculate latest performance metrics
  const averagePerformance = calculateAveragePerformance(player.performanceHistory);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Player Attributes</span>
          <div className="flex gap-2">
            <Button
              variant={filter === "latest" ? "default" : "outline"}
              size="sm"
              onClick={() => setAttributeFilter("latest")}
            >
              LATEST
            </Button>
            <Button
              variant={filter === "overall" ? "default" : "outline"}
              size="sm"
              onClick={() => setAttributeFilter("overall")}
            >
              OVERALL
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column: Radar chart */}
          <div className="h-[300px]">
            <Radar data={radarData} options={radarOptions} />
          </div>
          
          {/* Right column: Attributes in single column */}
          <div className="space-y-4">
            {[
              { label: "Shooting", value: attributes.shooting || 0 },
              { label: "Pace", value: attributes.pace || 0 },
              { label: "Positioning", value: attributes.positioning || 0 },
              { label: "Passing", value: attributes.passing || 0 },
              { label: "Ball Control", value: attributes.ballControl || 0 },
              { label: "Crossing", value: attributes.crossing || 0 },
            ].map((attr) => (
              <div key={attr.label} className="space-y-2">
                <div className="flex justify-between">
                  <Label>{attr.label}</Label>
                  <span className="font-bold">{attr.value}/10</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(attr.value / 10) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Add this function after the other utility functions
const calculateAge = (dob: string): number => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Function to calculate average attributes for OVERALL filter
const calculateAverageAttributes = (player: any, sessionsAttended: number) => {
  if (!player?.performanceHistory?.length || sessionsAttended <= 0) {
    return player?.attributes || {};
  }

  const attributeKeys = ['shooting', 'pace', 'positioning', 'passing', 'ballControl', 'crossing'];
  const averageAttributes: any = {};

  console.log('Calculating average attributes for player:', player.name);
  console.log('Performance history entries:', player.performanceHistory.length);
  console.log('Sessions attended:', sessionsAttended);

  attributeKeys.forEach(key => {
    // Sum all attribute scores from performance history
    let totalScore = 0;
    let validEntries = 0;

    player.performanceHistory.forEach((entry: any, index: number) => {
      if (entry.attributes && typeof entry.attributes[key] === 'number' && entry.attributes[key] > 0) {
        console.log(`Entry ${index} - ${key}:`, entry.attributes[key]);
        totalScore += entry.attributes[key];
        validEntries++;
      }
    });

    // Add latest attribute score to the total
    const latestScore = player.attributes?.[key] || 0;
    console.log(`Latest ${key}:`, latestScore);
    if (latestScore > 0) {
      totalScore += latestScore;
      validEntries++;
    }

    // Calculate average: (total attribute score + latest attribute score) / total sessions
    const average = validEntries > 0 ? totalScore / validEntries : 0;
    averageAttributes[key] = Math.round(average * 10) / 10; // Round to 1 decimal place
    
    console.log(`Average ${key}:`, averageAttributes[key], `(total: ${totalScore}, entries: ${validEntries})`);
  });

  console.log('Final average attributes:', averageAttributes);
  return averageAttributes;
};

export default function playerProfile() {
  const { players, getPlayerByUserId, updatePlayerAttributes } = usePlayers()
  const { user } = useAuth()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [playerData, setPlayerData] = useState<any>(null)
  const [sessionsAttended, setSessionsAttended] = useState<number>(0) // Add this state
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("profile")
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [editedData, setEditedData] = useState<any>({
    name: "",
    age: 0,
    position: "",
    playingStyle: "",
    photoUrl: "",
  })
  const [attributeFilter, setAttributeFilter] = useState<"latest" | "overall">("latest")

  // Move the keyboard navigation useEffect here, before any conditional returns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tabs = ["profile", "payments", "gallery", "injury-rehab", "achievements"];
      const currentIndex = tabs.indexOf(activeTab);

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        setActiveTab(tabs[nextIndex]);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        setActiveTab(tabs[prevIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab]);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        // Wait for auth state to be ready
        if (!user && mounted) {
          setIsAuthLoading(true);
          // Wait a bit for auth context to initialize
          await new Promise(resolve => setTimeout(resolve, 1000));
          return;
        }

        setIsAuthLoading(false);

        if (!user) {
          setError('Please log in to view your profile');
          return;
        }

        // Rest of the profile loading logic
        if (user.role !== "player" as typeof user.role) {
          setError('Access denied. Only players can view this page.');
          router.push(`/dashboard/${user.role}/about`);
          return;
        }

        console.log('Loading profile for:', user.username);
        
        const response = await fetch(`/api/db/ams-player-data/user/${encodeURIComponent(user.username)}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load profile');
        }

        const data = await response.json();
        console.log('Received player data:', data);

        if (!data) {
          throw new Error('No player data returned');
        }

        // Set player data with defaults
        const calculatedAge = calculateAge(data.dob || "");
        setPlayerData({
          ...data,
          attributes: {
            shooting: 0,
            pace: 0,
            positioning: 0,
            passing: 0,
            ballControl: 0,
            crossing: 0,
            overall: 0,
            averagePerformance: 0,
            stamina: 0,
            ...(data.attributes || {})
          },
          position: data.position || "",
          playingStyle: data.playingStyle || "",
          photoUrl: data.photoUrl || "",
          performanceHistory: data.performanceHistory || [],
          age: calculatedAge // Add this line to save calculated age
        });

        // Set edited data
        setEditedData({
          age: data.age || 0,
          playingStyle: data.playingStyle || "",
          photoUrl: data.photoUrl || "",
        });

      } catch (error) {
        console.error('Profile loading error:', error);
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to load profile data');
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [user, router]);

  // Add this useEffect to fetch sessions attended count
  useEffect(() => {
    const fetchSessionsAttended = async () => {
      if (playerData?.id && user?.academyId) {
        console.log('Fetching sessions for player:', playerData.id, 'academy:', user.academyId);
        try {
          const count = await calculateSessionsAttended(playerData.id, user.academyId);
          console.log('Sessions attended count:', count);
          setSessionsAttended(count);
        } catch (error) {
          console.error('Error fetching sessions attended:', error);
          setSessionsAttended(sessionsAttended);
        }
      }
    };

    if (playerData?.id && user?.academyId) {
      fetchSessionsAttended();
    }
  }, [playerData?.id, user?.academyId]);

  // Add this useEffect to fetch sessions attended count
  useEffect(() => {
    const fetchSessionsAttended = async () => {
      if (playerData?.id && user?.academyId) {
        const count = await calculateSessionsAttended(playerData.id, user.academyId);
        setSessionsAttended(count);
      }
    };

    fetchSessionsAttended();
  }, [playerData?.id, user?.academyId]);

  // Update the error display to handle auth loading state
  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-white">Loading authentication...</div>
      </div>
    );
  }

  // Show error with custom message for non-player users
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-2">Access Error</h2>
          <p className="text-white">{error}</p>
          {user && user.role !== ('player' as typeof user.role) && (
            <Link href={`/dashboard/${user.role}/about`} className="mt-4 text-blue-400 hover:text-blue-300">
              Go to {user.role} dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const handleInputChange = (field: string, value: string | number) => {
    setEditedData((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setEditedData((prev: any) => ({
          ...prev,
          photoUrl: reader.result as string,
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    try {
      if (!playerData?.id) {
        throw new Error('Player ID not found');
      }

      const calculatedAge = calculateAge(playerData.dob || "");
      const updates = {
        ...playerData,
        ...editedData,
        age: calculatedAge, // Add this line to save calculated age
        updatedAt: new Date().toISOString()
      };

      const response = await fetch(`/api/db/ams-player-data/${playerData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      const { data: updatedPlayer } = await response.json();

      // Update local state with the latest data from server
      setPlayerData({
        ...updatedPlayer
      });

      // Reset editedData to match updated player data
      setEditedData({
        name: updatedPlayer.name || "",
        age: updatedPlayer.age || 0,
        playingStyle: updatedPlayer.playingStyle || "",
        photoUrl: updatedPlayer.photoUrl || "",
      });

      // Ensure edit mode is exited
      setIsEditing(false);

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-auto w-full">
        <div className="flex-1 w-full p-2 md:p-4">
          <div className="flex flex-col gap-6 h-full">
            <div className="flex justify-between items-start w-full">
              <div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={editedData.name} onChange={(e) => handleInputChange("name", e.target.value)} />
                  </div>
                ) : (
                  <h1 className="text-3xl font-bold text-white">{playerData.name}</h1>
                )}
                {isEditing ? (
                  <div className="space-y-2 mt-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      value={editedData.age}
                      onChange={(e) => handleInputChange("age", Number.parseInt(e.target.value))}
                    />
                  </div>
                ) : (
                  <p className="text-gray-400">
                    Age: {playerData.age} | {playerData.position}
                  </p>
                )}
                <div className="mt-4">
                  <h2 className="text-lg font-semibold mb-2">Playing Style</h2>
                  <p className="text-gray-300">{playerData.playingStyle}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-4">
                <div className="w-32 h-32 relative overflow-hidden rounded-lg">
                  {isEditing ? (
                    <label className="cursor-pointer w-full h-full">
                      <div className="relative w-full h-full">
                        {/* Show current/uploaded photo in edit mode */}
                        <img
                          src={editedData.photoUrl || playerData.photoUrl || "/placeholder.svg"}
                          alt="Profile"
                          className="object-cover w-full h-full"
                        />
                        {/* Overlay with upload icon */}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors">
                          <div className="text-center">
                            <FileUp className="mx-auto h-6 w-6 text-white" />
                            <span className="mt-1 block text-xs font-medium text-white">Change photo</span>
                          </div>
                        </div>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                    </label>
                  ) : (
                    <img
                      src={playerData.photoUrl || "/placeholder.svg"}
                      alt={playerData.name}
                      className="object-cover w-full h-full"
                    />
                  )}
                </div>
                <p className="text-xl text-gray-400">ID: {playerData.id}</p>
                <div className="flex items-center gap-4">
                  <Badge variant={calculateOverallRating(playerData?.attributes) >= 80 ? "default" : "secondary"}>
                    OVR {calculateOverallRating(playerData?.attributes)}%
                  </Badge>
                  {isEditing ? (
                    <div className="space-x-2">
                      <Button 
                        variant="secondary" 
                        onClick={() => {
                          setIsEditing(false);
                          setEditedData({
                            name: playerData.name || "",
                            age: playerData.age || 0,
                            playingStyle: playerData.playingStyle || "",
                            photoUrl: playerData.photoUrl || "",
                          });
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSave}>
                        Save Changes
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      asChild
                    >
                      <Link href="/dashboard/player/settings">
                        Edit Profile
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="gallery">Gallery</TabsTrigger>
                <TabsTrigger value="injury-rehab">Injury and Rehab</TabsTrigger>
                <TabsTrigger value="achievements">Achievements</TabsTrigger>
              </TabsList>

              <div className="mt-4 h-full">
                <TabsContent value="profile" className="h-full m-0 p-0">
                  <div className="grid gap-6 h-full">
                    {renderPlayerProfile(playerData, attributeFilter, sessionsAttended, setAttributeFilter)}
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle>Training Performance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-around items-center">
                          <div className="text-center">
                            <div className="text-3xl font-bold">
                              {calculateAveragePerformance(playerData?.performanceHistory)}/10
                            </div>
                            <div className="text-sm text-gray-400">AVERAGE PERFORMANCE</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xl font-bold">
                              {sessionsAttended}
                            </div>
                            <div className="text-sm text-gray-400">SESSIONS ATTENDED</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="payments" className="m-0 p-0">
                  <PaymentsTab />
                </TabsContent>

                <TabsContent value="gallery" className="m-0 p-0">
                  <GalleryTab />
                </TabsContent>

                <TabsContent value="injury-rehab" className="m-0 p-0">
                  {playerData ? (
                    <InjuryRehabTab playerData={playerData} />
                  ) : (
                    <Card className="w-full h-[300px] flex items-center justify-center">
                      <CardContent>
                        <div className="flex flex-col items-center gap-4">
                          <p className="text-muted-foreground">No player data available</p>
                          <Button 
                            variant="outline" 
                            onClick={() => window.location.reload()}
                          >
                            Retry Loading
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="achievements" className="m-0 p-0">
                  <AchievementsTab />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}