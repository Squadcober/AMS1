"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { usePlayers } from "@/contexts/PlayerContext"
import type { Player } from "@/contexts/PlayerContext"
import { useAuth } from "@/contexts/AuthContext"
import { TimePicker } from "@/components/ui/timepicker"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Sidebar from "@/components/Sidebar"
import { useToast } from "@/components/ui/use-toast"
import { useBatches } from "@/contexts/BatchContext"

interface Drill {
  id: string
  name: string
  description: string
  assignedPlayers: { id: string, name: string }[]
  coachId: string
  coachName: string
  playersAssigned: string[]
  academyId: string
}

export default function DrillsPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { players, setPlayers, getPlayerByUserId, updatePlayerAttributes } = usePlayers()
  const { batches, setBatches } = useBatches()
  const [drills, setDrills] = useState<Drill[]>([])
  const [newDrill, setNewDrill] = useState<Omit<Drill, "id">>({
    name: "",
    description: "",
    assignedPlayers: [],
    coachId: user?.id || "",
    coachName: user?.name || "",
    playersAssigned: [],
    academyId: user?.academyId || "",
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewDetailsDrillId, setViewDetailsDrillId] = useState<string | null>(null)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [searchTerm, setSearchTerm] = useState<string>("")

  const [selectedDrills, setSelectedDrills] = useState<string[]>([])
  const [showCheckboxes, setShowCheckboxes] = useState(false)
  const [trainingPoints, setTrainingPoints] = useState<{ [key: string]: number }>({})

  const [isAddDrillDialogOpen, setIsAddDrillDialogOpen] = useState(false)
  const [isDrillDetailsDialogOpen, setIsDrillDetailsDialogOpen] = useState(false)

  const [playerSearchTerm, setPlayerSearchTerm] = useState("")

  const [showPlayerSelector, setShowPlayerSelector] = useState(false)
  const [currentDrillId, setCurrentDrillId] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(true)

  const [selectedBatch, setSelectedBatch] = useState<string>("")
  const [playerSearchQuery, setPlayerSearchQuery] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        console.log('Waiting for user data...');
        return;
      }

      const academyId = user.academyId 
        ? (typeof user.academyId === 'string' 
            ? user.academyId 
            : (user.academyId as { id: string })?.id)
        : null;
      if (!academyId) {
        console.error('No academyId available in user data:', user);
        toast({
          title: "Error",
          description: "Missing academy information. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsLoading(true);
        console.log('Fetching data for academy:', academyId);

        const [playersRes, batchesRes] = await Promise.all([
          fetch(`/api/db/ams-player-data?academyId=${academyId}`),
          fetch(`/api/db/ams-batches?academyId=${academyId}`)
        ]);

        if (!playersRes.ok || !batchesRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const [playersData, batchesData] = await Promise.all([
          playersRes.json(),
          batchesRes.json()
        ]);

        console.log('API Responses:', {
          players: playersData,
          batches: batchesData
        });

        if (playersData.success) {
          const formattedPlayers = playersData.data.map((player: any) => ({
            ...player,
            id: player._id || player.id,
            name: player.name || player.username || 'Unknown Player',
            academyId: player.academyId || academyId
          }));
          setPlayers(formattedPlayers);
        }

        if (batchesData.success) {
          const formattedBatches = batchesData.data.map((batch: any) => ({
            ...batch,
            id: batch._id || batch.id,
            name: batch.name || 'Unnamed Batch',
            academyId: batch.academyId || academyId
          }));
          setBatches(formattedBatches);
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user, toast]);

  const handleBatchSelect = async (batchId: string) => {
    try {
      setIsLoading(true);
      
      if (batchId === "" || batchId === "none" || !batchId) {
        // Clear batch selection and assigned players
        setSelectedBatch("");
        setNewDrill(prev => ({
          ...prev,
          assignedPlayers: []
        }));
        
        toast({
          title: "Cleared",
          description: "Batch selection cleared",
        });
        return;
      }
      
      setSelectedBatch(batchId);
      
      const response = await fetch(`/api/db/ams-batches/${batchId}/players`);
      if (!response.ok) {
        throw new Error('Failed to fetch batch players');
      }
      
      const result = await response.json();
      
      if (result.success) {
        const batchPlayers = result.data.map((player: any) => ({
          id: player._id || player.id,
          name: player.name || player.username || 'Unknown Player'
        }));
        
        setNewDrill(prev => ({
          ...prev,
          assignedPlayers: batchPlayers
        }));

        toast({
          title: "Success",
          description: `Loaded ${batchPlayers.length} players from batch`,
        });
      }
    } catch (error) {
      console.error('Error fetching batch players:', error);
      toast({
        title: "Error",
        description: "Failed to load batch players",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderBatchSelection = () => (
    <div>
      <Label>Select Batch (Optional)</Label>
      <Select
        value={selectedBatch || ""}
        onValueChange={handleBatchSelect}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={
            isLoading ? "Loading batches..." : selectedBatch ? "Selected batch" : "Select a batch"
          } />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <SelectItem value="loading" disabled>Loading...</SelectItem>
          ) : !batches?.length ? (
            <SelectItem value="none" disabled>No batches available</SelectItem>
          ) : (
            <>
              <SelectItem value="none">None (Clear Selection)</SelectItem>
              {batches
                .filter(batch => batch.academyId === user?.academyId)
                .map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </SelectItem>
                ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );

  const getPlayerName = async (playerId: string): Promise<string> => {
    try {
      const response = await fetch(`/api/db/ams-player-data/${playerId}`);
      if (!response.ok) throw new Error('Failed to fetch player');
      
      const player = await response.json();
      return player.name || player.username || 'Unknown Player';
    } catch (error) {
      console.error('Error getting player name:', error);
      return 'Unknown Player';
    }
  };

  const renderPlayerSelection = () => (
    <div className="h-[200px] overflow-y-auto border rounded-md p-2">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <p>Loading players...</p>
        </div>
      ) : players.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p>No players available</p>
        </div>
      ) : (
        players
          .filter(player => 
            player.academyId === user?.academyId &&
            (!playerSearchQuery || player.name.toLowerCase().includes(playerSearchQuery.toLowerCase()))
          )
          .map((player) => (
            <div key={player.id} className="flex items-center space-x-2 p-2">
              <input
                type="checkbox"
                checked={newDrill.assignedPlayers.some(p => p.id === player.id.toString())}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleAssignPlayer(player.id.toString(), player.name)
                  } else {
                    handleRemovePlayer(player.id.toString())
                  }
                }}
                className="h-4 w-4"
              />
              <span>{player.name}</span>
            </div>
          ))
      )}
    </div>
  );

  const getPlayerNameLocal = async (playerId: string): Promise<string> => {
    const contextPlayer = getPlayerByUserId?.(playerId)
    if (contextPlayer?.name) return contextPlayer.name

    try {
      const response = await fetch(`/api/db/ams-player-data/${playerId}`)
      if (response.ok) {
        const player = await response.json()
        return player.name || player.username || 'Unknown Player'
      }
    } catch (error) {
      console.error('Error getting player name:', error)
    }

    return 'Unknown Player'
  }

  useEffect(() => {
    const fetchDrills = async () => {
      try {
        if (!user?.id || !user?.academyId) {
          console.log('Missing user data:', { id: user?.id, academyId: user?.academyId });
          return;
        }

        setIsLoading(true);
        const url = `/api/db/ams-drills?academyId=${encodeURIComponent(user.academyId)}&coachId=${encodeURIComponent(user.id)}`;
        console.log('🔍 Fetching drills:', { url });

        const response = await fetch(url);
        console.log('📡 API Response status:', response.status);

        const result = await response.json();
        console.log('📦 API Response:', result);

        if (result.success) {
          const formattedDrills = result.data.map((drill: any) => ({
            ...drill,
            id: drill._id.toString(),
            assignedPlayers: drill.assignedPlayers || [],
            playersAssigned: drill.playersAssigned || [],
            academyId: drill.academyId || user.academyId,
            coachId: drill.coachId || user.id,
          }));

          console.log('✅ Setting drills:', formattedDrills);
          setDrills(formattedDrills);
        } else {
          throw new Error(result.error || 'Failed to fetch drills');
        }
      } catch (error) {
        console.error('❌ Error loading drills:', error);
        toast({
          title: "Error",
          description: "Failed to load drills",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id && user?.academyId) {
      console.log('👤 Initiating drill fetch for:', { userId: user.id, academyId: user.academyId });
      fetchDrills();
    }
  }, [user?.id, user?.academyId]);

  useEffect(() => {
    console.log('Drills state updated:', drills);
  }, [drills]);

  useEffect(() => {
  }, [])


  const handleSaveDrill = async () => {
    if (!user?.academyId || !user?.id || !newDrill.name) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🔍 Sending drill data to API:', {
        ...newDrill,
        coachId: user.id,
        academyId: user.academyId,
      });

      const response = await fetch('/api/db/ams-drills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newDrill,
          coachId: user.id,
          academyId: user.academyId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create drill');
      }

      const result = await response.json();
      console.log('✅ Drill created:', result);

      if (result.success) {
        setDrills((prev) => [...prev, result.data]);
        setIsAddDrillDialogOpen(false);
        setNewDrill({
          name: "",
          description: "",
          assignedPlayers: [],
          coachId: user.id,
          coachName: user.name || "",
          playersAssigned: [],
          academyId: user.academyId,
        });

        toast({
          title: "Success",
          description: "Drill created successfully",
        });
      }
    } catch (error) {
      console.error('❌ Error creating drill:', error);
      toast({
        title: "Error",
        description: "Failed to create drill",
        variant: "destructive",
      });
    }
  };

  const handleAssignPlayer = (playerId: string, playerName: string) => {
    setNewDrill((prev) => ({
      ...prev,
      assignedPlayers: [...prev.assignedPlayers, { id: playerId, name: playerName }],
    }))
  }

  const handleRemovePlayer = (playerId: string) => {
    setNewDrill((prev) => ({
      ...prev,
      assignedPlayers: prev.assignedPlayers.filter((player) => player.id !== playerId),
    }))
  }

  const handleViewDetails = (drillId: string) => {
    setViewDetailsDrillId(drillId)
    setIsDrillDetailsDialogOpen(true)
  }

  const handleSelectAllPlayers = () => {
    const filteredPlayers = players
      .filter(player => {
        if (!playerSearchQuery) return player.academyId === user?.academyId
        return player.academyId === user?.academyId && 
               player.name.toLowerCase().includes(playerSearchQuery.toLowerCase())
      })
      .map(player => ({
        id: player.id.toString(),
        name: player.name
      }))

    setNewDrill(prev => ({
      ...prev,
      assignedPlayers: selectedPlayers.length === filteredPlayers.length ? [] : filteredPlayers
    }))
  }

  const renderAssignedPlayers = (players: { id: string, name: string }[]) => {
    if (players.length === 0) return "No players assigned"
    if (players.length === 1) return players[0].name
    return `${players[0].name} + ${players.length - 1} others`
  }

  const handleDrillSelection = (drillId: string) => {
    setSelectedDrills(prev => 
      prev.includes(drillId) 
        ? prev.filter(id => id !== drillId)
        : [...prev, drillId]
    )
  }

  const handleDeleteSelected = async () => {
    if (!showCheckboxes) {
      setShowCheckboxes(true);
      return;
    }

    if (selectedDrills.length === 0) {
      setShowCheckboxes(false);
      return;
    }

    try {
      await Promise.all(
        selectedDrills.map(drillId =>
          fetch(`/api/db/ams-drills/${drillId}`, {
            method: 'DELETE'
          })
        )
      );

      setDrills(prev => prev.filter(drill => !selectedDrills.includes(drill.id)));
      setSelectedDrills([]);
      setShowCheckboxes(false);

      toast({
        title: "Success",
        description: `${selectedDrills.length} drills deleted successfully`,
      });
    } catch (error) {
      console.error('Error deleting drills:', error);
      toast({
        title: "Error",
        description: "Failed to delete drills",
        variant: "destructive",
      });
    }
  };

  const [showMySessionsOnly, setShowMySessionsOnly] = useState(false)
  const [sessionSearchTerm, setSessionSearchTerm] = useState("")

  useEffect(() => {
    if (viewDetailsDrillId) {
      const drill = drills.find(d => d.id === viewDetailsDrillId)
      if (drill) {
        const initialPoints: { [key: string]: number } = {}
        drill.assignedPlayers.forEach(player => {
          const playerData = getPlayerByUserId?.(player.id)
          if (playerData?.attributes?.trainingPoints !== undefined) {
            initialPoints[player.id] = playerData.attributes.trainingPoints
          }
        })
        
        setTrainingPoints(initialPoints)
      }
    }
  }, [viewDetailsDrillId, drills, getPlayerByUserId])

  const renderDrillDetails = () => {
    const drill = drills.find(d => d.id === viewDetailsDrillId)
    if (!drill) return null

    const assignedPlayersWithDetails = drill.assignedPlayers
      .map(player => {
        const fullPlayerData = getPlayerByUserId?.(player.id) || null
        return {
          ...player,
          name: fullPlayerData?.name || player.name || 'Unknown Player'
        }
      })
      .filter(player => 
        player.name.toLowerCase().includes(playerSearchTerm.toLowerCase())
      )

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Name</Label>
            <p>{drill.name}</p>
          </div>
          <div>
            <Label>Description</Label>
            <p>{drill.description}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <Label>Assigned Players</Label>
            <Button 
              variant="outline" 
              onClick={() => {
                setCurrentDrillId(drill.id)
                setShowPlayerSelector(true)
              }}
            >
              Add Players
            </Button>
          </div>
          
          <Input
            placeholder="Search players..."
            value={playerSearchTerm}
            onChange={(e) => setPlayerSearchTerm(e.target.value)}
            className="mb-4"
          />

          <div className="max-h-[400px] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Player Name</TableHead>
                  <TableHead>Training Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedPlayersWithDetails.map(player => {
                  const playerData = getPlayerByUserId?.(player.id)
                  const currentPoints = trainingPoints[player.id] ?? playerData?.attributes?.trainingPoints ?? 0
                  
                  return (
                    <TableRow key={player.id}>
                      <TableCell>{player.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          value={trainingPoints[player.id] ?? ""}
                          onChange={(e) => handleTrainingPointChange(player.id, parseInt(e.target.value))}
                          placeholder={`Current: ${currentPoints}`}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="default" onClick={handleSaveTrainingPoints}>
            Save Training Points
          </Button>
        </DialogFooter>
      </div>
    )
  }

  const handleRatePlayer = (playerId: string, rating: number) => {
    const playerData = getPlayerByUserId?.(playerId)
    if (playerData) {
      const updatedAttributes = {
        ...playerData.attributes,
        trainingPoints: playerData.attributes.trainingPoints + rating,
      }
      updatePlayerAttributes(Number(playerData.id), { attributes: updatedAttributes })
    }
  }

  const handleSaveChanges = () => {
    setHasUnsavedChanges(false)
  }

  const handleTrainingPointChange = (playerId: string, value: number) => {
    setTrainingPoints(prev => ({
      ...prev,
      [playerId]: value
    }))
  }

  const handleSaveTrainingPoints = async () => {
    if (!viewDetailsDrillId) return;

    try {
      const updates = [];
      const updatedTrainingPoints = { ...trainingPoints };
      
      console.log('Starting to save training points...');
      console.log('Training points to save:', trainingPoints);
      
      for (const [playerId, points] of Object.entries(trainingPoints)) {
        const playerData = getPlayerByUserId?.(playerId);
        const currentPoints = playerData?.attributes?.trainingPoints || 0;

        if (points === currentPoints) {
          console.log(`Skipping player ${playerId} - no change in points (${points} vs ${currentPoints})`);
          continue;
        }

        const requestBody = {
          points: points,
          drillId: viewDetailsDrillId,
          previousPoints: currentPoints
        };

        console.log(`Making API call for player ${playerId}:`, requestBody);

        updates.push(
          fetch(`/api/db/ams-player-data/${playerId}/training-points`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          }).then(async res => {
            const result = await res.json();
            console.log(`API response for player ${playerId}:`, result);
            return result;
          })
        );
      }

      if (updates.length === 0) {
        console.log('No updates to save');
        toast({
          title: "Info",
          description: "No changes to save",
        });
        return;
      }

      console.log(`Making ${updates.length} API calls...`);
      const results = await Promise.all(updates);
      console.log('All API responses:', results);
      
      let updatedPlayers = [...players];
      
      results.forEach(result => {
        console.log('Processing result:', result);
        if (result.success && result.data) {
          console.log('Successfully updated player:', result.data);
          const updatedPlayer = result.data;
          
          // Update the players context with the new data
          updatedPlayers = updatedPlayers.map(p => {
            // Check if this is the updated player by comparing IDs
            const updatedPlayerId = updatedPlayer.id || updatedPlayer._id;
            if (p.id.toString() === updatedPlayerId.toString()) {
              
              console.log('Updating player in context:', p.name, 'with new training points:', updatedPlayer.attributes?.trainingPoints);
              
              return {
                ...p,
                id: updatedPlayer.id || p.id,
                name: updatedPlayer.name || p.name,
                academyId: updatedPlayer.academyId || p.academyId,
                attributes: {
                  ...p.attributes,
                  ...updatedPlayer.attributes,
                  trainingPoints: updatedPlayer.attributes?.trainingPoints || p.attributes.trainingPoints || 0
                }
              } satisfies Player;
            }
            return p;
          });
        } else {
          console.log('API call failed or returned no data:', result);
        }
      });
      
      // Update the players context with all the changes
      setPlayers(updatedPlayers);

      // Update the training points state to reflect the saved values
      // Use the actual saved values from the API responses
      setTrainingPoints(prev => {
        const updated = { ...prev };
        results.forEach(result => {
          if (result.success && result.data) {
            const updatedPlayer = result.data;
            const playerId = updatedPlayer.id || updatedPlayer._id;
            
            // Check if the player data has the training points in the expected location
            if (playerId) {
              const trainingPointsValue = 
                updatedPlayer.attributes?.trainingPoints || 
                updatedPlayer.attributes?.drillTrainingPoints || 
                0;
              
              console.log(`Updating training points for player ${playerId}:`, trainingPointsValue);
              updated[playerId] = trainingPointsValue;
            }
          }
        });
        return updated;
      });

      // Refetch player details to ensure UI shows the most up-to-date data
      try {
        const academyId = user?.academyId 
          ? (typeof user.academyId === 'string' 
              ? user.academyId 
              : (user.academyId as { id: string })?.id)
          : null;
        if (academyId) {
          const playersRes = await fetch(`/api/db/ams-player-data?academyId=${academyId}`);
          if (playersRes.ok) {
            const playersData = await playersRes.json();
            if (playersData.success) {
              const formattedPlayers = playersData.data.map((player: any) => ({
                ...player,
                id: player._id || player.id,
                name: player.name || player.username || 'Unknown Player',
                academyId: player.academyId || academyId
              }));
              setPlayers(formattedPlayers);
            }
          }
        }
      } catch (error) {
        console.error('Error refetching player data:', error);
      }

      toast({
        title: "Success",
        description: "Training points saved successfully",
      });

    } catch (error) {
      console.error('Error saving training points:', error);
      toast({
        title: "Error",
        description: "Failed to save training points",
        variant: "destructive",
      });
    }
  };

  const handlePlayerAssignment = (drillId: string, playerId: string, isAssigned: boolean) => {
    setDrills(currentDrills => {
      return currentDrills.map(drill => {
        if (drill.id === drillId) {
          return {
            ...drill,
            playersAssigned: isAssigned
              ? [...(drill.playersAssigned || []), playerId]
              : (drill.playersAssigned || []).filter(id => id !== playerId)
          }
        }
        return drill
      })
    })

    const updatedDrills = drills.map(drill => {
      if (drill.id === drillId) {
        return {
          ...drill,
          playersAssigned: isAssigned
            ? [...(drill.playersAssigned || []), playerId]
            : (drill.playersAssigned || []).filter(id => id !== playerId)
        }
      }
      return drill
    })
  }

  const handleAddPlayers = (drillId: string, newPlayers: { id: string, name: string }[]) => {
    setDrills(prevDrills => {
      const updatedDrills = prevDrills.map(drill => {
        if (drill.id === drillId) {
          const existingIds = drill.assignedPlayers.map(p => p.id)
          const newPlayersFiltered = newPlayers.filter(p => !existingIds.includes(p.id))
          
          return {
            ...drill,
            assignedPlayers: [...drill.assignedPlayers, ...newPlayersFiltered]
          }
        }
        return drill
      })

      toast({
        title: "Success",
        description: "Players added to drill successfully",
      })

      return updatedDrills
    })
  }

  const renderPlayerSelectorDialog = () => (
    <Dialog open={showPlayerSelector} onOpenChange={setShowPlayerSelector}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Players to Drill</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {renderBatchSelection()}
          <Input
            placeholder="Search players..."
            value={playerSearchQuery}
            onChange={(e) => setPlayerSearchQuery(e.target.value)}
            className="mb-2"
          />
          <div className="h-[300px] overflow-y-auto border rounded-md p-2">
            {players
              .filter(player => 
                player.academyId === user?.academyId &&
                (!playerSearchQuery || player.name.toLowerCase().includes(playerSearchQuery.toLowerCase())) &&
                !drills.find(d => d.id === currentDrillId)?.assignedPlayers.some(p => p.id === player.id.toString())
              )
              .map((player) => (
                <div key={player.id} className="flex items-center space-x-2 p-2">
                  <input
                    type="checkbox"
                    checked={selectedPlayers.includes(player.id.toString())}
                    onChange={(e) => {
                      setSelectedPlayers(prev => 
                        e.target.checked 
                          ? [...prev, player.id.toString()]
                          : prev.filter(id => id !== player.id.toString())
                      )
                    }}
                    className="h-4 w-4"
                  />
                  <span>{player.name}</span>
                </div>
              ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              if (currentDrillId && selectedPlayers.length > 0) {
                const playerNames = await Promise.all(
                  selectedPlayers.map(id => getPlayerNameLocal(id))
                );
                
                const newPlayers = selectedPlayers.map((id, index) => ({
                  id,
                  name: playerNames[index]
                }));
                
                handleAddPlayers(currentDrillId, newPlayers)
                setSelectedPlayers([])
                setShowPlayerSelector(false)
              }
            }}
          >
            Add Selected Players
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="flex h-screen bg-background dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto bg-background dark:bg-gray-900">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-foreground dark:text-white">Drills</h1>
          <div className="flex gap-4">
            <Button variant="default" onClick={() => setIsAddDrillDialogOpen(true)}>
              + Add Drill
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteSelected}
            >
              {!showCheckboxes 
                ? "Delete Drills" 
                : selectedDrills.length === 0 
                  ? "Cancel" 
                  : `Delete (${selectedDrills.length})`}
            </Button>
          </div>

          <div className="flex space-x-4 items-center mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search drills..."
                value={sessionSearchTerm}
                onChange={(e) => setSessionSearchTerm(e.target.value)}
                className="w-full bg-background dark:bg-gray-800"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-lg text-muted-foreground">Loading drills...</p>
            </div>
          ) : drills.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-lg text-muted-foreground">No drills found</p>
            </div>
          ) : (
            <div className="rounded-md border dark:border-gray-700">
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-gray-700">
                    {showCheckboxes && <TableHead className="w-[50px]">Select</TableHead>}
                    <TableHead className="dark:text-gray-200">Drill Name</TableHead>
                    <TableHead className="dark:text-gray-200">Description</TableHead>
                    <TableHead className="dark:text-gray-200">Assigned Players</TableHead>
                    <TableHead className="dark:text-gray-200">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drills
                    .filter((drill) =>
                      drill.name.toLowerCase().includes(sessionSearchTerm.toLowerCase()) ||
                      drill.assignedPlayers.some(player => 
                        player.name.toLowerCase().includes(sessionSearchTerm.toLowerCase())
                      )
                    )
                    .map((drill) => (
                      <TableRow key={drill.id} className="dark:border-gray-700">
                        {showCheckboxes && (
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedDrills.includes(drill.id)}
                              onChange={() => handleDrillSelection(drill.id)}
                              className="h-4 w-4"
                            />
                          </TableCell>
                        )}
                        <TableCell className="dark:text-gray-300">{drill.name}</TableCell>
                        <TableCell className="dark:text-gray-300">{drill.description}</TableCell>
                        <TableCell 
                          className="cursor-pointer hover:text-blue-500 dark:text-gray-300"
                          onClick={() => handleViewDetails(drill.id)}
                        >
                          {renderAssignedPlayers(drill.assignedPlayers)}
                        </TableCell>
                        <TableCell>
                          <Button variant="default" onClick={() => handleViewDetails(drill.id)}>
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Dialog open={isAddDrillDialogOpen} onOpenChange={setIsAddDrillDialogOpen}>
            <DialogContent className="bg-background dark:bg-gray-800">
              <DialogHeader>
                <DialogTitle>Add Drill</DialogTitle>
              </DialogHeader>
              <>
                <Input
                  placeholder="Drill Name"
                  value={newDrill.name}
                  onChange={(e) => setNewDrill({ ...newDrill, name: e.target.value })}
                />
                <Input
                  placeholder="Description"
                  value={newDrill.description}
                  onChange={(e) => setNewDrill({ ...newDrill, description: e.target.value })}
                />
                <div>
                  <Label>Assign Players</Label>
                  <div className="space-y-4">
                    {renderBatchSelection()}
                    <Input
                      placeholder="Search players..."
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      className="mb-2"
                    />
                    {renderPlayerSelection()}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="default" onClick={handleSaveDrill}>Save</Button>
                </DialogFooter>
              </>
            </DialogContent>
          </Dialog>

          <Dialog 
            open={isDrillDetailsDialogOpen} 
            onOpenChange={(open) => {
              setIsDrillDetailsDialogOpen(open)
              if (!open) setPlayerSearchTerm("")
            }}
          >
            <DialogContent className="max-h-[80vh] overflow-y-auto bg-background dark:bg-gray-800">
              <DialogHeader>
                <DialogTitle>Drill Details</DialogTitle>
              </DialogHeader>
              {renderDrillDetails()}
            </DialogContent>
          </Dialog>

        </div>
      </div>
      {renderPlayerSelectorDialog()}
    </div>
  )
}