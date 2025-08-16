"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import Image from "next/image"
import { useAuth } from "@/contexts/AuthContext"
import { CustomTooltip } from "@/components/custom-tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileUp, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sidebar } from "@/components/Sidebar" // Import the Sidebar component
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"

interface Rating {
  playerId: string
  playerName?: string
  playerPhoto?: string
  rating: number
  date: string
  comment?: string
}

export default function CoachProfilePage() {
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string>("")
  const [editFormData, setEditFormData] = useState({
    name: "",
    age: 0,
    license: "",
    about: ""
  })
  const [coachData, setCoachData] = useState({
    name: "",
    age: 0,
    license: "",
    ratings: [] as Rating[],
    about: "",
    photoUrl: "/placeholder.svg",
    sessionsCount: 0
  })
  const [ratings, setRatings] = useState<Rating[]>([])
  const [userId, setUserId] = useState<string | undefined>(undefined)

  const processRatings = (ratings: any[]) => {
    return ratings.map(rating => {
      const playerName = rating.playerInfo?.name || 
                         rating.playerName || 
                         'Anonymous player'

      const playerPhoto = rating.playerInfo?.photoUrl || 
                         rating.playerPhoto || 
                         undefined

      return {
        ...rating,
        playerName,
        playerPhoto,
        rating: rating.rating || 0,
        date: rating.date || new Date().toISOString(),
        playerId: rating.playerId,
        academyId: rating.academyId || user?.academyId,
        comment: rating.comment
      }
    })
  }

// --- NEW: simple caching helpers to show cached profile/ratings immediately ---
const CACHE_KEY_PREFIX = "ams_coach_profile_"

const loadFromCache = (key: string) => {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${key}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const saveToCache = (key: string, data: any) => {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify(data))
  } catch {
    // ignore
  }
}
// --- end new helpers ---

  // Replace the two existing useEffect hooks (profile + ratings) with one optimized effect
  useEffect(() => {
    if (!user?.username || !user?.academyId) {
      // Pre-fill visible fields from user context so UI is responsive immediately
      setCoachData(prev => ({
        ...prev,
        name: user?.name || prev.name,
        photoUrl: (user as any)?.photoUrl || prev.photoUrl
      }))
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const signal = controller.signal

    const fetchAll = async () => {
      try {
        setIsLoading(true)

        // 1) fetch user id
        const idResp = await fetch(`/api/db/coach-profile/ams-users?username=${encodeURIComponent(user.username)}`, { signal })
        if (!idResp.ok) throw new Error("Failed to fetch user id")
        const idJson = await idResp.json()
        const id = idJson?.data?.id
        if (!id) throw new Error("No user id returned")
        setUserId(id)

        // 2) try to show cached data immediately
        const cached = loadFromCache(id)
        if (cached) {
          setCoachData(prev => ({
            ...prev,
            ...cached.profile
          }))
          if (cached.ratings) {
            setRatings(processRatings(cached.ratings))
          }
        } else {
          // quick prefill from user while we fetch full data
          setCoachData(prev => ({
            ...prev,
            name: user.name || prev.name,
            photoUrl: (user as any)?.photoUrl || prev.photoUrl
          }))
        }

        // 3) fetch profile and ratings in parallel to save time
        const [profileResp, ratingsResp] = await Promise.all([
          fetch(`/api/db/coach-profile/${id}`, { signal }),
          fetch(`/api/db/coach-ratings?coachId=${id}`, { signal })
        ])

        if (!profileResp.ok) throw new Error("Failed to fetch coach profile")
        if (!ratingsResp.ok) throw new Error("Failed to fetch coach ratings")

        const profileJson = await profileResp.json()
        const ratingsJson = await ratingsResp.json()

        const profileData = profileJson?.data || {}
        const ratingsData = Array.isArray(ratingsJson?.data) ? ratingsJson.data : []

        // process and set states
        const processedRatings = processRatings(ratingsData)
        setCoachData({
          name: profileData.name || user.name || "",
          age: profileData.age || 0,
          license: profileData.license || "",
          ratings: processedRatings,
          about: profileData.about || "",
          photoUrl: profileData.photoUrl || "/placeholder.svg",
          sessionsCount: profileData.sessionsCount || 0
        })

        setRatings(processedRatings)

        // save to cache for next load
        saveToCache(id, { profile: profileData, ratings: ratingsData })
      } catch (err) {
        if ((err as any)?.name === "AbortError") {
          // aborted, ignore
          return
        }
        console.error("Error loading coach data:", err)
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to load coach data",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchAll()

    return () => {
      controller.abort()
    }
  }, [user?.username, user?.academyId])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setCoachData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setTempPhotoUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setTempPhotoUrl("")
    setEditFormData({
      name: coachData.name,
      age: coachData.age,
      license: coachData.license,
      about: coachData.about
    })
  }

  const startEditing = () => {
    setIsEditing(true)
    setTempPhotoUrl(coachData.photoUrl)
    setEditFormData({
      name: coachData.name,
      age: coachData.age,
      license: coachData.license,
      about: coachData.about
    })
  }

  const handleSave = async () => {
    try {
      if (!userId || !user?.academyId) {
        throw new Error('Missing required user data')
      }

      const response = await fetch(`/api/db/coach-profile/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...coachData,
          academyId: user.academyId
        })
      })

      if (!response.ok) {
        throw new Error("Failed to save coach data")
      }

      toast({
        title: "Success",
        description: "Profile updated successfully"
      })
      setIsEditing(false)
    } catch (error) {
      console.error("Error saving coach data:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save changes",
        variant: "destructive"
      })
    }
  }

  const averageRating = useMemo(() => {
    if (!ratings.length) return "N/A"
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0)
    return (sum / ratings.length).toFixed(1)
  }, [ratings])

  console.log('Rendering coach profile with:', {
    coachData,
    ratings,
    isLoading,
    user: {
      id: userId,
      academyId: user?.academyId,
      name: user?.name
    }
  })

  // Update the photo display section (replace the existing photo element):
  const photoDisplaySection = (
    <div className="relative w-32 h-32">
      {isEditing ? (
        <label className="cursor-pointer w-full h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded-full overflow-hidden">
          {tempPhotoUrl ? (
            <Image
              src={tempPhotoUrl}
              alt="Preview"
              width={128}
              height={128}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="text-center">
              <FileUp className="mx-auto h-6 w-6 text-gray-400" />
              <span className="mt-1 text-xs font-medium">Upload Photo</span>
            </div>
          )}
          <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
        </label>
      ) : (
        <Image
          src={coachData.photoUrl || "/placeholder.svg"}
          alt={coachData.name}
          width={128}
          height={128}
          className="rounded-full object-cover"
        />
      )}
    </div>
  )

  // Update the buttons section:
  const actionButtons = (
    <div className="flex justify-end gap-4">
      {isEditing ? (
        <>
          <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </>
      ) : (
        <Button onClick={startEditing}>Edit Profile</Button>
      )}
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar /> {/* Add the Sidebar component here */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div className="flex justify-between items-start">
          <div>
            <CustomTooltip content="Your average rating from players">
              <div>
                <h1 className="text-4xl font-bold">Rating</h1>
                <div className="text-7xl font-extrabold mt-2">{averageRating}</div>
                <p className="text-sm text-gray-400 mt-1">Based on {ratings.length} ratings</p>
              </div>
            </CustomTooltip>
          </div>

          <div className="text-right">
            <CustomTooltip content="Your personal information">
              <div className="flex justify-end items-center space-x-4">
                <div>
                  {isEditing ? (
                    <>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={coachData.name}
                        onChange={handleInputChange}
                        className="mb-2"
                      />
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        name="age"
                        type="number"
                        value={coachData.age}
                        onChange={handleInputChange}
                        className="mb-2"
                      />
                      <Label htmlFor="license">License</Label>
                      <Input
                        id="license"
                        name="license"
                        value={coachData.license}
                        onChange={handleInputChange}
                        className="mb-2"
                      />
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold">{coachData.name.toUpperCase()}</h2>
                      <p className="text-sm mt-1">Age: {coachData.age}</p>
                      <p className="text-sm">{coachData.license}</p>
                    </>
                  )}
                </div>
                {photoDisplaySection}
              </div>
            </CustomTooltip>
          </div>
        </div>

        <CustomTooltip content="Your professional background and achievements">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <textarea
                  name="about"
                  value={coachData.about}
                  onChange={handleInputChange}
                  className="w-full h-32 bg-gray-700 text-white rounded-md p-2 mt-2"
                />
              ) : (
                <p className="text-sm mt-2 leading-relaxed">{coachData.about}</p>
              )}
            </CardContent>
          </Card>
        </CustomTooltip>

        <CustomTooltip content="Recent feedback from players">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle>Recent Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ratings.slice(-4).map((rating, index) => (
                  <div key={index} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        {rating.playerPhoto ? (
                          <Image
                            src={rating.playerPhoto}
                            alt={rating.playerName || 'player photo'}
                            width={32}
                            height={32}
                            className="rounded-full mr-2"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-600 rounded-full mr-2" />
                        )}
                        <span className="text-sm font-medium">
                          {rating.playerName}
                        </span>
                      </div>
                      <span className="text-lg font-bold">{rating.rating}/5</span>
                    </div>
                    <p className="text-sm text-gray-300">
                      {new Date(rating.date).toLocaleDateString()}
                    </p>
                    {rating.comment && <p className="mt-2 text-sm">{rating.comment}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </CustomTooltip>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Training Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{coachData.sessionsCount}</p>
                <p className="text-sm text-muted-foreground">Total Sessions Conducted</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-500" />
              </div>
            </div>
            <Separator className="my-4" />
            <p className="text-sm text-muted-foreground">
              Completed training sessions across all batches
            </p>
          </CardContent>
        </Card>

        {actionButtons}
      </div>
    </div>
  )
}

