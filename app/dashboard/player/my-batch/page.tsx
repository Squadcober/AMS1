"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/Sidebar"
import { Eye } from "lucide-react"

interface Credential {
  _id: string
  title: string
  issuer: string
  date: string
  document?: string
  userId: string
  academyId: string
  createdAt: string
}

interface Coach {
  id: string
  name: string
  email: string
  photoUrl?: string
  specialization?: string
  experience?: string
  achievements?: string[]
  credentials?: Credential[]
}

interface BatchData {
  id: string
  name: string
  coachId: string
  players: string[]
}

export default function MyBatch() {
  const [batchData, setBatchData] = useState<BatchData | null>(null)
  const [coachData, setCoachData] = useState<Coach | null>(null)
  const [showCoachProfile, setShowCoachProfile] = useState(false)
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{ url: string; type: string } | null>(null)

  useEffect(() => {
    // Load user's batch data
    const loadBatchData = () => {
      try {
        const allBatches = JSON.parse(localStorage.getItem('ams-batch') || '[]')
        // Find user's batch (you'll need to implement logic to find the correct batch)
        const userBatch = allBatches[0] // Temporary: just get first batch
        if (userBatch) {
          setBatchData(userBatch)
          loadCoachData(userBatch.coachId)
        }
      } catch (error) {
        console.error('Error loading batch data:', error)
      }
    }

    loadBatchData()
  }, [])

  const loadCoachData = async (coachId: string) => {
    try {
      const users = JSON.parse(localStorage.getItem('users') || '[]')
      const coaches = JSON.parse(localStorage.getItem('ams-coaches') || '[]')

      const userData = users.find((u: any) => u.id === coachId)
      const coachData = coaches.find((c: any) => c.id === coachId)

      if (userData) {
        // Fetch credentials from database
        const credentialsResponse = await fetch(`/api/db/ams-credentials?userId=${coachId}&academyId=${userData.academyId}`)
        let credentials = []
        if (credentialsResponse.ok) {
          const credentialsResult = await credentialsResponse.json()
          if (credentialsResult.success) {
            credentials = credentialsResult.data
          }
        }

        setCoachData({
          ...userData,
          ...coachData,
          credentials: credentials
        })
      }
    } catch (error) {
      console.error('Error loading coach data:', error)
    }
  }

  const handleCoachClick = () => {
    if (coachData) {
      setSelectedCoach(coachData)
      setShowCoachProfile(true)
    }
  }

  const handlePreview = (documentData: string) => {
    const type = documentData.split(";")[0].split(":")[1]
    setPreviewDoc({ url: documentData, type })
  }

  if (!batchData) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold mb-8">My Batch</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{batchData.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Coach Info - Clickable */}
            <div 
              className="flex items-center space-x-4 cursor-pointer hover:bg-gray-800 p-4 rounded-lg"
              onClick={handleCoachClick}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={coachData?.photoUrl} />
                <AvatarFallback>{coachData?.name?.[0] || 'C'}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold text-blue-500 hover:underline">
                  {coachData?.name || "Unassigned"}
                </h3>
                <p className="text-sm text-gray-400">Coach</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coach Profile Dialog */}
        <Dialog open={showCoachProfile} onOpenChange={setShowCoachProfile}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Coach Profile</DialogTitle>
            </DialogHeader>
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
                    <Badge variant="secondary" className="mt-2">
                      {selectedCoach?.specialization || 'Coach'}
                    </Badge>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Experience</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{selectedCoach?.experience || 'No experience information available'}</p>
                  </CardContent>
                </Card>

                {selectedCoach?.achievements && selectedCoach.achievements.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Achievements</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-4 space-y-2">
                        {selectedCoach.achievements.map((achievement, index) => (
                          <li key={index}>{achievement}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="credentials" className="space-y-4">
                {selectedCoach?.credentials?.length ? (
                  selectedCoach.credentials.map((credential, index) => (
                    <Card key={credential._id || index}>
                      <CardHeader>
                        <CardTitle>{credential.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm text-gray-500">
                            Issued by {credential.issuer} • {new Date(credential.date).toLocaleDateString()}
                          </p>
                          {credential.document && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreview(credential.document!)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Document
                            </Button>
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
          </DialogContent>
        </Dialog>

        {/* Document Preview Dialog */}
        <Dialog open={previewDoc !== null} onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Document Preview</DialogTitle>
            </DialogHeader>
            <div className="relative w-full h-[70vh] overflow-auto">
              {previewDoc?.type.startsWith("image/") ? (
                <img src={previewDoc.url || "/placeholder.svg"} alt="Document preview" className="max-w-full h-auto" />
              ) : previewDoc?.type === "application/pdf" ? (
                <iframe src={previewDoc.url} className="w-full h-full" title="PDF preview" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p>Preview not available for this file type. Please download to view.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
