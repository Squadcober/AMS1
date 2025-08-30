"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePlayers } from "@/contexts/PlayerContext"
import { useAuth } from "@/contexts/AuthContext"
import Image from "next/image"
import { useToast } from "@/components/ui/use-toast"
import { FileText, Trash2, Upload, Eye } from "lucide-react"

const STORAGE_KEY = 'player-injuries-data'
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface InjuryRehabProps {
  playerData: any;  // Add proper type definition if available
}

interface Injury {
  id: string
  _id?: string
  type: string
  date: string
  treatment: string
  poc: string
  status: string
  xrayImages: string[]
  prescription: string
  otherDocs: string[]
  userId?: string
  academyId?: string
  pdfFiles?: {
    name: string;
    url: string;
  }[];
  certificationUrl?: string;
  certificateUrl?: string;
}

export default function InjuryRehab({ playerData }: InjuryRehabProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const { players, getPlayerByUserId, updatePlayerAttributes } = usePlayers()
  const [isLoading, setIsLoading] = useState(true)
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingInjury, setEditingInjury] = useState<Injury | null>(null)
  const [newInjury, setNewInjury] = useState<Partial<Injury>>({
    type: "",
    date: "",
    treatment: "",
    poc: "",
    status: "",
    xrayImages: ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
    prescription: "/placeholder.svg",
    otherDocs: []
  })
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null)
  const [showPdfDialog, setShowPdfDialog] = useState(false)
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [selectedInjuryIndex, setSelectedInjuryIndex] = useState<number>(0);
  const [showViewOptions, setShowViewOptions] = useState(false);
  const [currentViewInjury, setCurrentViewInjury] = useState<Injury | null>(null);
  const [showXrayViewer, setShowXrayViewer] = useState(false);
  const [showImageEnlarged, setShowImageEnlarged] = useState(false);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string>("");
  const [enlargedImageTitle, setEnlargedImageTitle] = useState<string>("");

  useEffect(() => {
    const loadPlayerData = async () => {
      if (user?.username && user?.academyId) {
        try {
          const playerResponse = await fetch(
            `/api/db/ams-player-data?academyId=${user.academyId}`,
            { credentials: 'include' }
          );

          if (!playerResponse.ok) throw new Error('Failed to fetch player data');

          const playerResult = await playerResponse.json();
          if (playerResult.success && playerResult.data) {
            const playerMatch = playerResult.data.find(
              (player: any) => player.username === user.username || player.userId === user.username
            );

            if (playerMatch) {
              setIsLoading(false);
            } else {
              console.error("No matching player found for username:", user.username);
              toast({
                title: "Error",
                description: "Player profile not found",
                variant: "destructive",
              });
              setIsLoading(false);
            }
          }
        } catch (error) {
          console.error("Error loading player data:", error);
          toast({
            title: "Error",
            description: "Failed to load player data",
            variant: "destructive",
          });
          setIsLoading(false);
        }
      }
    };

    loadPlayerData();
  }, [user?.username, user?.academyId]);

  useEffect(() => {
    const fetchInjuries = async () => {
      if (!user?.username || !user?.academyId) return;

      try {
        const response = await fetch(
          `/api/db/ams-injury?playerId=${user.username}&academyId=${user.academyId}`,
          { credentials: 'include' }
        );

        if (!response.ok) throw new Error('Failed to fetch injuries');

        const result = await response.json();
        if (result.success) {
          setInjuries(result.data);
        }
      } catch (error) {
        console.error('Error fetching injuries:', error);
        toast({
          title: "Error",
          description: "Failed to load injury data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchInjuries();
    }
  }, [user]);

  const compressImage = async (base64String: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.src = base64String;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        let width = img.width;
        let height = img.height;
        const maxDimension = 800;
        
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const saveInjuriesToStorage = (injuries: Injury[]) => {
    if (!user?.id) return;
    
    try {
      const allStoredInjuries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const otherInjuries = allStoredInjuries.filter((injury: Injury) => 
        injury.userId !== user.id
      );
      
      const injuriesWithUser = injuries.map(injury => ({
        ...injury,
        userId: user.id,
        academyId: user?.academyId,
        id: injury.id || Date.now().toString()
      }));

      const dataToStore = JSON.stringify([...otherInjuries, ...injuriesWithUser]);
      
      try {
        localStorage.setItem(STORAGE_KEY, dataToStore);
      } catch (e) {
        if (typeof e === "object" && e !== null && "name" in e && (e as any).name === 'QuotaExceededError') {
          const mostRecentInjury = injuriesWithUser[injuriesWithUser.length - 1];
          localStorage.setItem(STORAGE_KEY, JSON.stringify([mostRecentInjury]));
          
          setInjuries([mostRecentInjury]);
          
          toast({
            title: "Warning",
            description: "Storage limit reached. Only keeping most recent injury.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error saving to storage:', error);
      toast({
        title: "Error",
        description: "Failed to save data",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (type: "xray" | "prescription" | "other", imageIndex = 0) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type === "prescription" ? ".pdf" : "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !user?.username || !user?.academyId) return;
  
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Error",
          description: `File size exceeds the limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          variant: "destructive",
        });
        return;
      }

      // Convert file to base64 for immediate preview and storage
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        if (type === "xray") {
          // Update the xray images in the current injury being edited
          setNewInjury(prev => {
            const newXrayImages = [...(prev.xrayImages || ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"])];
            newXrayImages[imageIndex] = base64;
            return {
              ...prev,
              xrayImages: newXrayImages
            };
          });
        } else if (type === "prescription") {
          // Update the prescription in the current injury being edited
          setNewInjury(prev => ({
            ...prev,
            prescription: base64
          }));
        }

        toast({
          title: "Success",
          description: `${type === "prescription" ? "Prescription" : "X-ray image"} uploaded successfully`
        });
      };

      if (type === "prescription") {
        reader.readAsDataURL(file);
      } else {
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handlePrescriptionUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !user?.username || !user?.academyId) return;
  
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Error",
          description: `File size exceeds the limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          variant: "destructive",
        });
        return;
      }
  
      // Convert PDF file to base64 for storage
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        // Update the prescription in the current injury being edited
        setNewInjury(prev => ({
          ...prev,
          prescription: base64
        }));
        
        toast({
          title: "Success",
          description: "Prescription uploaded successfully"
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };
  
  const refreshInjuries = async () => {
    if (!user?.username || !user?.academyId) return;
    
    try {
      const response = await fetch(
        `/api/db/ams-injury?playerId=${user.username}&academyId=${user.academyId}`,
        { credentials: 'include' }
      );
  
      if (!response.ok) throw new Error('Failed to fetch injuries');
  
      const result = await response.json();
      if (result.success) {
        setInjuries(result.data);
      }
    } catch (error) {
      console.error('Error refreshing injuries:', error);
    }
  };
  
  const handleEditInjury = (injury: Injury) => {
    setEditingInjury(injury)
    setNewInjury({
      ...injury,
      xrayImages: Array.isArray(injury.xrayImages)
        ? [
            injury.xrayImages[0] || "/placeholder.svg",
            injury.xrayImages[1] || "/placeholder.svg",
            injury.xrayImages[2] || "/placeholder.svg"
          ]
        : ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
      prescription: injury.prescription || "/placeholder.svg",
      otherDocs: injury.otherDocs || [],
      pdfFiles: injury.pdfFiles || []
    })
    setIsEditDialogOpen(true)
  }

  const handleCreateNewInjury = () => {
    setEditingInjury(null)
    setNewInjury({
      type: "",
      date: "",
      treatment: "",
      poc: "",
      status: "",
      xrayImages: ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
      prescription: "/placeholder.svg",
      otherDocs: []
    })
    setIsEditDialogOpen(true)
  }

  const saveInjury = async (injury: Partial<Injury>) => {
    try {
      const method = injury._id ? 'PUT' : 'POST';
      const payload = {
        ...injury,
        playerId: user?.username,
        academyId: user?.academyId,
        xrayImages: injury.xrayImages && injury.xrayImages.length === 3
          ? injury.xrayImages
          : ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
        prescription: injury.prescription || "/placeholder.svg",
        pdfFiles: injury.pdfFiles || []
      };

      console.log('Saving injury with payload:', payload);

      const response = await fetch('/api/db/ams-injury', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save injury');
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error saving injury:', error);
      throw error;
    }
  };

  const handleSaveInjury = async () => {
    try {
      if (!user?.username || !user?.academyId) return;

      const injuryToSave = {
        ...newInjury,
        _id: editingInjury?._id,
        playerId: user.username,
        academyId: user.academyId,
        xrayImages: newInjury.xrayImages && newInjury.xrayImages.length === 3
          ? newInjury.xrayImages
          : ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
        prescription: newInjury.prescription || "/placeholder.svg",
        pdfFiles: newInjury.pdfFiles || []
      };

      const result = await saveInjury(injuryToSave);

      if (result) {
        // Instead of just refreshing, update the injuries state directly for edit
        if (editingInjury?._id) {
          setInjuries(prev =>
            prev.map(inj =>
              inj._id === editingInjury._id
                ? { ...inj, ...injuryToSave }
                : inj
            )
          );
        } else {
          // For new injury, refresh from server (to get _id and server fields)
          await refreshInjuries();
        }
        setIsEditDialogOpen(false);
        toast({
          title: "Success",
          description: `Injury ${editingInjury ? "updated" : "added"} successfully`,
        });
      }
    } catch (error) {
      if (error && (error as any).message) {
        console.error('Error saving injury:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save injury",
          variant: "destructive",
        });
      }
      setIsEditDialogOpen(false);
    }
  };

  const handlePdfUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || !user?.username || !user?.academyId) return;
  
      const filesArray = Array.from(files);
      const oversizedFiles = filesArray.filter(file => file.size > MAX_FILE_SIZE);
      
      if (oversizedFiles.length > 0) {
        toast({
          title: "Error",
          description: `Some files exceed the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
        });
        return;
      }
  
      try {
        const formData = new FormData();
        filesArray.forEach(file => formData.append('files', file));
        formData.append('data', JSON.stringify({
          playerId: user.username,
          academyId: user.academyId,
          type: 'pdf',
          injuryId: injuries[0]?._id
        }));
  
        const response = await fetch('/api/db/ams-injury', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
  
        if (!response.ok) throw new Error('Failed to upload PDFs');
  
        const result = await response.json();
        if (result.success) {
          await refreshInjuries();
          
          toast({
            title: "Success",
            description: "PDFs uploaded successfully"
          });
        }
      } catch (error) {
        console.error('Error uploading PDFs:', error);
        toast({
          title: "Error",
          description: "Failed to upload PDFs",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  const handleViewPdf = (pdfUrl: string) => {
    if (!pdfUrl) {
      toast({
        title: "Error",
        description: "No certificate URL found",
        variant: "destructive",
      });
      return;
    }
    
    if (!pdfUrl.startsWith('data:application/pdf;base64,')) {
      if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
        window.open(pdfUrl, '_blank');
        return;
      }
      pdfUrl = `data:application/pdf;base64,${pdfUrl}`;
    }
    
    setSelectedPdfUrl(pdfUrl);
    setShowPdfViewer(true);
  };

  const handleDeletePdf = (indexToDelete: number) => {
    setInjuries((prevInjuries) => {
      const newInjuries = [...prevInjuries];
      const injury = { ...newInjuries[0] };
      
      injury.pdfFiles = injury.pdfFiles?.filter((_, index) => index !== indexToDelete);
      newInjuries[0] = injury;
      
      saveInjuriesToStorage(newInjuries);
      
      toast({
        title: "Success",
        description: "PDF deleted successfully",
      });

      return newInjuries;
    });
  };

  const handleDelete = async (id: string, type: 'image' | 'pdf' | 'injury', index?: number) => {
    try {
      const queryParams = new URLSearchParams({
        id,
        type,
        ...(index !== undefined && { index: index.toString() })
      });

      const response = await fetch(
        `/api/db/ams-injury?${queryParams.toString()}`,
        { 
          method: 'DELETE',
          credentials: 'include'
        }
      );

      if (!response.ok) throw new Error('Failed to delete item');

      const result = await response.json();
      if (result.success) {
        if (type === 'injury') {
          setInjuries(prev => prev.filter(i => i._id !== id));
        } else if (type === 'image') {
          setInjuries(prev => 
            prev.map(injury => 
              injury._id === id 
                ? {
                    ...injury,
                    xrayImages: injury.xrayImages.map((img, i) => 
                      i === index ? '/placeholder.svg' : img
                    )
                  }
                : injury
            )
          );
        } else if (type === 'pdf') {
          setInjuries(prev =>
            prev.map(injury =>
              injury._id === id
                ? {
                    ...injury,
                    pdfFiles: injury.pdfFiles?.filter((_, i) => i !== index)
                  }
                : injury
            )
          );
        }

        toast({
          title: "Success",
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`,
        });
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const deleteInjury = async (injuryId: string) => {
    if (!injuryId) return;
    try {
      const response = await fetch(`/api/db/ams-injury?id=${injuryId}&type=injury`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete injury");
      }
      setInjuries(prev => prev.filter(i => i._id !== injuryId));
      toast({
        title: "Success",
        description: "Injury deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting injury:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete injury",
        variant: "destructive"
      });
    }
  };

  const handleViewCertificate = (injury: Injury) => {
    setCurrentViewInjury(injury);
    setShowViewOptions(true);
  };

  const handleViewXray = () => {
    setShowViewOptions(false);
    setShowXrayViewer(true);
  };

  const handleViewPrescription = () => {
    setShowViewOptions(false);
    if (currentViewInjury?.prescription && currentViewInjury.prescription !== "/placeholder.svg") {
      handleViewPdf(currentViewInjury.prescription);
    } else {
      toast({
        title: "Error",
        description: "No prescription available",
        variant: "destructive",
      });
    }
  };

  const handleImageClick = (imageUrl: string, title: string) => {
    if (imageUrl && imageUrl !== "/placeholder.svg") {
      setEnlargedImageUrl(imageUrl);
      setEnlargedImageTitle(title);
      setShowImageEnlarged(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-2xl font-bold">Loading player data...</div>
          <div className="text-muted-foreground">Please wait while we fetch your information</div>
        </div>
      </div>
    );
  }

  if (!playerData) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-2xl font-bold text-destructive">No player data found</div>
          <div className="text-muted-foreground">
            This could be because:
            <ul className="list-disc list-inside mt-2">
              <li>Your account is not properly linked to a player profile</li>
              <li>You don't have the correct permissions</li>
              <li>There was an error loading your data</li>
            </ul>
          </div>
          <Button 
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Retry Loading
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Injury and Rehab</h2>
        <Button 
          onClick={handleCreateNewInjury}
          className="bg-[#85FFC4] text-black hover:bg-[#85FFC4]/80"
        >
          Add New Injury
        </Button>
      </div>

      {injuries.length > 1 && (
        <div className="flex gap-2 mb-4">
          {injuries.map((injury, idx) => (
            <Button
              key={injury._id || injury.id || idx}
              variant={selectedInjuryIndex === idx ? "default" : "outline"}
              className={selectedInjuryIndex === idx ? "bg-[#85FFC4] text-black" : ""}
              onClick={() => setSelectedInjuryIndex(idx)}
              size="sm"
            >
              {injury.type || `Injury ${idx + 1}`}
            </Button>
          ))}
        </div>
      )}

      {injuries[selectedInjuryIndex]?.pdfFiles && injuries[selectedInjuryIndex].pdfFiles.length > 0 && (
        <Card className="bg-[#1a1f2b] border-none">
          <CardContent className="p-4">
            <h3 className="text-white font-semibold mb-4">PDF Documents</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {injuries[selectedInjuryIndex].pdfFiles.map((pdf, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-accent rounded-lg"
                >
                  <Button
                    variant="ghost"
                    className="flex-1 flex items-center justify-start space-x-2 hover:bg-transparent"
                    onClick={() => handleViewPdf(pdf.url)}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="truncate">{pdf.name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleDeletePdf(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#1a1f2b] border-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-[#85FFC4]">
              <TableRow>
                <TableHead className="text-black">Injury</TableHead>
                <TableHead className="text-black">Date</TableHead>
                <TableHead className="text-black">Treatment</TableHead>
                <TableHead className="text-black">POC</TableHead>
                <TableHead className="text-black">Status</TableHead>
                <TableHead className="text-black">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {injuries.map((injury, index) => (
                <TableRow key={injury.id || index} className={selectedInjuryIndex === index ? "bg-accent" : ""}>
                  <TableCell
                    className="text-white cursor-pointer underline"
                    onClick={() => setSelectedInjuryIndex(index)}
                  >
                    {injury.type}
                  </TableCell>
                  <TableCell className="text-white">{injury.date}</TableCell>
                  <TableCell className="text-white">{injury.treatment}</TableCell>
                  <TableCell className="text-white">{injury.poc}</TableCell>
                  <TableCell className="text-white">{injury.status}</TableCell>
                  <TableCell className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditInjury(injury)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewCertificate(injury)}
                    >
                      View Documents
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteInjury(injury._id || injury.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit/Add Injury Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingInjury ? "Edit Injury" : "Add New Injury"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label htmlFor="type">Injury Type</Label>
              <Input
                id="type"
                value={newInjury.type}
                onChange={(e) => setNewInjury(prev => ({ ...prev, type: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={newInjury.date}
                onChange={(e) => setNewInjury(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="treatment">Treatment</Label>
              <Input
                id="treatment"
                value={newInjury.treatment}
                onChange={(e) => setNewInjury(prev => ({ ...prev, treatment: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="poc">Point of Contact</Label>
              <Input
                id="poc"
                value={newInjury.poc}
                onChange={(e) => setNewInjury(prev => ({ ...prev, poc: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={newInjury.status}
                onValueChange={(value) => setNewInjury(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Recovering">Recovering</SelectItem>
                  <SelectItem value="Recovered">Recovered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* X-ray Images Upload Section */}
            <div className="space-y-3">
              <Label>X-ray Images</Label>
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((imageIndex) => (
                  <div key={imageIndex} className="space-y-2">
                    <div 
                      className="relative aspect-square w-full bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleImageClick(
                        newInjury.xrayImages?.[imageIndex] || "/placeholder.svg",
                        `X-ray ${imageIndex + 1}`
                      )}
                    >
                      <Image
                        src={newInjury.xrayImages?.[imageIndex] || "/placeholder.svg"}
                        alt={`X-ray ${imageIndex + 1}`}
                        fill
                        style={{ objectFit: 'contain' }}
                        className="rounded-lg"
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleImageUpload("xray", imageIndex)}
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        Upload
                      </Button>
                      {newInjury.xrayImages?.[imageIndex] !== '/placeholder.svg' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setNewInjury(prev => ({
                              ...prev,
                              xrayImages: prev.xrayImages?.map((img, i) => 
                                i === imageIndex ? '/placeholder.svg' : img
                              )
                            }));
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prescription Upload Section */}
            <div className="space-y-3">
              <Label>Prescription</Label>
              <div className="space-y-2">
                <div 
                  className="relative aspect-[4/3] w-full max-w-md bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => handleImageClick(
                    newInjury.prescription || "/placeholder.svg",
                    "Prescription"
                  )}
                >
                  <Image
                    src={newInjury.prescription || "/placeholder.svg"}
                    alt="Prescription"
                    fill
                    style={{ objectFit: 'contain' }}
                    className="rounded-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleImageUpload("prescription")}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Prescription PDF
                  </Button>
                  {newInjury.prescription !== '/placeholder.svg' && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setNewInjury(prev => ({
                          ...prev,
                          prescription: '/placeholder.svg'
                        }));
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveInjury}>
              {editingInjury ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Options Dialog */}
      <Dialog open={showViewOptions} onOpenChange={setShowViewOptions}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>View Documents</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={handleViewXray}
            >
              <Eye className="w-4 h-4 mr-2" />
              View X-ray Images
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={handleViewPrescription}
            >
              <FileText className="w-4 h-4 mr-2" />
              View Prescription
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* X-ray Images Viewer Dialog */}
      <Dialog open={showXrayViewer} onOpenChange={setShowXrayViewer}>
        <DialogContent className="max-w-6xl w-full h-[90vh]">
          <DialogHeader>
            <DialogTitle>X-ray Images - {currentViewInjury?.type}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(90vh-8rem)] overflow-y-auto">
            {currentViewInjury?.xrayImages?.map((image, index) => (
              <div key={index} className="space-y-2">
                <div 
                  className="relative aspect-square w-full bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => handleImageClick(image || "/placeholder.svg", `X-ray ${index + 1}`)}
                >
                  <Image
                    src={image || "/placeholder.svg"}
                    alt={`X-ray ${index + 1}`}
                    fill
                    style={{ objectFit: 'contain' }}
                    className="rounded-lg"
                  />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  X-ray {index + 1}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Enlargement Dialog */}
      <Dialog open={showImageEnlarged} onOpenChange={setShowImageEnlarged}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] w-[95vw] h-[95vh] p-4">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl">{enlargedImageTitle}</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-[calc(95vh-6rem)] flex items-center justify-center bg-gray-50 rounded-lg">
            <Image
              src={enlargedImageUrl}
              alt={enlargedImageTitle}
              fill
              style={{ objectFit: 'contain' }}
              className="rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer Dialog */}
      <Dialog open={showPdfViewer} onOpenChange={setShowPdfViewer}>
        <DialogContent className="max-w-4xl w-full h-[90vh]">
          <DialogHeader>
            <DialogTitle>PDF Viewer</DialogTitle>
          </DialogHeader>
          {selectedPdfUrl && (
            <div className="w-full h-[calc(90vh-6rem)] bg-white rounded-lg overflow-hidden">
              <embed
                src={selectedPdfUrl}
                type="application/pdf"
                width="100%"
                height="100%"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}