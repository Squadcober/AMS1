"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import Sidebar from "@/components/Sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "@/components/ui/use-toast"
import { FileUp } from "lucide-react"

interface playerInfo {
  pid: string
  name: string
  dob: string
  position: string
  secondaryPosition: string
  strongFoot: string
  enrollmentDate: string
  createdAt?: string
  height: string
  weight: string
  hasDisability: boolean
  disabilityType: string
  status: string
  school: string
  gender: string
  age: string
  bloodGroup: string
  primaryGuardian: string
  secondaryGuardian: string
  email: string
  primaryPhone: string
  secondaryPhone: string
  address: string
  personalInformation?: {
    pid: string
    name: string
    dob: string
    gender: string
    age: string
    enrollmentDate: string
    height: string
    weight: string
    school: string
    primaryGuardian: string
    secondaryGuardian: string
    email: string
    primaryPhone: string
    secondaryPhone: string
    address: string
    bloodGroup: string
  }
  photoUrl?: string;
}

const positions = [
  "Goalkeeper",
  "Center Back",
  "Right Back",
  "Left Back",
  "Defensive Midfielder",
  "Central Midfielder",
  "Attacking Midfielder",
  "Right Winger",
  "Left Winger",
  "Striker",
  "Forward"
]

export default function playerSettings() {
  const { user } = useAuth()
  const [playerInfo, setplayerInfo] = useState<playerInfo>({
    pid: "",
    name: "",
    dob: "",
    position: "",
    secondaryPosition: "",
    strongFoot: "",
    enrollmentDate: "",
    createdAt: "",
    height: "",
    weight: "",
    hasDisability: false,
    disabilityType: "",
    status: "Active",
    school: "",
    gender: "",
    age: "",
    bloodGroup: "",
    primaryGuardian: "",
    secondaryGuardian: "",
    email: "",
    primaryPhone: "",
    secondaryPhone: "",
    address: ""
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [canSave, setCanSave] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setCanSave(
      Boolean(user?.id) && 
      Boolean(user?.academyId) && 
      !isLoading && 
      !isSaving
    )
  }, [user?.id, user?.academyId, isLoading, isSaving])

  // Helper function to format date as YYYY-MM-DD
  function formatDate(dateString: string): string {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  }

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

  const loadplayerData = async () => {
    try {
      setIsLoading(true);

      if (!user?.username) {
        console.error("Missing username:", user?.username);
        throw new Error("Username is required");
      }

      console.log('Loading data for username:', user.username);

      // Fetch player data using the exact same endpoint as profile page
      const playerResponse = await fetch(
        `/api/db/ams-player-data/user/${encodeURIComponent(user.username)}`,
        { 
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      console.log('Player response status:', playerResponse.status);

      if (!playerResponse.ok) {
        const errorText = await playerResponse.text();
        console.error('Player fetch failed:', {
          status: playerResponse.status,
          statusText: playerResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to fetch player data: ${playerResponse.status}`);
      }

      const playerData = await playerResponse.json();
      console.log('Received player data:', playerData);

      if (!playerData) {
        throw new Error('No player data returned');
      }

      // Fetch academy data if academyId exists
      let academyName = "Academy not found";
      if (user.academyId) {
        try {
          const academyResponse = await fetch(
            `/api/db/ams-academy/${encodeURIComponent(user.academyId)}`,
            { 
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              }
            }
          );

          if (academyResponse.ok) {
            const academyResult = await academyResponse.json();
            academyName = academyResult.data?.name || academyName;
          }
        } catch (academyError) {
          console.warn('Failed to fetch academy data:', academyError);
        }
      }

      // Calculate age from DOB
      const calculatedAge = calculateAge(playerData.dob || "");

      // Set player info with proper data mapping
      setplayerInfo(prev => ({
        ...prev,
        pid: playerData.id || playerData.id || "",
        photoUrl: playerData.photoUrl || "",
        name: playerData.name || "",
        email: user.email || "",
        enrollmentDate: playerData.enrollmentDate 
          ? formatDate(playerData.enrollmentDate)
          : (playerData.createdAt ? formatDate(playerData.createdAt) : ''),
        dob: formatDate(playerData.dob || ""),
        age: calculatedAge.toString(),
        position: playerData.position || "",
        secondaryPosition: playerData.secondaryPosition || "",
        strongFoot: playerData.strongFoot || "",
        height: playerData.height?.toString() || "",
        weight: playerData.weight?.toString() || "",
        hasDisability: Boolean(playerData.hasDisability),
        disabilityType: playerData.disabilityType || "",
        status: playerData.status || "Active",
        school: academyName,
        gender: playerData.gender || "",
        bloodGroup: playerData.bloodGroup || "",
        primaryGuardian: playerData.primaryGuardian || "",
        secondaryGuardian: playerData.secondaryGuardian || "",
        primaryPhone: playerData.primaryPhone || "",
        secondaryPhone: playerData.secondaryPhone || "",
        address: playerData.address || "",
      }));

    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.username) {
      loadplayerData();
    }
  }, [user?.username]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      if (!user?.username) {
        throw new Error("Missing username");
      }

      setIsSaving(true);

      // Validate date of birth is not after current date
      const today = new Date();
      const dobDate = new Date(playerInfo.dob);
      if (dobDate > today) {
        throw new Error("Date of birth cannot be after the current date");
      }

      // Calculate age from DOB
      const calculatedAge = calculateAge(playerInfo.dob);

      // Prepare updates for PATCH request (your API expects $set structure)
      const updates = {
        name: playerInfo.name,
        email: user.email,
        photoUrl: playerInfo.photoUrl,
        position: playerInfo.position,
        secondaryPosition: playerInfo.secondaryPosition,
        strongFoot: playerInfo.strongFoot,
        dob: playerInfo.dob,
        age: calculatedAge,
        gender: playerInfo.gender,
        height: playerInfo.height,
        weight: playerInfo.weight,
        primaryGuardian: playerInfo.primaryGuardian,
        secondaryGuardian: playerInfo.secondaryGuardian,
        primaryPhone: playerInfo.primaryPhone,
        secondaryPhone: playerInfo.secondaryPhone,
        address: playerInfo.address,
        bloodGroup: playerInfo.bloodGroup,
        hasDisability: playerInfo.hasDisability,
        disabilityType: playerInfo.disabilityType,
        status: playerInfo.status,
        enrollmentDate: playerInfo.enrollmentDate,
        updatedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      console.log('Sending updates:', updates);

      // Use PATCH method to match your API route
      const response = await fetch(`/api/db/ams-player-data/user/${encodeURIComponent(user.username)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      console.log('Save response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Save failed:', errorData);
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const result = await response.json();
      console.log('Save result:', result);

      // Update age in local state
      setplayerInfo(prev => ({
        ...prev,
        age: calculatedAge.toString()
      }));

      toast({
        title: "Success",
        description: "Changes saved successfully"
      });

      setIsEditing(false);

    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save changes",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    loadplayerData(); // Reload original data
  };

  const handleDOBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDOB = e.target.value;
    const calculatedAge = calculateAge(newDOB);
    setplayerInfo(prev => ({
      ...prev,
      dob: newDOB,
      age: calculatedAge.toString()
    }));
  };

  const inputProps = {
    disabled: !isEditing,
    className: !isEditing ? "bg-muted cursor-not-allowed" : ""
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'primaryPhone' | 'secondaryPhone') => {
    const value = e.target.value;
    if (/^\d{0,10}$/.test(value)) {
      setplayerInfo(prev => ({ ...prev, [field]: value }));
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const photoUrl = reader.result as string;
        setplayerInfo(prev => ({
          ...prev,
          photoUrl
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2">Loading player data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-8">Player Settings</h1>

        <div className="space-y-6">
          <div className="flex justify-end space-x-4">
            {isEditing ? (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  size="lg"
                  onClick={handleSave}
                  disabled={!canSave || isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                onClick={handleEdit}
              >
                Edit
              </Button>
            )}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Profile Photo</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <div className="w-32 h-32 relative rounded-lg overflow-hidden bg-secondary">
                {playerInfo.photoUrl ? (
                  <img
                    src={playerInfo.photoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error("Image load error:", e);
                      e.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                    No photo
                  </div>
                )}
              </div>
              
              {isEditing && (
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 p-2 border-2 border-dashed rounded-lg hover:bg-secondary">
                    <FileUp className="h-4 w-4" />
                    <span>Upload new photo</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </CardContent>
          </Card>
          

          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="pid" className="flex items-center gap-2">
                  PID
                  <span className="text-xs text-muted-foreground">(System-assigned)</span>
                </Label>
                <Input
                  id="pid"
                  value={playerInfo.pid}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  Name
                  <span className="text-xs text-muted-foreground">(System-assigned)</span>
                </Label>
                <Input
                  id="name"
                  value={playerInfo.name}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={playerInfo.dob}
                  onChange={handleDOBChange}
                  max={new Date().toISOString().split('T')[0]}
                  {...inputProps}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={playerInfo.gender}
                  onValueChange={(value) => setplayerInfo(prev => ({ ...prev, gender: value }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger className={inputProps.className}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Primary Position</Label>
                <Select
                  value={playerInfo.position}
                  onValueChange={(value) => setplayerInfo(prev => ({ ...prev, position: value }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger className={inputProps.className}>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map(position => (
                      <SelectItem key={position} value={position.toLowerCase()}>
                        {position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryPosition">Secondary Position</Label>
                <Select
                  value={playerInfo.secondaryPosition}
                  onValueChange={(value) => setplayerInfo(prev => ({ ...prev, secondaryPosition: value }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger className={inputProps.className}>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map(position => (
                      <SelectItem key={position} value={position.toLowerCase()}>
                        {position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="strongFoot">Strong Foot</Label>
                <Select
                  value={playerInfo.strongFoot}
                  onValueChange={(value) => setplayerInfo(prev => ({ ...prev, strongFoot: value }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger className={inputProps.className}>
                    <SelectValue placeholder="Select foot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={playerInfo.status}
                  onValueChange={(value) => setplayerInfo(prev => ({ ...prev, status: value }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger className={inputProps.className}>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enrollmentDate">Enrollment Date</Label>
                <Input
                  id="enrollmentDate"
                  type="date"
                  value={playerInfo.enrollmentDate}
                  onChange={(e) => setplayerInfo(prev => ({ ...prev, enrollmentDate: e.target.value }))}
                  {...inputProps}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={playerInfo.height}
                  onChange={(e) => setplayerInfo(prev => ({ ...prev, height: e.target.value }))}
                  {...inputProps}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={playerInfo.weight}
                  onChange={(e) => setplayerInfo(prev => ({ ...prev, weight: e.target.value }))}
                  {...inputProps}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school" className="flex items-center gap-2">
                  Academy
                  <span className="text-xs text-muted-foreground">(System-assigned)</span>
                </Label>
                <Input
                  id="school"
                  value={playerInfo.school}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Age (Auto-calculated)</Label>
                <Input
                  id="age"
                  value={playerInfo.age}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medical Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="hasDisability"
                  checked={playerInfo.hasDisability}
                  onCheckedChange={(checked) => 
                    setplayerInfo(prev => ({ ...prev, hasDisability: checked }))
                  }
                  disabled={!isEditing}
                />
                <Label htmlFor="hasDisability">Has Disability</Label>
              </div>

              {playerInfo.hasDisability && (
                <div className="space-y-2">
                  <Label htmlFor="disabilityType">Disability Type</Label>
                  <Input
                    id="disabilityType"
                    value={playerInfo.disabilityType}
                    onChange={(e) => setplayerInfo(prev => ({ ...prev, disabilityType: e.target.value }))}
                    {...inputProps}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="bloodGroup">Blood Group</Label>
                <Select
                  value={playerInfo.bloodGroup}
                  onValueChange={(value) => setplayerInfo(prev => ({ ...prev, bloodGroup: value }))}
                  disabled={!isEditing}
                >
                  <SelectTrigger className={inputProps.className}>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="primaryGuardian">Primary Guardian Name</Label>
                <Input
                  id="primaryGuardian"
                  value={playerInfo.primaryGuardian}
                  onChange={(e) => setplayerInfo(prev => ({ ...prev, primaryGuardian: e.target.value }))}
                  {...inputProps}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryGuardian">Secondary Guardian Name</Label>
                <Input
                  id="secondaryGuardian"
                  value={playerInfo.secondaryGuardian}
                  onChange={(e) => setplayerInfo(prev => ({ ...prev, secondaryGuardian: e.target.value }))}
                  {...inputProps}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  Email
                  <span className="text-xs text-muted-foreground">(System-assigned)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={playerInfo.email}
                  readOnly
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryPhone">Primary Phone</Label>
                <Input
                  id="primaryPhone"
                  type="tel"
                  value={playerInfo.primaryPhone}
                  onChange={(e) => handlePhoneChange(e, 'primaryPhone')}
                  maxLength={10}
                  placeholder="Enter 10 digit number"
                  {...inputProps}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryPhone">Secondary Phone</Label>
                <Input
                  id="secondaryPhone"
                  type="tel"
                  value={playerInfo.secondaryPhone}
                  onChange={(e) => handlePhoneChange(e, 'secondaryPhone')}
                  maxLength={10}
                  placeholder="Enter 10 digit number"
                  {...inputProps}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={playerInfo.address}
                  onChange={(e) => setplayerInfo(prev => ({ ...prev, address: e.target.value }))}
                  {...inputProps}
                />
              </div>
            </CardContent>
          </Card>

          
        </div>
      </div>
    </div>
  )
}