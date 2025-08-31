"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import Sidebar from "@/components/Sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

export default function SettingsPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    phone: "",
    address: "",
    photoUrl: "",
    specializations: [] as string[],
    id: undefined as string | undefined,
    socialLinks: {
      twitter: "",
      linkedin: "",
      website: "",
    },
    certificates: [] as { name: string; issueDate: string; issuingAuthority: string }[],
  })

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user?.id) return

      try {
        setIsLoading(true)
        const response = await fetch(`/api/db/ams-users-info?userId=${encodeURIComponent(user.id)}`)

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setFormData((prev) => ({
              ...prev,
              ...result.data,
            }))
          }
        }
      } catch (error) {
        console.error("Error fetching user info:", error)
        toast({
          title: "Error",
          description: "Failed to load user information",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserInfo()
  }, [user?.id])

  const handleEdit = () => setIsEditing(true)

  const handleCancel = () => {
    setIsEditing(false)
    // Reload user info to revert changes
    if (user?.id) {
      setIsLoading(true)
      fetch(`/api/db/ams-users-info?userId=${encodeURIComponent(user.id)}`)
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            setFormData((prev) => ({
              ...prev,
              ...result.data,
            }))
          }
        })
        .finally(() => setIsLoading(false))
    }
  }

  const handleSave = async () => {
    if (!user?.id || !user?.academyId) {
      toast({
        title: "Error",
        description: "User ID or Academy ID is missing",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      // Only include the fields we want to update
      const { phone, address, photoUrl, specializations, socialLinks, certificates } = formData

      const dataToSave = {
        userId: user.id,
        academyId: user.academyId,
        phone,
        address,
        photoUrl,
        specializations,
        socialLinks,
        certificates,
        updatedAt: new Date().toISOString(),
      }

      const response = await fetch("/api/db/ams-users-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSave),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to save settings")
      }

      if (result.success && result.data) {
        setFormData((prev) => ({
          ...prev,
          ...result.data,
        }))
        setIsEditing(false)
        toast({
          title: "Success",
          description: "Settings saved successfully",
        })
      } else {
        throw new Error(result.error || "Failed to save settings")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const inputProps = {
    disabled: !isEditing,
    className: !isEditing ? "bg-muted cursor-not-allowed" : "",
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          {isEditing ? (
            <div className="flex gap-2">
              <Button onClick={handleCancel} variant="outline" disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          ) : (
            <Button onClick={handleEdit}>Edit</Button>
          )}
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="social">Social Links</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  {/* Removed Bio */}
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      {...inputProps}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      {...inputProps}
                    />
                  </div>
                  {/* Removed Experience */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Social Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="twitter">Twitter</Label>
                    <Input
                      id="twitter"
                      value={formData.socialLinks.twitter}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          socialLinks: { ...formData.socialLinks, twitter: e.target.value },
                        })
                      }
                      {...inputProps}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      value={formData.socialLinks.linkedin}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          socialLinks: { ...formData.socialLinks, linkedin: e.target.value },
                        })
                      }
                      {...inputProps}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.socialLinks.website}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          socialLinks: { ...formData.socialLinks, website: e.target.value },
                        })
                      }
                      {...inputProps}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="certificates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Certificates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.certificates.map((cert, index) => (
                  <div key={index} className="grid gap-4">
                    <Input
                      placeholder="Certificate Name"
                      value={cert.name}
                      onChange={(e) => {
                        const newCerts = [...formData.certificates]
                        newCerts[index] = { ...cert, name: e.target.value }
                        setFormData({ ...formData, certificates: newCerts })
                      }}
                      {...inputProps}
                    />
                    <div className="flex gap-4">
                      <Input
                        type="date"
                        value={cert.issueDate}
                        onChange={(e) => {
                          const newCerts = [...formData.certificates]
                          newCerts[index] = { ...cert, issueDate: e.target.value }
                          setFormData({ ...formData, certificates: newCerts })
                        }}
                        {...inputProps}
                      />
                      <Input
                        placeholder="Issuing Authority"
                        value={cert.issuingAuthority}
                        onChange={(e) => {
                          const newCerts = [...formData.certificates]
                          newCerts[index] = { ...cert, issuingAuthority: e.target.value }
                          setFormData({ ...formData, certificates: newCerts })
                        }}
                        {...inputProps}
                      />
                      {isEditing && (
                        <Button
                          variant="destructive"
                          onClick={() => {
                            const newCerts = formData.certificates.filter((_, i) => i !== index)
                            setFormData({ ...formData, certificates: newCerts })
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {isEditing && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        certificates: [...formData.certificates, { name: "", issueDate: "", issuingAuthority: "" }],
                      })
                    }}
                  >
                    Add Certificate
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
