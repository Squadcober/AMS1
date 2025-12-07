"use client"

import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useState, useEffect, ChangeEvent } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { FileInput } from "@/components/ui/custom-file-input"
import { Badge } from "@/components/ui/badge"
import { CustomTooltip } from "@/components/custom-tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { format } from "date-fns"

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return format(date, "PPP");
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

interface Achievement {
  _id: string;
  title: string;
  description: string;
  date: string;
  type: 'Tournament' | 'Award' | 'Milestone' | 'Certification' | 'Other';
  location?: string;
  playerId: string;
  academyId: string;
  certificationUrl?: string;
  certificateUrl?: string;
  certificateFile?: File | null;
  createdAt: string;
  mediaUrls?: string[];
}

const getFileType = (url: string) => {
  if (!url) return 'unknown';
  
  try {
    // For base64 encoded files
    if (url.startsWith('data:application/pdf')) return 'pdf';
    if (url.startsWith('data:image')) return 'image';
    
    // Parse URL to check if it's valid
    new URL(url);

    // Check for common file extensions and content types
    if (url.includes('.pdf') || url.includes('application/pdf')) return 'pdf';
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
    
    // Additional check for blob URLs that might be PDFs
    if (url.startsWith('blob:')) return 'pdf';
    
    return 'url';
  } catch (e) {
    console.error('Error parsing URL:', e);
    return 'unknown';
  }
};

export default function Achievements() {
  const { user, isLoading: authLoading } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAchievement, setNewAchievement] = useState<{
    title: string;
    description: string;
    type: 'Tournament' | 'Award' | 'Milestone' | 'Certification' | 'Other';
    date: string;
    location: string;
    certificationUrl: string;
  }>({
    title: '',
    description: '',
    type: 'Tournament',
    date: new Date().toISOString().split('T')[0],
    location: '',
    certificationUrl: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    console.log('Auth state:', { user, authLoading });
  }, [user, authLoading]);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        setLoading(true);
        setError("");

        if (!user?.username || !user?.academyId) {
          setError("User information not found. Please log in again.");
          return;
        }

        // Fetch player data to get the correct playerId
        const playerResponse = await fetch(
          `/api/db/ams-player-data?academyId=${encodeURIComponent(user.academyId)}&username=${encodeURIComponent(user.username)}`,
          { credentials: "include" }
        );

        if (!playerResponse.ok) {
          throw new Error("Failed to fetch player data");
        }

        const playerResult = await playerResponse.json();
        if (!playerResult.success || !playerResult.data?.[0]) {
          throw new Error("Player data not found");
        }

        const playerId = playerResult.data[0].id; // Use the correct playerId
        console.log("Fetched playerId:", playerId);

        // Fetch achievements using the correct playerId
        const response = await fetch(
          `/api/db/ams-achievement?playerId=${encodeURIComponent(playerId)}&academyId=${encodeURIComponent(user.academyId)}`,
          { credentials: "include" }
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error("API Error Response:", errorData);
          throw new Error(errorData.error || "Failed to fetch achievements");
        }

        const result = await response.json();
        console.log("Achievements response:", result);

        if (!result.success) {
          throw new Error(result.error || "Failed to fetch achievements");
        }

        setAchievements(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        console.error("Error loading achievements:", error);
        setError(error instanceof Error ? error.message : "Failed to load achievements");
        setAchievements([]);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchAchievements();
    }
  }, [user?.username, user?.academyId, authLoading]);

  if (authLoading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Loading...</h2>
            <p className="text-muted-foreground">Please wait while we load your profile</p>
          </div>
        </div>
      </div>
    );
  }

  if (!authLoading && !user) {
    return (
      <div className="flex h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2 text-red-500">Authentication Error</h2>
            <p className="text-muted-foreground">Please try logging in again</p>
          </div>
        </div>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast({
        title: "Error",
        description: "Please select a PDF file",
        variant: "destructive",
      });
    }
  };

  const handleCreateAchievement = async () => {
    try {
      console.log('Starting achievement creation with user:', user);

      if (!user?.username || !user?.academyId) {
        console.error('Missing user data:', user);
        toast({
          title: "Authentication Error",
          description: "Please log in before creating an achievement",
          variant: "destructive",
        });
        return;
      }

      // Validate required fields
      if (!newAchievement.title || !newAchievement.type || !newAchievement.date) {
        console.error('Missing required fields:', newAchievement);
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      const formData = new FormData();
      const achievementData = {
        ...newAchievement,
        playerId: user.username,
        academyId: user.academyId,
        createdAt: new Date().toISOString(),
      };

      console.log('Sending achievement data:', achievementData);
      formData.append('data', JSON.stringify(achievementData));

      if (selectedFile) {
        console.log('Attaching file:', selectedFile.name);
        formData.append('certificate', selectedFile);
      }

      console.log('Sending POST request to /api/db/ams-achievement');
      const response = await fetch('/api/db/ams-achievement', {
        method: 'POST',
        body: formData,
      });

      console.log('Received response:', response.status);
      const result = await response.json();
      console.log('Response data:', result);

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create achievement');
      }

      // Reset form first
      setNewAchievement({
        title: '',
        description: '',
        type: 'Tournament',
        date: new Date().toISOString().split('T')[0],
        location: '',
        certificationUrl: ''
      });
      setSelectedFile(null);
      setIsDialogOpen(false);

      // Then update the UI
      const updatedAchievements = [...achievements, result.data];
      setAchievements(updatedAchievements);
      
      toast({
        title: "Success",
        description: "Achievement created successfully",
      });

    } catch (error) {
      console.error('Error creating achievement:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create achievement",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAchievement = async (achievementId: string) => {
    try {
      const response = await fetch(`/api/db/ams-achievement/${achievementId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete achievement');

      setAchievements(prev => prev.filter(achievement => achievement._id !== achievementId));
      
      toast({
        title: "Success",
        description: "Achievement deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting achievement:', error);
      toast({
        title: "Error",
        description: "Failed to delete achievement",
        variant: "destructive",
      });
    }
  };

  const handleViewCertificate = (url: string | undefined) => {
    if (!url) {
      toast({
        title: "Error",
        description: "No certificate URL found",
        variant: "destructive",
      });
      return;
    }

    try {
      let pdfUrl = url;
      
      // Check if it's already a base64 PDF
      if (!url.startsWith('data:application/pdf;base64,')) {
        // Clean the base64 string if needed
        const base64Data = url.replace(/^data:application\/pdf;base64,/, '');
        pdfUrl = `data:application/pdf;base64,${base64Data}`;
      }

      // Validate base64 content
      try {
        atob(pdfUrl.split(',')[1]);
      } catch (e) {
        console.error('Invalid base64 data:', e);
        throw new Error('Invalid PDF data');
      }

      setSelectedPdfUrl(pdfUrl);
      setShowPdfViewer(true);
    } catch (error) {
      console.error('Error processing PDF:', error);
      toast({
        title: "Error",
        description: "Failed to load PDF. Invalid format.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="flex flex-col space-y-4">
        <div className="flex">
          <h1 className="text-3xl font-bold">Achievements</h1>
        </div>

        {loading ? (
          <div className="flex">
            <p>Loading achievements...</p>
          </div>
        ) : error ? (
          <div className="flex">
            <p className="text-red-500">{error}</p>
          </div>
        ) : achievements.length === 0 ? (
          <p className="pl-1">No achievements found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pl-1">
            {achievements.map((achievement) => (
              <Card 
                key={achievement._id} 
                className="bg-card hover:bg-accent cursor-pointer transition-colors"
                onClick={() => {
                  setSelectedAchievement(achievement);
                  setIsViewerOpen(true);
                }}
              >
                <CardHeader>
                  <CardTitle>{achievement.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{achievement.description}</p>
                  <div className="mt-4 space-y-2">
                    <div className="text-sm">Type: {achievement.type}</div>
                    <div className="text-sm">Date: {formatDate(achievement.date)}</div>
                    {achievement.location && (
                      <div className="text-sm">Location: {achievement.location}</div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAchievement(achievement._id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                  {achievement.certificateUrl || achievement.certificationUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleViewCertificate(
                          achievement.certificateUrl || achievement.certificationUrl
                        )
                      }
                    >
                      View Certificate
                    </Button>
                  ) : (
                    <span className="text-gray-400 text-sm">No Certificate Uploaded</span>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Achievement Viewer Dialog */}
        <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
          <DialogContent className="max-w-4xl h-[90vh]" aria-describedby="achievement-viewer">
            <DialogHeader>
              <DialogTitle>{selectedAchievement?.title}</DialogTitle>
            </DialogHeader>
            <div id="achievement-viewer" className="grid gap-4 py-4 h-full overflow-hidden">
              <div className="space-y-2">
                <p><strong>Type:</strong> {selectedAchievement?.type}</p>
                <p><strong>Date:</strong> {selectedAchievement ? formatDate(selectedAchievement.date) : ''}</p>
                {selectedAchievement?.location && (
                  <p><strong>Location:</strong> {selectedAchievement.location}</p>
                )}
                <p className="mt-4">{selectedAchievement?.description}</p>
              </div>
              {(selectedAchievement?.certificateUrl || selectedAchievement?.certificationUrl) && (
                <div className="flex-1 min-h-0">
                  <h3 className="font-semibold mb-2">Certificate</h3>
                  <div className="h-[calc(90vh-250px)] overflow-hidden border rounded">
                    {(() => {
                      const url = selectedAchievement.certificateUrl || selectedAchievement.certificationUrl;
                      const fileType = getFileType(url || '');

                      switch (fileType) {
                        case 'pdf':
                          return (
                            <div className="w-full h-full flex items-center justify-center">
                              <Button 
                                onClick={() => handleViewCertificate(url)}
                                className="px-8 py-4 text-lg"
                              >
                                View Certificate
                              </Button>
                            </div>
                          );
                        case 'image':
                          return (
                            <div className="w-full h-full flex items-center justify-center bg-black/5">
                              <img
                                src={url}
                                alt="Certificate"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                          );
                        case 'url':
                          return (
                            <div className="w-full h-full">
                              <iframe
                                src={url}
                                className="w-full h-full"
                                title="Web Content"
                                sandbox="allow-scripts allow-same-origin allow-popups"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            </div>
                          );
                        default:
                          return (
                            <div className="w-full h-full flex items-center justify-center">
                              <p>Invalid certificate URL</p>
                            </div>
                          );
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setIsViewerOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PDF Viewer Dialog */}
        <Dialog open={showPdfViewer} onOpenChange={setShowPdfViewer}>
          <DialogContent className="max-w-4xl w-full h-[90vh]">
            <DialogHeader>
              <DialogTitle>Certificate Viewer</DialogTitle>
            </DialogHeader>
            <div className="w-full h-[calc(90vh-8rem)] bg-white rounded-lg overflow-hidden">
              {selectedPdfUrl && (
                <object
                  data={selectedPdfUrl}
                  type="application/pdf"
                  className="w-full h-full"
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <Button 
                      onClick={() => window.open(selectedPdfUrl, '_blank')}
                      className="px-8 py-4"
                    >
                      Open PDF in new tab
                    </Button>
                  </div>
                </object>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowPdfViewer(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex">
          <Button onClick={() => setIsDialogOpen(true)}>Add Achievement</Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Achievement</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newAchievement.title}
                  onChange={(e) => setNewAchievement(prev => ({
                    ...prev,
                    title: e.target.value
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select 
                  value={newAchievement.type}
                  onValueChange={(value) => setNewAchievement(prev => ({
                    ...prev,
                    type: value as 'Tournament' | 'Award' | 'Milestone' | 'Certification' | 'Other'
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tournament">Tournament</SelectItem>
                    <SelectItem value="Award">Award</SelectItem>
                    <SelectItem value="Milestone">Milestone</SelectItem>
                    <SelectItem value="Certification">Certification</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={newAchievement.date}
                  onChange={(e) => setNewAchievement(prev => ({
                    ...prev,
                    date: e.target.value
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newAchievement.location}
                  onChange={(e) => setNewAchievement(prev => ({
                    ...prev,
                    location: e.target.value
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newAchievement.description}
                  onChange={(e) => setNewAchievement(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="certificationUrl">Certificate URL (Optional)</Label>
                <Input
                  id="certificationUrl"
                  value={newAchievement.certificationUrl}
                  onChange={(e) => setNewAchievement(prev => ({
                    ...prev,
                    certificationUrl: e.target.value
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="certificate">Certificate (PDF)</Label>
                <Input
                  id="certificate"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="mt-2"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected file: {selectedFile.name}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateAchievement}>
                Save Achievement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}