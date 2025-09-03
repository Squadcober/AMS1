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
  const [batchCoaches, setBatchCoaches] = useState<{ [batchId: string]: any[] }>({})
  const [selectedBatch, setSelectedBatch] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isPlayerDetailsOpen, setIsPlayerDetailsOpen] = useState(false)
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState<any>(null)
  const [newBatchName, setNewBatchName] = useState("")
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [coaches, setCoaches] = useState<any[]>([])
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([])
  const [isCoachDetailsOpen, setIsCoachDetailsOpen] = useState(false)
  const [selectedCoachDetails, setSelectedCoachDetails] = useState<any>(null)
  const [batchNameError, setBatchNameError] = useState("")
  const [allCoachesSelected, setAllCoachesSelected] = useState(false)
  const [allPlayersSelected, setAllPlayersSelected] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<any>(null)
  const [isCreatingBatch, setIsCreatingBatch] = useState(false)
  const [isEditingBatch, setIsEditingBatch] = useState(false)

  useEffect(() => {
    const fetchBatches = async () => {
      if (!user?.academyId) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/db/ams-batches?academyId=${user.academyId}`);
        if (!response.ok) throw new Error("Failed to fetch batches");

        const result = await response.json();
        if (result.success) {
          setLocalBatches(result.data);
        }
      } catch (error) {
        console.error("Error fetching batches:", error);
        toast({
          title: "Error",
          description: "Failed to load batches",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatches();
  }, [user?.academyId]);

  useEffect(() => {
  const fetchBatchPlayers = async (batchId: string) => {
    try {
      // First get the batch data to access player IDs
      const batch = localBatches.find(b => b._id === batchId);
      if (!batch?.players?.length) {
        console.log("No player IDs found for batch:", batchId);
        setBatchPlayers(prev => ({ ...prev, [batchId]: [] }));
        return;
      }

      console.log("Fetching players for batch:", batchId, "Player IDs:", batch.players);

      // Fetch detailed player data for each player ID
      const playerPromises = batch.players.map(async (playerId: string) => {
        try {
          // Use the same endpoint pattern as settings page
          const response = await fetch(`/api/db/batch-player-details/${playerId}`);
          
          if (!response.ok) {
            console.log(`Failed to fetch player with ID: ${playerId}`);
            return null;
          }

          const result = await response.json();
          if (result.success && result.data) {
            // Calculate age from DOB if available
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

            // Format the player data consistently
            return {
              id: result.data.id || playerId,
              name: result.data.name || "Unknown Player",
              position: result.data.position || "N/A",
              secondaryPosition: result.data.secondaryPosition || "",
              age: result.data.age || calculateAge(result.data.dob || ""),
              gender: result.data.gender || "",
              height: result.data.height || "",
              weight: result.data.weight || "",
              photoUrl: result.data.photoUrl || "",
              email: result.data.email || "",
              primaryGuardian: result.data.primaryGuardian || "",
              secondaryGuardian: result.data.secondaryGuardian || "",
              primaryPhone: result.data.primaryPhone || "",
              secondaryPhone: result.data.secondaryPhone || "",
              address: result.data.address || "",
              bloodGroup: result.data.bloodGroup || "",
              enrollmentDate: result.data.enrollmentDate || "",
              strongFoot: result.data.strongFoot || "",
              hasDisability: Boolean(result.data.hasDisability),
              disabilityType: result.data.disabilityType || "",
              status: result.data.status || "Active",
              attributes: result.data.attributes || {},
              performanceHistory: result.data.performanceHistory || [],
              dob: result.data.dob || ""
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching player ${playerId}:`, error);
          return null;
        }
      });

      const playerResults = await Promise.all(playerPromises);
      const validPlayers = playerResults.filter(Boolean);

      console.log("Found players:", validPlayers);

      setBatchPlayers(prev => ({
        ...prev,
        [batchId]: validPlayers
      }));

    } catch (error) {
      console.error("Error fetching batch players:", error);
      setBatchPlayers(prev => ({ ...prev, [batchId]: [] }));
    }
  };

  if (selectedBatch?._id) {
    fetchBatchPlayers(selectedBatch._id);
  }
}, [selectedBatch, localBatches]);


  useEffect(() => {
    const fetchBatchCoaches = async (batchId: string) => {
      try {
        const batch = localBatches.find(b => b._id === batchId);
        if (!batch?.coachIds?.length) {
          console.log("No coach IDs found for batch:", batchId);
          setBatchCoaches(prev => ({ ...prev, [batchId]: [] }));
          return;
        }

        console.log("Fetching coaches for batch:", batchId, "Coach IDs:", batch.coachIds);

        // Fetch coach details for each coachId
        const coachPromises = batch.coachIds.map(async (coachId: string) => {
          try {
            // First try to get user details if ID starts with user_
            if (coachId.startsWith('user_')) {
              const userResponse = await fetch(`/api/db/ams-users/${coachId}`);
              const userData = await userResponse.json();
              
              if (userData.success) {
                // Also fetch coach profile data
                const coachResponse = await fetch(`/api/db/coach-profile/${coachId}`);
                const coachData = await coachResponse.json();
                
                return {
                  id: coachId,
                  name: userData.data?.name || userData.data?.username || "Unknown Coach",
                  email: userData.data?.email,
                  photoUrl: userData.data?.photoUrl,
                  ...coachData.data // Merge coach profile data
                };
              }
            }

            // Fallback to coaches collection
            const response = await fetch(`/api/db/ams-coaches/${coachId}`);
            if (!response.ok) {
              console.log(`Failed to fetch coach with ID: ${coachId}`);
              return null;
            }

            const result = await response.json();
            return result.success ? result.data : null;

          } catch (error) {
            console.error(`Error fetching coach ${coachId}:`, error);
            return null;
          }
        });

        const coachResults = await Promise.all(coachPromises);
        const validCoaches = coachResults.filter(Boolean);

        console.log("Found coaches:", validCoaches);

        setBatchCoaches(prev => ({
          ...prev,
          [batchId]: validCoaches
        }));

      } catch (error) {
        console.error("Error fetching batch coaches:", error);
        setBatchCoaches(prev => ({ ...prev, [batchId]: [] }));
      }
    };

    if (selectedBatch?._id) {
      fetchBatchCoaches(selectedBatch._id);
    }
  }, [selectedBatch, localBatches]);

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

  useEffect(() => {
    const fetchCoaches = async () => {
      if (!user?.academyId) return;

      try {
        const response = await fetch(`/api/db/ams-users?academyId=${user.academyId}&role=coach`);
        if (!response.ok) throw new Error("Failed to fetch coaches");

        const result = await response.json();
        if (result.success) {
          setCoaches(result.data || []); // Ensure we're accessing the data property
        } else {
          throw new Error(result.error || "Failed to fetch coaches");
        }
      } catch (error) {
        console.error("Error fetching coaches:", error);
        toast({
          title: "Error",
          description: "Failed to load coaches",
          variant: "destructive",
        });
      }
    };

    fetchCoaches();
  }, [user?.academyId]);

  const handleDeleteBatch = async (batchId: string) => {
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

  const handleSelectAllCoaches = (checked: boolean) => {
    setAllCoachesSelected(checked);
    if (checked) {
      setSelectedCoaches(coaches.map(coach => coach._id));
    } else {
      setSelectedCoaches([]);
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
        
        // Fetch players and coaches for each batch
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

          // Fetch coaches
          if (batch.coachIds?.length) {
            const coachPromises = batch.coachIds.map(async (coachId: string) => {
              if (coachId.startsWith('user_')) {
                const userResponse = await fetch(`/api/db/ams-users/${coachId}`);
                const userData = await userResponse.json();
                
                if (userData.success) {
                  const coachResponse = await fetch(`/api/db/coach-profile/${coachId}`);
                  const coachData = await coachResponse.json();
                  
                  return {
                    id: coachId,
                    name: userData.data?.name || userData.data?.username || "Unknown Coach",
                    email: userData.data?.email,
                    photoUrl: userData.data?.photoUrl,
                    ...coachData.data
                  };
                }
              }
              return null;
            });

            const coachResults = await Promise.all(coachPromises);
            const validCoaches = coachResults.filter(Boolean);

            setBatchCoaches(prev => ({
              ...prev,
              [batch._id]: validCoaches
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
  // Add validation at the start of the function
  if (!newBatchName.trim()) {
    setBatchNameError("Batch name is mandatory");
    return;
  }
  setBatchNameError("");

  try {
    setIsCreatingBatch(true); // Start loading

    if (!user?.academyId || !user?.id) {
      toast({
        title: "Error",
        description: "Missing required information",
        variant: "destructive",
      });
      return;
    }

    // Map selected coach IDs to coach user data
    const selectedCoachData = coaches
      .filter(coach => selectedCoaches.includes(coach._id))
      .map(coach => ({
        id: coach.id || coach.userId, // Use the user_ ID
        name: coach.name,
      }));

    // Only use player ids that start with 'player_'
    const filteredPlayerIds = selectedPlayers.filter(pid => pid.startsWith('player_'));

    const batchData = {
      name: newBatchName.trim(),
      coachIds: selectedCoachData.map(c => c.id), // Use only the user IDs
      coachNames: selectedCoachData.map(c => c.name), // Store names separately
      players: filteredPlayerIds, // Only player_ ids
      academyId: user.academyId,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      status: 'active'
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
    setSelectedCoaches([]);
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
  } finally {
    setIsCreatingBatch(false); // Stop loading
  }
};


  const handleEditBatch = async () => {
  if (!editingBatch?._id) return;
  
  if (!newBatchName.trim()) {
    setBatchNameError("Batch name is mandatory");
    return;
  }
  setBatchNameError("");

  try {
    setIsEditingBatch(true); // Start loading

    // Map selected coach IDs to coach user data
    const selectedCoachData = coaches
      .filter(coach => selectedCoaches.includes(coach._id))
      .map(coach => ({
        id: coach.id || coach.userId,
        name: coach.name,
      }));

    const batchData = {
      name: newBatchName.trim(),
      coachIds: selectedCoachData.map(c => c.id),
      coachNames: selectedCoachData.map(c => c.name),
      players: selectedPlayers.filter(pid => pid.startsWith('player_'))
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
    setSelectedCoaches([]);
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
  } finally {
    setIsEditingBatch(false); // Stop loading
  }
};

  const handleStartEdit = (batch: any) => {
    setEditingBatch(batch);
    setNewBatchName(batch.name);
    setSelectedCoaches(batch.coachIds || []);
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

    // Calculate age from DOB if available
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

    // Format date for display
    const formatDate = (dateString: string): string => {
      if (!dateString) return "Not specified";
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid date";
      return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
    };

    // Format the essential player data only - mapping actual database fields
    const playerData = {
      id: result.data.id || result.data.pid,
      name: result.data.name || "Unknown Player",
      position: result.data.position || result.data.primaryPosition || "Not specified",
      photoUrl: result.data.photoUrl || "",
      
      // Basic Information
      dob: formatDate(result.data.dob),
      gender: result.data.gender || "Not specified",
      strongFoot: result.data.strongFoot || "Not specified",
      age: result.data.age || calculateAge(result.data.dob || ""),
      
      // Physical Stats
      height: result.data.height ? `${result.data.height} cm` : "Not specified",
      weight: result.data.weight ? `${result.data.weight} kg` : "Not specified",
      
      // Medical Info
      bloodGroup: result.data.bloodGroup || "Not specified",
      hasDisability: result.data.hasDisability || false,
      disabilityType: result.data.disabilityType || "",
      injuryStatus: result.data.status === 'active' ? "Fit" : "Injured", // Map from status field
      
      // Performance data (keep for the performance tab)
      attributes: result.data.attributes || {
        Attack: 0,
        pace: 0,
        Physicality: 0,
        Defense: 0,
        passing: 0,
        Technique: 0
      },
      overallRating: result.data.overallRating || (calculateOverallRating(result.data.attributes) * 10),
      averagePerformance: result.data.averagePerformance || calculateAveragePerformance(result.data)
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



  const handleViewCoachDetails = async (coachId: string) => {
    try {
      const userResponse = await fetch(`/api/db/ams-users/${coachId}`);
      const userData = await userResponse.json();
      
      const coachResponse = await fetch(`/api/db/coach-profile/${coachId}`);
      const coachData = await coachResponse.json();
      
      // Calculate average rating
      let averageRating = 0;
      const ratings = coachData.data?.ratings || [];
      if (ratings.length > 0) {
        averageRating = ratings.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / ratings.length;
      }

      // Get only the 3 most recent ratings, sorted by date in descending order
      const recentRatings = [...ratings]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);

      // Combine the data with calculated fields
      const combinedData = {
        ...userData.data,
        ...coachData.data,
        averageRating: averageRating.toFixed(1),
        ratingsCount: ratings.length,
        recentReviews: recentRatings,
        sessionsCount: coachData.data?.sessionsCount || 0
      };

      setSelectedCoachDetails(combinedData);
      setIsCoachDetailsOpen(true);
    } catch (error) {
      console.error("Error fetching coach details:", error);
      toast({
        title: "Error",
        description: "Failed to load coach details",
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
              {selectedBatch && (
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
                          <TableHead>Email</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchCoaches[selectedBatch._id]?.map((coach: any) => (
                          <TableRow key={coach.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={coach.photoUrl} />
                                  <AvatarFallback>{coach.name?.[0]}</AvatarFallback>
                                </Avatar>
                                {coach.name}
                              </div>
                            </TableCell>
                            <TableCell>{coach.email}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewCoachDetails(coach.id)}
                              >
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Separator className="my-4" />
                  <div>
  <h3 className="text-lg font-semibold mb-4">Players</h3>
  {batchPlayers[selectedBatch._id]?.length > 0 ? (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Position</TableHead>
          <TableHead>Age</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {batchPlayers[selectedBatch._id].map((player: any) => (
          <TableRow key={player.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={player.photoUrl} />
                  <AvatarFallback>{player.name?.[0] || 'P'}</AvatarFallback>
                </Avatar>
                {player.name}
              </div>
            </TableCell>
            <TableCell className="capitalize">{player.position}</TableCell>
            <TableCell>{player.age} years</TableCell>
            <TableCell>
              <span className={`px-2 py-1 rounded-full text-xs ${
                player.status === 'Active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {player.status}
              </span>
            </TableCell>
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
  ) : (
    <div className="text-center py-8 text-muted-foreground">
      <p>No players found in this batch</p>
    </div>
  )}
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
                <Label>Assign Coaches</Label>
                <div className="border rounded-md p-4">
                  <div className="mb-2 pb-2 border-b">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={allCoachesSelected}
                        onCheckedChange={handleSelectAllCoaches}
                      />
                      <Label>Select All Coaches</Label>
                    </div>
                  </div>
                  <ScrollArea className="h-[150px]">
                    {coaches.map((coach) => (
                      <div key={coach._id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          checked={selectedCoaches.includes(coach._id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCoaches(prev => [...prev, coach._id]);
                            } else {
                              setSelectedCoaches(prev => prev.filter(id => id !== coach._id));
                              setAllCoachesSelected(false);
                            }
                          }}
                        />
                        <div className="flex flex-col">
                          <span>{coach.name || coach.email}</span>
                          <span className="text-sm text-muted-foreground">{coach.email}</span>
                        </div>
                      </div>
                    ))}
                    {coaches.length === 0 && (
                      <div className="text-center text-muted-foreground py-2">
                        No coaches available
                      </div>
                    )}
                  </ScrollArea>
                </div>
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
  <Button 
    onClick={handleCreateBatch}
    disabled={isCreatingBatch}
  >
    {isCreatingBatch ? "Creating..." : "Create Batch"}
  </Button>
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
                <Label>Assign Coaches</Label>
                <div className="border rounded-md p-4">
                  <div className="mb-2 pb-2 border-b">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={allCoachesSelected}
                        onCheckedChange={handleSelectAllCoaches}
                      />
                      <Label>Select All Coaches</Label>
                    </div>
                  </div>
                  <ScrollArea className="h-[150px]">
                    {coaches.map((coach) => (
                      <div key={coach._id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          checked={selectedCoaches.includes(coach._id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCoaches(prev => [...prev, coach._id]);
                            } else {
                              setSelectedCoaches(prev => prev.filter(id => id !== coach._id));
                              setAllCoachesSelected(false);
                            }
                          }}
                        />
                        <div className="flex flex-col">
                          <span>{coach.name || coach.email}</span>
                          <span className="text-sm text-muted-foreground">{coach.email}</span>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
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
  <Button 
    onClick={handleEditBatch}
    disabled={isEditingBatch}
  >
    {isEditingBatch ? "Saving..." : "Save Changes"}
  </Button>
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
                selectedPlayerDetails.injuryStatus === 'Fit' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                <span className="text-sm font-medium">
                  {selectedPlayerDetails.injuryStatus}
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
                    <p className="font-medium">{selectedPlayerDetails.dob}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Gender</Label>
                    <p className="font-medium capitalize">{selectedPlayerDetails.gender}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Strong Foot</Label>
                    <p className="font-medium capitalize">{selectedPlayerDetails.strongFoot}</p>
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
                    <p className="font-medium">{selectedPlayerDetails.height}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Weight</Label>
                    <p className="font-medium">{selectedPlayerDetails.weight}</p>
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
                </CardContent>
              </Card>
            </div>
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
                    <p className="font-medium">{selectedPlayerDetails.bloodGroup}</p>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Injury Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Current Status</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-3 h-3 rounded-full ${
                        selectedPlayerDetails.injuryStatus === 'Fit' 
                          ? 'bg-green-500' 
                          : 'bg-red-500'
                      }`}></div>
                      <p className="font-medium">{selectedPlayerDetails.injuryStatus}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    )}
  </DialogContent>
</Dialog>

        <Dialog open={isCoachDetailsOpen} onOpenChange={setIsCoachDetailsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Coach Details</DialogTitle>
            </DialogHeader>
            {selectedCoachDetails && (
              <div className="space-y-6 p-4" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                <div className="flex items-center gap-4 border-b pb-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={selectedCoachDetails.photoUrl} />
                    <AvatarFallback>{selectedCoachDetails.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{selectedCoachDetails.name}</h2>
                    <p className="text-muted-foreground text-lg">Coach</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="text-3xl font-bold">{selectedCoachDetails.averageRating}</div>
                      <div className="text-muted-foreground">
                        Based on {selectedCoachDetails.ratingsCount} ratings
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Personal Info</h3>
                    <div className="space-y-4">
                      <div className="p-3 bg-secondary/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">Age</div>
                        <div className="text-lg font-semibold">{selectedCoachDetails.age || 'N/A'}</div>
                      </div>
                      <div className="p-3 bg-secondary/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">License/Certification</div>
                        <div className="text-lg font-semibold">{selectedCoachDetails.license || 'N/A'}</div>
                      </div>
                      <div className="p-3 bg-secondary/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">About</div>
                        <div className="text-lg">{selectedCoachDetails.about || 'No information available'}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-4">Recent Reviews</h3>
                    <div className="space-y-4">
                      {selectedCoachDetails.recentReviews?.map((review: any, index: number) => (
                        <div key={index} className="p-3 bg-secondary/50 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-semibold">
                              {review.studentName || 'Anonymous Student'}
                            </div>
                            <div className="text-lg font-bold">{review.rating}/5</div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(review.date).toLocaleDateString()}
                          </div>
                          {review.comment && (
                            <div className="mt-2 text-sm">{review.comment}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Training Sessions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold mb-2">{selectedCoachDetails.sessionsCount}</div>
                      <p className="text-muted-foreground">
                        Completed training sessions across all batches
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
