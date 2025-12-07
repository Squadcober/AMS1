"use client"

import { useState, useEffect } from "react"
import Sidebar from "@/components/Sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Star } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export default function playerBatches() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [assignedPlayers, setAssignedPlayers] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [batchPlayers, setBatchPlayers] = useState<any[]>([]);
  const [coachData, setCoachData] = useState<{[key: string]: any}>({});
  const [selectedCoach, setSelectedCoach] = useState<any>(null);
  const [ratings, setRatings] = useState<{[key: string]: number}>({});
  const [showCoachProfile, setShowCoachProfile] = useState(false);
  const [playersInfo, setplayersInfo] = useState<{[key: string]: any}>({});
  const [batchCoachDetails, setBatchCoachDetails] = useState<{ [coachId: string]: any }>({});
  const [allBatchCoachDetails, setAllBatchCoachDetails] = useState<{ [batchId: string]: { [coachId: string]: any } }>({});
  const [coachProfileCache, setCoachProfileCache] = useState<{ [coachId: string]: any }>({});
  const [coachCache, setCoachCache] = useState<{ [key: string]: any }>({});
  const [playerCache, setPlayerCache] = useState<{ [key: string]: any }>({});
  const [isFetchingCoaches, setIsFetchingCoaches] = useState<{ [key: string]: boolean }>({});
  const [isFetchingPlayers, setIsFetchingPlayers] = useState<{ [key: string]: boolean }>({});
  const [pendingFetches, setPendingFetches] = useState<{ [key: string]: AbortController }>({});

  // Add this helper function to manage player data cache
  const fetchMissingPlayerData = async (playerIds: string[]) => {
    // Filter out IDs that are already in the cache
    const missingIds = playerIds.filter(id => !playerCache[id]);
    
    if (missingIds.length === 0) return;

    try {
      const response = await fetch(`/api/db/ams-player-data/batch?ids=${missingIds.join(',')}`);
      if (!response.ok) return;
      
      const data = await response.json();
      const newPlayerCache: { [key: string]: any } = {};
      
      data.data.forEach((player: any) => {
        const playerId = player.id || player._id;
        if (playerId) {
          newPlayerCache[playerId] = {
            name: player.name || "Unknown Player",
            photoUrl: player.photoUrl || "/placeholder.svg",
            position: player.position || "No position"
          };
        }
      });
      
      setPlayerCache(prev => ({ ...prev, ...newPlayerCache }));
      setPlayers(prev => [...prev, ...data.data]);
    } catch (error) {
      console.error('Error fetching missing player data:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.academyId || !user?.id) return;

        // First get the player data to get the correct player ID from ams-player-data collection
        // Filter by both academyId and userId to get the specific player for this user
        const playerResponse = await fetch(`/api/db/ams-player-data?academyId=${user.academyId}`);
        const playerData = await playerResponse.json();
        
        // Find the specific player that matches the current user's ID
        const playerObj = playerData.data?.find((player: any) => player.userId === user.id);
        if (!playerObj) {
          console.error('Player not found in ams-player-data for user ID:', user.id);
          return;
        }

        // Get the player ID - use the 'id' field which starts with "player_"
        const playerId = playerObj.id; // This is the field that starts with "player_"
        if (!playerId || !playerId.startsWith('player_')) {
          console.error('No valid player ID found in ams-player-data or ID does not start with "player_"');
          return;
        }

        console.log('Current user ID:', user.id);
        console.log('Found matching player ID:', playerId);
        setCurrentPlayer(playerObj);

        // Fetch ALL batches from ams-batches collection
        const batchesResponse = await fetch(`/api/db/ams-batches?academyId=${user.academyId}`);
        if (!batchesResponse.ok) throw new Error('Failed to fetch batches');
        const batchesData = await batchesResponse.json();

        // CRITICAL FILTER: Only show batches that contain the current player's ID in the players array
        const allBatches = Array.isArray(batchesData.data) ? batchesData.data : [];
        console.log('All batches found:', allBatches.length);
        
        const playerBatches = allBatches.filter((batch: any) => {
          const hasPlayer = Array.isArray(batch.players) && batch.players.includes(playerId);
          if (hasPlayer) {
            console.log(`Batch "${batch.name}" contains player ${playerId}`);
          }
          return hasPlayer;
        });

        console.log('Filtered batches for player:', playerBatches.length);
        setBatches(playerBatches); // Only set batches that contain this specific player

        // Fetch coach data for the filtered batches only
        const coachIds = new Set<string>();
        playerBatches.forEach((batch: { coachId?: string; coachIds?: string[]; userId?: string }) => {
          if (batch.coachId) coachIds.add(batch.coachId);
          if (Array.isArray(batch.coachIds)) {
            batch.coachIds.forEach(id => coachIds.add(id.toString()));
          }
          if (batch.userId) coachIds.add(batch.userId);
        });

        const coachPromises = Array.from(coachIds).map(id =>
          fetch(`/api/db/ams-coaches?id=${id}`).then(res => res.json())
        );

        const coachResponses = await Promise.all(coachPromises);
        const coachDataMap: { [key: string]: any } = {};
        
        coachResponses.forEach((response, index) => {
          const coachId = Array.from(coachIds)[index];
          if (response.data) {
            coachDataMap[coachId] = response.data;
          }
        });

        setCoachData(coachDataMap);

        // Collect all unique player IDs from the filtered batches only
        const allPlayerIds = new Set<string>();
        playerBatches.forEach((batch: any) => {
          if (Array.isArray(batch.players)) {
            batch.players.forEach((id: string) => allPlayerIds.add(id));
          }
        });

        // Fetch missing player data for players in these batches
        await fetchMissingPlayerData(Array.from(allPlayerIds));

      } catch (error) {
        console.error("Error loading data:", error);
      }
    };

    fetchData();
  }, [user?.academyId, user?.id]);

  // Update the fetchBatchPlayers effect to use cache
  useEffect(() => {
    const fetchBatchPlayers = async () => {
      if (!selectedBatch?.players || !Array.isArray(selectedBatch.players)) {
        setBatchPlayers([]);
        return;
      }

      // Filter player IDs that aren't in cache
      const playerIds = selectedBatch.players.filter((id: string) => 
        typeof id === "string" && id.startsWith("player_")
      );

      // First, set any players we already have in cache
      const cachedPlayers = playerIds
        .map((id: string) => playerCache[id])
        .filter(Boolean);
      
      setBatchPlayers(cachedPlayers);

      // Then fetch any missing players
      await fetchMissingPlayerData(playerIds);
    };
    fetchBatchPlayers();
  }, [selectedBatch]);

  useEffect(() => {
    const fetchplayerInfo = async (playerIds: string[]) => {
      try {
        const response = await fetch(`/api/db/ams-player-data/batch?ids=${playerIds.join(',')}`);
        if (!response.ok) return;
        
        const data = await response.json();
        const playersMap: {[key: string]: any} = {};
        
        data.data.forEach((player: any) => {
          playersMap[player.id] = {
            name: player.name || 'Unknown player',
            photoUrl: player.photoUrl || '/placeholder.svg',
            position: player.position || 'Unknown Position'
          };
        });
        
        setplayersInfo(playersMap);
      } catch (error) {
        console.error('Error fetching player info:', error);
      }
    };

    const playerIds = new Set<string>();
    Object.values(coachData).forEach(coach => {
      coach?.ratings?.forEach((rating: any) => {
        if (rating.playerId) {
          playerIds.add(rating.playerId);
        }
      });
    });

    if (playerIds.size > 0) {
      fetchplayerInfo(Array.from(playerIds));
    }
  }, [coachData]);

  const fetchCoachDetails = async (coachId: string, priority: boolean = false) => {
    // Cancel any existing non-priority fetch for this coach
    if (pendingFetches[coachId]) {
      pendingFetches[coachId].abort();
      delete pendingFetches[coachId];
    }

    // If data is already in cache and this is not a priority fetch, return cached data
    if (coachProfileCache[coachId] && !priority) {
      return coachProfileCache[coachId];
    }

    const controller = new AbortController();
    if (!priority) {
      setPendingFetches(prev => ({ ...prev, [coachId]: controller }));
    }

    try {
      // Fetch all coach data in parallel with abort signal
      const [coachResponse, userResponse, credentialsResponse] = await Promise.all([
        fetch(`/api/db/ams-coaches?id=${coachId}`, {
          signal: controller.signal
        }),
        fetch(`/api/db/ams-users?userId=${coachId}`, {
          signal: controller.signal
        }),
        fetch(`/api/db/ams-credentials?userId=${coachId}&academyId=${user?.academyId}`, {
          signal: controller.signal
        })
      ]);

      const [coachData, userData, credentialsData] = await Promise.all([
        coachResponse.json(),
        userResponse.json(),
        credentialsResponse.json()
      ]);

      // Normalize credentials to always be an array of objects with expected fields
      let credentials: any[] = [];
      if (Array.isArray(credentialsData.data)) {
        credentials = credentialsData.data.map((cred: any) => ({
          name: cred.title || cred.name || "Credential",
          type: cred.type || "",
          issueDate: cred.date || cred.issueDate || cred.issuedDate || "",
          expiryDate: cred.expiryDate || cred.expiry || "",
          issuingAuthority: cred.issuer || cred.issuingAuthority || "",
          credentialId: cred.credentialId || cred.id || "",
          status: cred.status || "",
          description: cred.description || "",
          document: cred.document || ""
        }));
      }

      // Merge all coach, user, and credentials data for the profile dialog
      const combinedData = {
        ...coachData.data,
        ...userData.data,
        credentials,
        id: coachId,
        name: userData.data?.name || coachData.data?.name || "Unknown Coach",
        email: userData.data?.email || coachData.data?.email || "Not available",
        photoUrl: userData.data?.photoUrl || coachData.data?.photoUrl || "/placeholder.svg",
        about: userData.data?.about || coachData.data?.about || "",
        achievements: coachData.data?.achievements || [],
        ratings: coachData.data?.ratings || [],
      };

      // Load existing player rating for this coach
      const playerId = currentPlayer?.id || user?.id;
      if (playerId && combinedData.ratings) {
        const existingRating = combinedData.ratings.find((rating: any) => rating.playerId === playerId);
        if (existingRating) {
          setRatings(prev => ({
            ...prev,
            [coachId]: existingRating.rating
          }));
        }
      }

      setCoachProfileCache(prev => ({ ...prev, [coachId]: combinedData }));

      // Remove from pending fetches
      if (!priority) {
        setPendingFetches(prev => {
          const newPending = { ...prev };
          delete newPending[coachId];
          return newPending;
        });
      }

      return combinedData;

    } catch (error) {
      if (typeof error === "object" && error !== null && "name" in error && (error as any).name === 'AbortError') {
        console.log('Fetch aborted:', coachId);
      } else {
        console.error('Error fetching coach details:', error);
      }
      return defaultCoachData(coachId);
    }
  };

  const handleBatchClick = async (batch: any) => {
    setSelectedBatch(batch);
    if (batch.coachId) {
      const coachDetails = await fetchCoachDetails(batch.coachId);
      setSelectedCoach(coachDetails);
    }
  };

  const handleCoachClick = async (coachId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCoachProfile(true);
    
    // If we have cached data, show it immediately while fetching fresh data
    if (coachProfileCache[coachId]) {
      setSelectedCoach(coachProfileCache[coachId]);
    }
    
    // Always fetch fresh data on click with priority
    const coachDetails = await fetchCoachDetails(coachId, true);
    setSelectedCoach(coachDetails);
  };

  const getCoachData = async (batch: any) => {
    let coachId = batch.coachId;
    
    if (!coachId && Array.isArray(batch.coachIds) && batch.coachIds.length > 0) {
      coachId = batch.coachIds[0];
    }

    if (!coachId && batch.userId) {
      coachId = batch.userId;
    }

    if (!coachId) {
      return defaultCoachData();
    }

    const coachDetails = await fetchCoachDetails(coachId);
    return {
      ...coachDetails,
      id: coachId,
      name: coachDetails.name || batch.coachName || "Unknown Coach"
    };
  };

  const defaultCoachData = (coachId?: string) => ({
    id: coachId || 'unknown',
    name: "Unknown Coach",
    photoUrl: "/placeholder.svg",
    email: "Not available",
    about: "No information available",
    averageRating: "0",
    ratings: [],
    credentials: []
  });

  const getCoachInfo = (coachId: string, batch?: any, idx?: number) => {
    // Use batchCoachDetails if in batch detail dialog
    if (selectedBatch && batchCoachDetails[coachId]) {
      return batchCoachDetails[coachId];
    }
    // Use allBatchCoachDetails for batch list rendering
    if (batch && allBatchCoachDetails[batch.id] && allBatchCoachDetails[batch.id][coachId]) {
      return allBatchCoachDetails[batch.id][coachId];
    }
    // Use coachId to fetch from coachData, and if not present, fetch profile data directly
    let coach = coachData[coachId];

    // If not in cache, fetch synchronously (not recommended for production, but for parity with coach profile dialog)
    // This is a workaround for the batch detail dialog to always show latest photo and averageRating
    // In production, consider prefetching all coach profiles for batch coaches
    if (!coach && typeof window !== "undefined") {
      // Synchronous fetch is not possible, so just return fallback
      return {
        id: coachId,
        name: batch?.coachNames?.[idx ?? 0] || batch?.coachName || "Unknown Coach",
        photoUrl: batch?.coachPhotos?.[idx ?? 0] || batch?.coachPhotoUrl || "/placeholder.svg",
        email: "Not available",
        averageRating: "N/A"
      };
    }

    // If coachData is present, but missing photo or averageRating, fetch from coach profile
    let photoUrl = coach?.photoUrl;
    let averageRating = coach?.averageRating;

    // If missing, try to use ratings array to calculate average
    if ((!averageRating || averageRating === "N/A") && Array.isArray(coach?.ratings) && coach.ratings.length > 0) {
      averageRating = (
        coach.ratings.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / coach.ratings.length
      ).toFixed(1);
    }

    // If still missing photo, fallback to batch-level photo
    if (
      (!photoUrl || photoUrl === "/placeholder.svg" || photoUrl === "/default-avatar.png") &&
      batch &&
      Array.isArray(batch.coachPhotos) &&
      typeof idx === "number" &&
      batch.coachPhotos[idx]
    ) {
      photoUrl = batch.coachPhotos[idx];
    }

    return {
      id: coachId,
      name: coach?.name || batch?.coachNames?.[idx ?? 0] || batch?.coachName || "Unknown Coach",
      photoUrl: photoUrl || "/placeholder.svg",
      email: coach?.email || "Not available",
      averageRating: averageRating || "N/A"
    };
  };

  const getPlayerData = (playerId: string) => {
    return playerCache[playerId] || {
      name: "Unknown Player",
      photoUrl: "/placeholder.svg",
      position: "No position"
    };
  };

  const getPlayersSummary = (playerIds: any[]) => {
    const stringPlayerIds = playerIds.map(id => id?.toString());
    const matchingPlayers = stringPlayerIds
      .map((id: string) => playerCache[id])
      .filter(Boolean);

    const totalInBatch = stringPlayerIds.length;
    const matchingCount = matchingPlayers.length;

    if (matchingCount === 0) return "No active players";
    if (matchingCount === 1) return `${matchingPlayers[0].name} (1/${totalInBatch} active)`;

    return `${matchingPlayers[0].name} + ${matchingCount - 1} others (${matchingCount}/${totalInBatch} active)`;
  };

  const handleRating = async (coachId: string, rating: number) => {
    try {
      if (!user?.academyId) {
        console.error('Academy ID missing');
        return;
      }

      const playerId = currentPlayer?.id || user?.id;
      if (!playerId) {
        console.error('player ID missing');
        return;
      }

      console.log('Submitting rating:', {
        coachId,
        playerId,
        rating,
        academyId: user.academyId
      });

      const response = await fetch('/api/db/ams-coaches/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coachId,
          playerId,
          rating,
          academyId: user.academyId,
          date: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to save rating:', errorData);
        return;
      }

      const data = await response.json();

      setRatings(prev => ({
        ...prev,
        [coachId]: rating
      }));

      if (data.success && data.data) {
        setCoachData(prev => ({
          ...prev,
          [coachId]: {
            ...prev,
            ...data.data,
            ratings: data.data.ratings || []
          }
        }));

        if (selectedCoach?.id === coachId) {
          setSelectedCoach((prev: typeof selectedCoach) => ({
            ...prev,
            ...data.data,
            ratings: data.data.ratings || []
          }));
        }
      }

    } catch (error) {
      console.error('Error saving rating:', error);
    }
  };

  const StarRating = ({ coachId }: { coachId: string }) => {
    const [hover, setHover] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const currentRating = ratings[coachId] || 0;

    const handleClick = async (star: number) => {
      setIsLoading(true);
      await handleRating(coachId, star);
      setIsLoading(false);
    };

    return (
      <div className="flex items-center space-x-1 mt-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleClick(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            className="focus:outline-none"
            disabled={isLoading}
          >
            <Star
              className={cn(
                "w-5 h-5",
                isLoading ? "text-gray-300" :
                (hover !== null ? star <= hover : star <= currentRating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-400",
                "transition-colors"
              )}
            />
          </button>
        ))}
        {currentRating > 0 && (
          <span className="text-sm text-gray-400 ml-2">
            ({currentRating}/5)
          </span>
        )}
      </div>
    );
  };

  const getplayerInfo = (rating: any) => {
    if (rating.playerInfo) {
      return rating.playerInfo;
    }
    return playersInfo[rating.playerId] || {
      name: 'Unknown player',
      photoUrl: '/placeholder.svg'
    };
  };

  const getCoachDisplayName = (batch: any, idx?: number) => {
    if (batch.coachIds && Array.isArray(batch.coachIds) && batch.coachIds.length > 0) {
      const coachId = batch.coachIds[idx ?? 0];
      const coach = coachData[coachId];
      if (coach && coach.name) return coach.name;
      if (batch.coachNames && batch.coachNames[idx ?? 0]) return batch.coachNames[idx ?? 0];
    }
    if (batch.coachId) {
      const coach = coachData[batch.coachId];
      if (coach && coach.name) return coach.name;
      if (batch.coachName) return batch.coachName;
    }
    return "Unknown Coach";
  };

  const getCoachPhotoUrl = (batch: any, idx?: number) => {
    // Use getCoachInfo to get the resolved coach object (with photoUrl)
    if (batch.coachIds && Array.isArray(batch.coachIds) && batch.coachIds.length > 0) {
      const coachId = batch.coachIds[idx ?? 0];
      const coach = getCoachInfo(coachId, batch, idx);
      if (coach && coach.photoUrl && coach.photoUrl !== "/placeholder.svg" && coach.photoUrl !== "/default-avatar.png") return coach.photoUrl;
    }
    if (batch.coachId) {
      const coach = getCoachInfo(batch.coachId, batch);
      if (coach && coach.photoUrl && coach.photoUrl !== "/placeholder.svg" && coach.photoUrl !== "/default-avatar.png") return coach.photoUrl;
    }
    return "/placeholder.svg";
  };

  const getplayerCount = (batch: any) => {
    if (Array.isArray(batch.players)) return batch.players.length;
    return 0;
  };

  // Render function that shows ONLY batches assigned to the current player
  const renderBatches = () => {
    if (!currentPlayer) {
      return (
        <TableRow>
          <TableCell colSpan={3} className="text-center text-gray-500">
            Loading player information...
          </TableCell>
        </TableRow>
      );
    }

    if (batches.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={3} className="text-center text-gray-500">
            No batches found for this player
          </TableCell>
        </TableRow>
      );
    }

    // Render all batches (they are already filtered in the useEffect)
    return batches.map((batch: any) => (
      <TableRow 
        key={batch._id || batch.id} 
        onClick={() => setSelectedBatch(batch)}
        className="hover:bg-accent cursor-pointer"
      >
        <TableCell className="font-medium">{batch.name}</TableCell>
        <TableCell>
          {batch.coachIds && Array.isArray(batch.coachIds) && batch.coachIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {batch.coachIds.map((coachId: string, idx: number) => (
                <div
                  key={coachId}
                  className="flex items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCoachClick(coachId, e);
                  }}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={getCoachPhotoUrl(batch, idx)} alt={batch.coachNames?.[idx] || "Unknown"} />
                    <AvatarFallback>{(batch.coachNames?.[idx] || "U")[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs underline text-white hover:text-gray-300 cursor-pointer">
                    {batch.coachNames?.[idx] || "Unknown Coach"}
                  </span>
                </div>
              ))}
            </div>
          ) : batch.coachId ? (
            <div 
              className="flex items-center gap-1"
              onClick={(e) => {
                e.stopPropagation();
                handleCoachClick(batch.coachId, e);
              }}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={getCoachPhotoUrl(batch)} alt={batch.coachName || "Unknown"} />
                <AvatarFallback>{(batch.coachName || "U")[0]}</AvatarFallback>
              </Avatar>
              <span className="text-xs underline text-white hover:text-gray-300 cursor-pointer">
                {batch.coachName || "Unknown Coach"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-500">No coach assigned</span>
          )}
        </TableCell>
        <TableCell>
          <span title={players
              .filter(p => batch.players && batch.players.includes(p.id))
              .map(p => p.name)
              .join(", ")}
          >
            {getPlayersSummary(batch.players || [])}
          </span>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-white">My Batches</h1>
          {currentPlayer && (
            <div className="text-sm text-gray-400">
              Player: {currentPlayer.name} ({currentPlayer.id})
            </div>
          )}
        </div>

        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Batch Name</TableHead>
              <TableHead>Coach(es)</TableHead>
              <TableHead>Players</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderBatches()}
          </TableBody>
        </Table>

        <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{selectedBatch?.name}</DialogTitle>
            </DialogHeader>
            
            {selectedBatch && (
              <ScrollArea className="h-full max-h-[calc(80vh-120px)]">
                <div className="space-y-6 p-4">
                  {selectedBatch.coachIds && Array.isArray(selectedBatch.coachIds) && selectedBatch.coachIds.length > 0 ? (
                    <div>
                      <div className="font-semibold mb-2">Coaches:</div>
                      <div className="flex flex-wrap gap-4">
                        {selectedBatch.coachIds.map((coachId: string, idx: number) => {
                          const coach = getCoachInfo(coachId, selectedBatch, idx);
                          return (
                            <div
                              key={coachId}
                              className="flex flex-col items-center gap-2 cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                handleCoachClick(coachId, e);
                              }}
                            >
                              <Avatar className="h-16 w-16">
                                <AvatarImage src={coach.photoUrl || "/placeholder.svg"} alt={coach.name} />
                                <AvatarFallback>{coach.name?.[0]}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium underline text-white hover:text-gray-300">{coach.name}</span>
                              <span className="text-xs text-gray-500">{coach.email}</span>
                              <span className="text-xs text-yellow-500 font-semibold">
                                {coach.averageRating !== "N/A" ? `Avg. Rating: ${coach.averageRating}` : "No ratings yet"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    selectedBatch.coachId && (
                      <div>
                        <div className="font-semibold mb-2">Coach:</div>
                        {(() => {
                          const coach = getCoachInfo(selectedBatch.coachId, selectedBatch);
                          return (
                            <div
                              className="flex flex-col items-center gap-2 cursor-pointer"
                              onClick={e => {
                                e.stopPropagation();
                                handleCoachClick(selectedBatch.coachId, e);
                              }}
                            >
                              <Avatar className="h-16 w-16">
                                <AvatarImage src={coach.photoUrl || "/placeholder.svg"} alt={coach.name} />
                                <AvatarFallback>{coach.name?.[0]}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium underline text-white hover:text-gray-300">{coach.name}</span>
                              <span className="text-xs text-gray-500">{coach.email}</span>
                              <span className="text-xs text-yellow-500 font-semibold">
                                {coach.averageRating !== "N/A" ? `Avg. Rating: ${coach.averageRating}` : "No ratings yet"}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )
                  )}

                  <Separator className="my-4" />

                  <div className="grid grid-cols-2 gap-4">
                    {selectedBatch.players && selectedBatch.players.map((playerId: string) => {
                      const playerData = getPlayerData(playerId);
                      return (
                        <div 
                          key={playerId} 
                          className="flex items-center space-x-3 p-2 rounded-lg bg-accent"
                        >
                          <Avatar>
                            <AvatarImage 
                              src={playerData.photoUrl} 
                              alt={playerData.name} 
                            />
                            <AvatarFallback>
                              {playerData.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{playerData.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {playerData.position}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showCoachProfile} onOpenChange={setShowCoachProfile}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Coach Profile</DialogTitle>
            </DialogHeader>
            <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="credentials">Credentials</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={selectedCoach?.photoUrl} />
                      <AvatarFallback>{selectedCoach?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-2xl font-bold">{selectedCoach?.name}</h3>
                      <p className="text-gray-500">{selectedCoach?.email}</p>
                      <div className="mt-2">
                        <StarRating coachId={selectedCoach?.id} />
                      </div>
                    </div>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>About</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{selectedCoach?.about || 'No about information available'}</p>
                    </CardContent>
                  </Card>

                  {selectedCoach?.achievements && selectedCoach.achievements.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Achievements</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="list-disc pl-4 space-y-2">
                          {selectedCoach.achievements.map((achievement: string, index: number) => (
                            <li key={index}>{achievement}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {selectedCoach?.ratings && selectedCoach.ratings.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Reviews</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {selectedCoach.ratings.slice(-3).map((rating: any, index: number) => {
                            const playerInfo = getplayerInfo(rating);
                            return (
                              <div key={index} className="flex items-start space-x-4 p-4 bg-accent rounded-lg">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={playerInfo.photoUrl} alt={playerInfo.name} />
                                  <AvatarFallback>{playerInfo.name[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex justify-between items-center">
                                    <p className="font-medium text-sm">{playerInfo.name}</p>
                                    <div className="flex items-center">
                                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                                      <span className="text-sm font-medium">{rating.playerInfo?.rating || rating.rating || 0}/5</span>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(rating.date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="credentials" className="space-y-4">
                  {selectedCoach?.credentials && selectedCoach.credentials.length > 0 ? (
                    selectedCoach.credentials.map((cred: any, index: number) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle>{cred.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <p className="text-sm text-gray-500">
                              <span className="font-medium">Type:</span> {cred.type}
                            </p>
                            <p className="text-sm text-gray-500">
                              <span className="font-medium">Issued Date:</span> {cred.issueDate}
                            </p>
                            <p className="text-sm text-gray-500">
                              <span className="font-medium">Expiry Date:</span> {cred.expiryDate}
                            </p>
                            <p className="text-sm text-gray-500">
                              <span className="font-medium">Issuing Authority:</span> {cred.issuingAuthority}
                            </p>
                            <p className="text-sm text-gray-500">
                              <span className="font-medium">Credential ID:</span> {cred.credentialId}
                            </p>
                            <p className="text-sm text-gray-500">
                              <span className="font-medium">Status:</span> {cred.status}
                            </p>
                            {cred.description && (
                              <div className="mt-4">
                                <span className="font-medium text-sm text-gray-500">Description:</span>
                                <p className="text-sm text-gray-500 mt-1">{cred.description}</p>
                              </div>
                            )}
                            {cred.document && (
                              <div className="mt-2">
                                <a
                                  href={cred.document.startsWith('/api/docs/') ? cred.document : `/api/docs/${cred.document}`}
                                  download
                                  className="text-blue-600 underline text-sm"
                                >
                                  View Document
                                </a>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-gray-500">No credentials available</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}