"use client"

import { useState, useEffect } from "react"
import Sidebar from "@/components/Sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Radar, Line } from "react-chartjs-2"
import { Chart as ChartJS, RadialLinearScale, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';

// Register Chart.js components
ChartJS.register(
  RadialLinearScale,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale
);

const calculateOverallRating = (attributes: any) => {
  if (!attributes) return 0;
  
  const values = [
    attributes.shooting || 0,
    attributes.pace || 0,
    attributes.positioning || 0,
    attributes.passing || 0,
    attributes.ballControl || 0,
    attributes.crossing || 0
  ];
  
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Number((sum / 6).toFixed(1)); // Average of all attributes
};

const calculateAveragePerformance = (player: any) => {
  if (!player?.performanceHistory?.length) return 0;
  
  const recentPerformances = player.performanceHistory
    .slice(-5) // Get last 5 performances
    .map((p: any) => p.sessionRating || p.matchRating || 0);
  
  const sum = recentPerformances.reduce((acc: number, val: number) => acc + val, 0);
  return (sum / recentPerformances.length).toFixed(1);
};

export default function BatchesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [localBatches, setLocalBatches] = useState<any[]>([])
  const [batchPlayers, setBatchPlayers] = useState<{ [batchId: string]: any[] }>({})
  const [selectedBatch, setSelectedBatch] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isPlayerDetailsOpen, setIsPlayerDetailsOpen] = useState(false)
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState<any>(null)
  const [newBatchName, setNewBatchName] = useState("")
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<any>(null)
  const [batchNameError, setBatchNameError] = useState("")
  const [allPlayersSelected, setAllPlayersSelected] = useState(false)

  useEffect(() => {
    const fetchBatchesForPlayer = async () => {
      if (!user?.academyId || !user?.id) return;

      try {
        setIsLoading(true);

        // Step 1: Fetch the user's player id
        const playerRes = await fetch(`/api/db/ams-player-data?academyId=${user.academyId}&userId=${user.id}`);
        if (!playerRes.ok) throw new Error("Failed to fetch player data");
        const playerJson = await playerRes.json();
        const playerObj = Array.isArray(playerJson.data) ? playerJson.data[0] : playerJson.data;
        const playerId = playerObj?.playerId || playerObj?.id || playerObj?._id;
        if (!playerId) throw new Error("Player ID not found for user");

        // Step 2: Fetch all batches for the academy
        const batchesRes = await fetch(`/api/db/ams-batches?academyId=${user.academyId}`);
        if (!batchesRes.ok) throw new Error("Failed to fetch batches");
        const batchesJson = await batchesRes.json();
        const allBatches = Array.isArray(batchesJson.data) ? batchesJson.data : [];

        // Step 3: Filter batches to only those containing the player's playerId
        const filteredBatches = allBatches.filter((batch: any) =>
          Array.isArray(batch.players) && batch.players.includes(playerId)
        );

        setLocalBatches(filteredBatches);
      } catch (error) {
        console.error("Error fetching batches for player:", error);
        toast({
          title: "Error",
          description: "Failed to load batches",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatchesForPlayer();
  }, [user?.academyId, user?.id]);

  useEffect(() => {
    const fetchBatchPlayers = async (batchId: string) => {
      try {
        const response = await fetch(`/api/db/ams-batches/${batchId}/players`);
        if (!response.ok) throw new Error("Failed to fetch batch players");

        const result = await response.json();
        if (result.success) {
          setBatchPlayers((prev) => ({
            ...prev,
            [batchId]: result.data,
          }));
        }
      } catch (error) {
        console.error("Error fetching batch players:", error);
      }
    };

    if (selectedBatch?._id) {
      fetchBatchPlayers(selectedBatch._id);
    }
  }, [selectedBatch]);

  useEffect(() => {
    const fetchPlayers = async () => {
      if (!user?.academyId) return;

      try {
        const response = await fetch(`/api/db/ams-player-data?academyId=${user.academyId}`);
        if (!response.ok) throw new Error("Failed to fetch players");

        const result = await response.json();
        if (result.success) {
          setPlayers(result.data);
        }
      } catch (error) {
        console.error("Error fetching players:", error);
        toast({
          title: "Error",
          description: "Failed to load players",
          variant: "destructive",
        });
      }
    };

    fetchPlayers();
  }, [user?.academyId]);

  // Add helper function to check if coach owns the batch
  const isCoachOwner = (batch: any) => {
    return batch.createdBy === user?.id || batch.coachId === user?.id;
  };

  const handleDeleteBatch = async (batchId: string) => {
    const batch = localBatches.find(b => b._id === batchId);
    if (!batch || !isCoachOwner(batch)) {
      toast({
        title: "Permission Denied",
        description: "You can only delete batches that you created",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!window.confirm("Are you sure you want to permanently delete this batch? This action cannot be undone.")) {
        console.log("Deletion cancelled by user");
        return;
      }

      console.log("Starting deletion for batch:", batchId);
      
      const response = await fetch(`/api/db/ams-batches/${batchId}`, {
        method: "DELETE"
      });

      console.log("Server response:", response.status);

      // Try to parse response as JSON
      let result;
      try {
        result = await response.json();
        console.log("Server response data:", result);
      } catch (e) {
        console.log("No JSON response received");
      }

      if (!response.ok) {
        throw new Error(
          result?.error || 
          `Failed to delete batch (Status: ${response.status})`
        );
      }

      // Remove from local state
      console.log("Removing batch from local state");
      setLocalBatches((prev) => {
        const filtered = prev.filter((batch) => batch._id !== batchId);
        console.log("Batches remaining:", filtered.length);
        return filtered;
      });

      // Clear selected batch if it was deleted
      if (selectedBatch?._id === batchId) {
        console.log("Clearing selected batch");
        setSelectedBatch(null);
      }

      toast({
        title: "Success",
        description: "Batch deleted successfully",
      });
    } catch (error) {
      console.error("Error during batch deletion:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete batch",
        variant: "destructive",
      });
    }
  };

  const handleAddPlayers = async (batchId: string) => {
    try {
      const response = await fetch(`/api/db/ams-batches/${batchId}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: selectedPlayers })
      });

      if (!response.ok) throw new Error("Failed to add players to batch");

      const result = await response.json();
      if (result.success) {
        setBatchPlayers(prev => ({
          ...prev,
          [batchId]: [...(prev[batchId] || []), ...players.filter(p => selectedPlayers.includes(p.id))]
        }));
        setSelectedPlayers([]);
        toast({
          title: "Success",
          description: "Players added successfully",
        });
      }
    } catch (error) {
      console.error("Error adding players:", error);
      toast({
        title: "Error",
        description: "Failed to add players",
        variant: "destructive",
      });
    }
  };

  const handleSelectAllPlayers = (checked: boolean) => {
    setAllPlayersSelected(checked);
    if (checked) {
      setSelectedPlayers(players.map(player => player.id));
    } else {
      setSelectedPlayers([]);
    }
  };

  const refetchAllBatchData = async () => {
    try {
      // Fetch all batches
      const batchesResponse = await fetch(`/api/db/ams-batches?academyId=${user?.academyId}`);
      const batchesResult = await batchesResponse.json();
      
      if (batchesResult.success) {
        const batches = batchesResult.data;
        setLocalBatches(batches);
        
        // Fetch players for each batch
        await Promise.all(batches.map(async (batch: any) => {
          // Fetch players
          const playersResponse = await fetch(`/api/db/ams-batches/${batch._id}/players`);
          const playersResult = await playersResponse.json();
          if (playersResult.success) {
            setBatchPlayers(prev => ({
              ...prev,
              [batch._id]: playersResult.data
            }));
          }
        }));
      }
    } catch (error) {
      console.error("Error refetching batch data:", error);
      toast({
        title: "Error",
        description: "Failed to refresh batch data",
        variant: "destructive",
      });
    }
  };

  const handleCreateBatch = async () => {
    if (!newBatchName.trim()) {
      setBatchNameError("Batch name is mandatory");
      return;
    }
    setBatchNameError("");

    try {
      if (!user?.academyId || !user?.id || !user?.name) {
        toast({
          title: "Error",
          description: "Missing required information",
          variant: "destructive",
        });
        return;
      }

      const batchData = {
        name: newBatchName.trim(),
        coachIds: [user.id], // Only current coach
        coachNames: [user.name], // Only current coach name
        players: selectedPlayers.filter(pid => pid.startsWith('player_')),
        academyId: user.academyId,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        status: 'active',
        coachName: user.name
      };

      console.log("Creating batch with data:", batchData);

      const response = await fetch('/api/db/ams-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create batch');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create batch');
      }

      // Instead of manually updating state, refetch all data
      await refetchAllBatchData();
      
      // Set the newly created batch as selected
      const newBatch = result.data;
      setSelectedBatch(newBatch);

      // Reset form
      setNewBatchName("");
      setSelectedPlayers([]);
      setIsCreateDialogOpen(false);

      toast({
        title: "Success",
        description: "Batch created successfully",
        variant: "default",
      });

    } catch (error) {
      console.error('Error creating batch:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create batch",
        variant: "destructive",
      });
    }
  };

  const handleEditBatch = async () => {
    if (!editingBatch?._id || !user?.id || !user?.name) return;
    
    if (!newBatchName.trim()) {
      setBatchNameError("Batch name is mandatory");
      return;
    }
    setBatchNameError("");

    try {
      // Always include the current coach in the update
      const batchData = {
        name: newBatchName.trim(),
        players: selectedPlayers.filter(pid => pid.startsWith('player_')),
        coachIds: [user.id], // Ensure current coach remains assigned
        coachNames: [user.name], // Keep coach name
        coachName: user.name, // Maintain single coach name for display
        updatedAt: new Date().toISOString()
      };

      const response = await fetch(`/api/db/ams-batches/${editingBatch._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update batch');
      }

      // First close the dialog
      setIsEditDialogOpen(false);

      // Then refetch data and reset form state
      await refetchAllBatchData();
      setNewBatchName("");
      setSelectedPlayers([]);
      setEditingBatch(null);

      toast({
        title: "Success",
        description: "Batch updated successfully",
      });
    } catch (error) {
      console.error('Error updating batch:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update batch",
        variant: "destructive",
      });
    }
  };

  const handleStartEdit = (batch: any) => {
    if (!isCoachOwner(batch)) {
      toast({
        title: "Permission Denied",
        description: "You can only edit batches that you created",
        variant: "destructive",
      });
      return;
    }
    setEditingBatch(batch);
    setNewBatchName(batch.name);
    setSelectedPlayers(batch.players || []);
    setIsEditDialogOpen(true);
  };

  const handleViewPlayerDetails = async (playerId: string) => {
    try {
      const response = await fetch(`/api/db/batch-player-details/${playerId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch player details: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to load player details");
      }

      // Format the data for display and calculate ratings
      const playerData = {
        ...result.data,
        attributes: {
          shooting: result.data.attributes?.shooting || 0,
          pace: result.data.attributes?.pace || 0,
          positioning: result.data.attributes?.positioning || 0,
          passing: result.data.attributes?.passing || 0,
          ballControl: result.data.attributes?.ballControl || 0,
          crossing: result.data.attributes?.crossing || 0
        },
        overallRating: calculateOverallRating(result.data.attributes)*10,
        averagePerformance: calculateAveragePerformance(result.data)
      };

      setSelectedPlayerDetails(playerData);
      setIsPlayerDetailsOpen(true);
    } catch (error) {
      console.error("Error fetching player details:", error);
      toast({
        title: "Error",
        description: "Failed to load player details",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Loading Batches...</h2>
              <p className="text-muted-foreground">Please wait while we fetch your batches</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-8 pt-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Batches</h1>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            Create New Batch
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {localBatches.map(batch => (
                    <div
                      key={batch._id}
                      onClick={() => setSelectedBatch(batch)}
                      className={cn(
                        "p-4 border rounded-lg hover:bg-accent cursor-pointer",
                        selectedBatch?._id === batch._id ? "bg-accent" : ""
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">{batch.name}</h3>
                        {isCoachOwner(batch) && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(batch);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBatch(batch._id);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Coach: {batch.coachName}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {selectedBatch ? `${selectedBatch.name} Details` : "Select a Batch"}
              </CardTitle>
              {selectedBatch && isCoachOwner(selectedBatch) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartEdit(selectedBatch)}
                >
                  Edit Batch
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {selectedBatch ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Coaches</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBatch.coachNames?.map((coachName: string, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{coachName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Separator className="my-4" />
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Players</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Position</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchPlayers[selectedBatch.id]?.map((player: any) => (
                          <TableRow key={player.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={player.photoUrl} />
                                  <AvatarFallback>{player.name[0]}</AvatarFallback>
                                </Avatar>
                                {player.name}
                              </div>
                            </TableCell>
                            <TableCell>{player.position}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewPlayerDetails(player.id)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Select a batch to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Batch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Batch Name</Label>
                <Input
                  value={newBatchName}
                  onChange={(e) => {
                    setNewBatchName(e.target.value);
                    setBatchNameError("");
                  }}
                  placeholder="Enter batch name"
                />
                {batchNameError && (
                  <p className="text-red-500 text-sm mt-1">{batchNameError}</p>
                )}
              </div>

              <div>
                <Label>Players</Label>
                <div className="border rounded-md p-4">
                  <div className="mb-2 pb-2 border-b">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={allPlayersSelected}
                        onCheckedChange={handleSelectAllPlayers}
                      />
                      <Label>Select All Players</Label>
                    </div>
                  </div>
                  <ScrollArea className="h-[200px]">
                    {players.map((player) => (
                      <div key={player.id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          checked={selectedPlayers.includes(player.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPlayers(prev => [...prev, player.id]);
                            } else {
                              setSelectedPlayers(prev => prev.filter(id => id !== player.id));
                              setAllPlayersSelected(false);
                            }
                          }}
                        />
                        <span>{player.name}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateBatch}>Create Batch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Batch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Batch Name</Label>
                <Input
                  value={newBatchName}
                  onChange={(e) => {
                    setNewBatchName(e.target.value);
                    setBatchNameError("");
                  }}
                  placeholder="Enter batch name"
                />
                {batchNameError && (
                  <p className="text-red-500 text-sm mt-1">{batchNameError}</p>
                )}
              </div>

              <div>
                <Label>Players</Label>
                <div className="border rounded-md p-4">
                  <div className="mb-2 pb-2 border-b">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={allPlayersSelected}
                        onCheckedChange={handleSelectAllPlayers}
                      />
                      <Label>Select All Players</Label>
                    </div>
                  </div>
                  <ScrollArea className="h-[200px]">
                    {players.map((player) => (
                      <div key={player.id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          checked={selectedPlayers.includes(player.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPlayers(prev => [...prev, player.id]);
                            } else {
                              setSelectedPlayers(prev => prev.filter(id => id !== player.id));
                              setAllPlayersSelected(false);
                            }
                          }}
                        />
                        <span>{player.name}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleEditBatch}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPlayerDetailsOpen} onOpenChange={setIsPlayerDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Player Details</DialogTitle>
            </DialogHeader>
            {selectedPlayerDetails && (
              <div className="space-y-6 p-4">
                <div className="flex items-center gap-4 border-b pb-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={selectedPlayerDetails.photoUrl} />
                    <AvatarFallback>{selectedPlayerDetails.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedPlayerDetails.name}</h2>
                    <p className="text-muted-foreground text-lg">{selectedPlayerDetails.position}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Performance Ratings</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                        <span className="text-muted-foreground">Overall Rating</span>
                        <span className="text-2xl font-bold">{selectedPlayerDetails.overallRating}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-secondary/50 rounded-lg">
                        <span className="text-muted-foreground">Average Performance</span>
                        <span className="text-2xl font-bold">{selectedPlayerDetails.averagePerformance}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Attributes</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(selectedPlayerDetails.attributes).map(([key, value]) => (
                        <div key={key} className="bg-secondary/50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground capitalize">{key}</div>
                          <div className="text-2xl font-semibold">{Number(value).toFixed(1)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}