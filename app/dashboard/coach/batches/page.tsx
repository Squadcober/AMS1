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
    attributes.Attack || 0,
    attributes.pace || 0,
    attributes.Physicality || 0,
    attributes.Defense || 0,
    attributes.passing || 0,
    attributes.Technique || 0
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
  const [playerInjuries, setPlayerInjuries] = useState<any[]>([])
  const [newBatchName, setNewBatchName] = useState("")
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<any>(null)
  const [batchNameError, setBatchNameError] = useState("")
  const [allPlayersSelected, setAllPlayersSelected] = useState(false)
  const [showPdfViewer, setShowPdfViewer] = useState(false)
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null)
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("")
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>("")
  const [currentViewInjury, setCurrentViewInjury] = useState<any>(null)
  const [showViewOptions, setShowViewOptions] = useState(false)
  const [showXrayViewer, setShowXrayViewer] = useState(false)

  useEffect(() => {
    const fetchBatchesForCoach = async () => {
      if (!user?.academyId || !user?.id) return;

      try {
        setIsLoading(true);

        // Fetch all batches for the academy
        const batchesRes = await fetch(`/api/db/ams-batches?academyId=${user.academyId}`);
        if (!batchesRes.ok) throw new Error("Failed to fetch batches");
        const batchesJson = await batchesRes.json();
        const allBatches = Array.isArray(batchesJson.data) ? batchesJson.data : [];

        // Filter batches to only those where the current user is assigned as a coach
        const filteredBatches = allBatches.filter((batch: any) => {
          // Check if user ID is in coachIds array
          if (Array.isArray(batch.coachIds) && batch.coachIds.includes(user.id)) {
            return true;
          }
          
          // Also check legacy coachId field for backward compatibility
          if (batch.coachId === user.id) {
            return true;
          }
          
          // Check if user created the batch
          if (batch.createdBy === user.id) {
            return true;
          }
          
          return false;
        });

        console.log("Filtered batches for coach:", filteredBatches);
        setLocalBatches(filteredBatches);
      } catch (error) {
        console.error("Error fetching batches for coach:", error);
        toast({
          title: "Error",
          description: "Failed to load batches",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatchesForCoach();
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
    // Check if user created the batch
    if (batch.createdBy === user?.id) return true;
    
    // Check if user is in coachIds array
    if (Array.isArray(batch.coachIds) && batch.coachIds.includes(user?.id)) return true;
    
    // Check legacy coachId field
    if (batch.coachId === user?.id) return true;
    
    return false;
  };

  const handleDeleteBatch = async (batchId: string) => {
    const batch = localBatches.find(b => b._id === batchId);
    if (!batch || !isCoachOwner(batch)) {
      toast({
        title: "Permission Denied",
        description: "You can only delete batches that you created or are assigned to",
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
      // Fetch all batches for the academy
      const batchesResponse = await fetch(`/api/db/ams-batches?academyId=${user?.academyId}`);
      const batchesResult = await batchesResponse.json();
      
      if (batchesResult.success) {
        const allBatches = batchesResult.data;
        
        // Filter batches for the current coach
        const filteredBatches = allBatches.filter((batch: any) => {
          // Check if user ID is in coachIds array
          if (Array.isArray(batch.coachIds) && batch.coachIds.includes(user?.id)) {
            return true;
          }
          
          // Also check legacy coachId field for backward compatibility
          if (batch.coachId === user?.id) {
            return true;
          }
          
          // Check if user created the batch
          if (batch.createdBy === user?.id) {
            return true;
          }
          
          return false;
        });
        
        setLocalBatches(filteredBatches);
        
        // Fetch players for each batch
        await Promise.all(filteredBatches.map(async (batch: any) => {
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
        description: "You can only edit batches that you created or are assigned to",
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
          Attack: result.data.attributes?.Attack || 0,
          pace: result.data.attributes?.pace || 0,
          Physicality: result.data.attributes?.Physicality || 0,
          Defense: result.data.attributes?.Defense || 0,
          passing: result.data.attributes?.passing || 0,
          Technique: result.data.attributes?.Technique || 0
        },
        overallRating: calculateOverallRating(result.data.attributes)*10,
        averagePerformance: calculateAveragePerformance(result.data)
      };

      setSelectedPlayerDetails(playerData);

      // Fetch injuries for the player
      try {
        const injuriesResponse = await fetch(`/api/db/ams-injury?playerId=${playerId}&academyId=${user?.academyId}`);
        if (injuriesResponse.ok) {
          const injuriesResult = await injuriesResponse.json();
          console.log("Injuries API response:", injuriesResult);
          if (injuriesResult.success) {
            setPlayerInjuries(injuriesResult.data || []);
            console.log("Player injuries set:", injuriesResult.data);
          } else {
            setPlayerInjuries([]);
          }
        } else {
          console.error("Injuries API failed:", injuriesResponse.status);
          setPlayerInjuries([]);
        }
      } catch (injuriesError) {
        console.error("Error fetching injuries:", injuriesError);
        setPlayerInjuries([]);
      }

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

  // Handler functions for PDF and Image viewers
  const handleViewPdf = (pdfUrl: string) => {
    setSelectedPdfUrl(pdfUrl);
    setShowPdfViewer(true);
  };

  const handleClosePdfViewer = () => {
    setShowPdfViewer(false);
    setSelectedPdfUrl(null);
  };

  const handleViewImage = (imageUrl: string, title: string) => {
    setSelectedImageUrl(imageUrl);
    setSelectedImageTitle(title);
    setShowImageViewer(true);
  };

  const handleCloseImageViewer = () => {
    setShowImageViewer(false);
    setSelectedImageUrl("");
    setSelectedImageTitle("");
  };

  const handleViewInjuryDocuments = (injury: any) => {
    setCurrentViewInjury(injury);
    // Check if there are any documents to view
    const hasXrayImages = injury.xrayImages && injury.xrayImages.some((img: string) => img && img !== '/placeholder.svg');
    const hasPrescription = injury.prescription && injury.prescription !== '/placeholder.svg';
    const hasPdfFiles = injury.pdfFiles && injury.pdfFiles.length > 0;

    if (hasXrayImages || hasPrescription || hasPdfFiles) {
      setShowViewOptions(true);
    } else {
      toast({
        title: "No Documents Found",
        description: "No documents are available for this injury",
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
          <h1 className="text-3xl font-bold">My Batches</h1>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            Create New Batch
          </Button>
        </div>

        {localBatches.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">No Batches Found</h2>
            <p className="text-muted-foreground mb-4">
              You don't have any batches assigned to you yet.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              Create Your First Batch
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Assigned Batches</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <div className="flex gap-4 pb-4" style={{ overflowX: 'auto' }}>
                    {localBatches.map(batch => (
                      <div
                        key={batch._id}
                        onClick={() => setSelectedBatch(batch)}
                        className={cn(
                          "p-4 border rounded-lg hover:bg-accent cursor-pointer flex-shrink-0",
                          selectedBatch?._id === batch._id ? "bg-accent" : ""
                        )}
                        style={{ minWidth: '300px', maxWidth: '350px' }}
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
                        <p className="text-xs text-muted-foreground mt-1">
                          Players: {batch.players?.length || 0}
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
                          {batchPlayers[selectedBatch._id]?.map((player: any) => (
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
        )}

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <ScrollArea className="max-h-[80vh]">
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
            </ScrollArea>
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
                {/* Player Header Section */}
                <div className="flex items-center gap-6 border-b pb-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={selectedPlayerDetails.photoUrl} />
                    <AvatarFallback className="text-2xl">
                      {selectedPlayerDetails.name?.[0] || 'P'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold">{selectedPlayerDetails.name}</h2>
                    <p className="text-muted-foreground text-xl capitalize">
                      {selectedPlayerDetails.position}
                    </p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="bg-primary/10 px-3 py-1 rounded-full">
                        <span className="text-sm font-medium">
                          Age: {selectedPlayerDetails.age} years
                        </span>
                      </div>
                      <div className={`px-3 py-1 rounded-full ${
                        selectedPlayerDetails.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        <span className="text-sm font-medium">
                          {selectedPlayerDetails.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Tabs defaultValue="performance" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="personal">Personal Info</TabsTrigger>
                    <TabsTrigger value="medical">Medical Info</TabsTrigger>
                  </TabsList>

                  <TabsContent value="performance" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Performance Ratings */}
                      <div>
                        <h3 className="text-xl font-semibold mb-4">Performance Ratings</h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg">
                            <span className="text-muted-foreground font-medium">Overall Rating</span>
                            <span className="text-3xl font-bold text-primary">
                              {selectedPlayerDetails.overallRating}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-secondary/50 to-secondary/20 rounded-lg">
                            <span className="text-muted-foreground font-medium">Average Performance</span>
                            <span className="text-3xl font-bold">
                              {selectedPlayerDetails.averagePerformance}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Attributes */}
                      <div>
                        <h3 className="text-xl font-semibold mb-4">Player Attributes</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(selectedPlayerDetails.attributes).map(([key, value]) => (
                            <div key={key} className="bg-secondary/30 p-3 rounded-lg">
                              <div className="text-sm text-muted-foreground capitalize">{key}</div>
                              <div className="text-xl font-semibold">{Number(value).toFixed(1)}</div>
                              <div className="w-full bg-background rounded-full h-2 mt-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{ width: `${(Number(value) / 10) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="personal" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <Label className="text-sm text-muted-foreground">Date of Birth</Label>
                            <p className="font-medium">{selectedPlayerDetails.dob || "Not specified"}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Gender</Label>
                            <p className="font-medium capitalize">{selectedPlayerDetails.gender || "Not specified"}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Strong Foot</Label>
                            <p className="font-medium capitalize">{selectedPlayerDetails.strongFoot || "Not specified"}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Age</Label>
                            <p className="font-medium">{selectedPlayerDetails.age} years</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Physical Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <Label className="text-sm text-muted-foreground">Height</Label>
                            <p className="font-medium">{selectedPlayerDetails.height ? `${selectedPlayerDetails.height} cm` : "Not specified"}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Weight</Label>
                            <p className="font-medium">{selectedPlayerDetails.weight ? `${selectedPlayerDetails.weight} kg` : "Not specified"}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Playing Position</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <Label className="text-sm text-muted-foreground">Primary Position</Label>
                            <p className="font-medium capitalize">{selectedPlayerDetails.position}</p>
                          </div>
                          {selectedPlayerDetails.secondaryPosition && (
                            <div>
                              <Label className="text-sm text-muted-foreground">Secondary Position</Label>
                              <p className="font-medium capitalize">{selectedPlayerDetails.secondaryPosition}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Contact Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-sm text-muted-foreground">Email</Label>
                          <p className="font-medium">{selectedPlayerDetails.email || "Not specified"}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Address</Label>
                          <p className="font-medium">{selectedPlayerDetails.address || "Not specified"}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm text-muted-foreground">Primary Guardian</Label>
                            <p className="font-medium">{selectedPlayerDetails.primaryGuardian || "Not specified"}</p>
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Primary Phone</Label>
                            <p className="font-medium">{selectedPlayerDetails.primaryPhone || "Not specified"}</p>
                          </div>
                        </div>
                        {selectedPlayerDetails.secondaryGuardian && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm text-muted-foreground">Secondary Guardian</Label>
                              <p className="font-medium">{selectedPlayerDetails.secondaryGuardian}</p>
                            </div>
                            <div>
                              <Label className="text-sm text-muted-foreground">Secondary Phone</Label>
                              <p className="font-medium">{selectedPlayerDetails.secondaryPhone || "Not specified"}</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="medical" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Medical Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label className="text-sm text-muted-foreground">Blood Group</Label>
                            <p className="font-medium">{selectedPlayerDetails.bloodGroup || "Not specified"}</p>
                          </div>

                          <div>
                            <Label className="text-sm text-muted-foreground">Disability Status</Label>
                            <p className="font-medium">
                              {selectedPlayerDetails.hasDisability ? 'Yes' : 'No'}
                            </p>
                            {selectedPlayerDetails.hasDisability && selectedPlayerDetails.disabilityType && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Type: {selectedPlayerDetails.disabilityType}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label className="text-sm text-muted-foreground">Enrollment Date</Label>
                            <p className="font-medium">{selectedPlayerDetails.enrollmentDate || "Not specified"}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">Status Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <Label className="text-sm text-muted-foreground">Current Status</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <div className={`w-3 h-3 rounded-full ${
                                selectedPlayerDetails.status === 'Active'
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                              }`}></div>
                              <p className="font-medium">{selectedPlayerDetails.status}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Injury Status Section */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Injury Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {playerInjuries.length > 0 ? (
                          <div className="space-y-4">
                            <div className="text-sm text-muted-foreground mb-4">
                              Injury records found for this player:
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Injury</TableHead>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Treatment</TableHead>
                                  <TableHead>POC</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {playerInjuries.map((injury: any) => (
                                  <TableRow key={injury._id}>
                                    <TableCell>{injury.injuryType || injury.type || "Not specified"}</TableCell>
                                    <TableCell>{injury.date ? new Date(injury.date).toLocaleDateString() : "Not specified"}</TableCell>
                                    <TableCell>{injury.treatment || "Not specified"}</TableCell>
                                    <TableCell>{injury.poc || "Not specified"}</TableCell>
                                    <TableCell>{injury.status || "Not specified"}</TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleViewInjuryDocuments(injury)}
                                      >
                                        View Docs
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">
                              {selectedPlayerDetails.status === 'Active'
                                ? "Player is fit and active - no injury records"
                                : "No injury records found for this player"
                              }
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* PDF Viewer Dialog */}
        <Dialog open={showPdfViewer} onOpenChange={setShowPdfViewer}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Document Viewer</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-[600px]">
              {selectedPdfUrl && (
                <iframe
                  src={selectedPdfUrl}
                  className="w-full h-full border-0"
                  title="PDF Viewer"
                />
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClosePdfViewer}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Image Viewer Dialog */}
        <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{selectedImageTitle}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center items-center min-h-[400px]">
              {selectedImageUrl && (
                <img
                  src={selectedImageUrl}
                  alt={selectedImageTitle}
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleCloseImageViewer}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* X-ray Viewer Dialog */}
        <Dialog open={showXrayViewer} onOpenChange={setShowXrayViewer}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>X-ray Images</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {currentViewInjury?.xrayImages?.filter((img: string) => img && img !== '/placeholder.svg').map((imageUrl: string, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-2">X-ray Image {index + 1}</h4>
                  <img
                    src={imageUrl}
                    alt={`X-ray ${index + 1}`}
                    className="w-full max-h-96 object-contain rounded"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowXrayViewer(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Options Dialog */}
        <Dialog open={showViewOptions} onOpenChange={setShowViewOptions}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>View Documents</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {currentViewInjury?.xrayImages?.some((img: string) => img && img !== '/placeholder.svg') && (
                <Button
                  onClick={() => {
                    setShowViewOptions(false);
                    setShowXrayViewer(true);
                  }}
                  className="w-full"
                >
                  View X-ray Images
                </Button>
              )}
              {currentViewInjury?.prescription && currentViewInjury.prescription !== '/placeholder.svg' && (
                <Button
                  onClick={() => {
                    setShowViewOptions(false);
                    handleViewPdf(currentViewInjury.prescription);
                  }}
                  className="w-full"
                >
                  View Prescription
                </Button>
              )}
              {currentViewInjury?.pdfFiles?.length > 0 && (
                <div className="space-y-2">
                  <Label>Medical Reports</Label>
                  {currentViewInjury.pdfFiles.map((pdfUrl: string, index: number) => (
                    <Button
                      key={index}
                      onClick={() => {
                        setShowViewOptions(false);
                        handleViewPdf(pdfUrl);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      View Report {index + 1}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewOptions(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
