"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Plus, X, Save, Edit, Facebook, Instagram, Youtube, Twitter, Upload, FileImage, FileText, Download, Eye } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CollateralModal } from "@/components/collateral-modal"
import type { Collateral as ImportedCollateral, CollateralFile as ImportedCollateralFile } from "@/types/collateral"
import type React from "react"
import { toast } from "@/components/ui/use-toast"
import { Sidebar } from "@/components/Sidebar"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface AboutData {
  _id?: string;
  academyId: string;
  name: string;
  description: string;
  mission: string;
  vision: string;
  values: string[];
  facilities: string[];
  awards: string[];
  logos?: string[];
  banners?: string[];
  contact: {
    email: string;
    phone: string;
    address: string;
    website?: string;
    socialMedia?: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
}

interface CollateralFile {
  academyId: string;
  id: string;
  name: string;
  url: string;
  type: string;
  dateUploaded: string;
  size?: number; // Add file size for better UX
}

interface Collateral {
  name: string;
  files: CollateralFile[];
  acceptedTypes: string;
  checked?: boolean;
}

type SocialMedia = {
  name: string
  url: string
}

type AboutPageData = {
  logo: string | null
  color: string
  socialMedia: SocialMedia[]
  collaterals: Collateral[]
  about: string
}

const STORAGE_KEY = 'aboutPageData'

export default function AboutPage() {
  console.log("🚀 AboutPage with upload/download features loaded!");
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<AboutPageData>({
    logo: null,
    color: "#000000",
    about: "",
    socialMedia: [
      { name: "Facebook", url: "" },
      { name: "Instagram", url: "" },
      { name: "YouTube", url: "" },
      { name: "Twitter", url: "" },
    ],
    collaterals: [
      {
        name: "Images & Graphics",
        files: [],
        acceptedTypes: ".jpg,.jpeg,.png,.gif"
      },
      {
        name: "Documents",
        files: [],
        acceptedTypes: ".pdf,.doc,.docx,.ppt,.pptx"
      }
    ]
  })
  const [selectedCollateral, setSelectedCollateral] = useState<number | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [teamPhotos, setTeamPhotos] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<CollateralFile | null>(null)
  const [aboutData, setAboutData] = useState<AboutData>({
    academyId: user?.academyId || '',
    name: '',
    description: '',
    mission: '',
    vision: '',
    values: [],
    facilities: [],
    awards: [],
    contact: {
      email: '',
      phone: '',
      address: ''
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load data from MongoDB
  useEffect(() => {
    const fetchAboutData = async () => {
      if (!user?.academyId) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/db/ams-about?academyId=${user.academyId}`);
        if (!response.ok) throw new Error('Failed to fetch about data');
        
        const data = await response.json();
        
        if (data && Object.keys(data).length > 0) {
          setAboutData(data);
          setFormData({
            logo: data.logos?.[0] || null,
            color: data.color || "#000000",
            about: data.description || "",
            socialMedia: Object.entries(data.contact?.socialMedia || {}).map(([name, url]) => ({
              name: name.charAt(0).toUpperCase() + name.slice(1),
              url: url as string
            })),
            collaterals: (data.collaterals && data.collaterals.length > 0) ? data.collaterals : formData.collaterals.map(col => ({
              ...col,
              academyId: user.academyId
            }))
          });
        }
      } catch (error) {
        console.error('Error loading about data:', error);
        toast({
          title: "Error",
          description: "Failed to load academy information",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAboutData();
  }, [user?.academyId]);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        handleFormChange(prev => ({
          ...prev,
          logo: e.target?.result as string
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleFormChange = (updater: (prev: AboutPageData) => AboutPageData) => {
    setFormData(updater)
    setHasUnsavedChanges(true)
  }

  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFormChange(prev => ({
      ...prev,
      color: event.target.value
    }))
  }

  const handleSocialMediaChange = (index: number, field: "name" | "url", value: string) => {
    handleFormChange(prev => {
      const updatedSocialMedia = [...prev.socialMedia]
      updatedSocialMedia[index][field] = value
      return {
        ...prev,
        socialMedia: updatedSocialMedia
      }
    })
  }

  const addSocialMedia = () => {
    setFormData(prev => ({
      ...prev,
      socialMedia: [...prev.socialMedia, { name: "", url: "" }]
    }))
    setHasUnsavedChanges(true)
  }

  const removeSocialMedia = (index: number) => {
    const updatedSocialMedia = formData.socialMedia.filter((_, i) => i !== index)
    setFormData(prev => ({
      ...prev,
      socialMedia: updatedSocialMedia
    }))
    setHasUnsavedChanges(true)
  }

  // Enhanced file upload handler with better file processing
  const handleFileUpload = (collateralIndex: number, files: FileList) => {
    const updatedCollaterals = [...formData.collaterals]
    const newFiles: CollateralFile[] = Array.from(files).map((file) => ({
      academyId: user?.academyId || '',
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
      size: file.size,
      dateUploaded: new Date().toISOString(),
    }))
    
    updatedCollaterals[collateralIndex].files = [...updatedCollaterals[collateralIndex].files, ...newFiles]
    setFormData(prev => ({
      ...prev,
      collaterals: updatedCollaterals
    }))
    setHasUnsavedChanges(true)
    
    toast({
      title: "Files Uploaded",
      description: `${files.length} file(s) uploaded successfully`,
    });
  }

  // Enhanced file download handler
  const handleFileDownload = async (file: CollateralFile) => {
    try {
      // For blob URLs created from file uploads
      if (file.url.startsWith('blob:')) {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // For regular URLs
        const a = document.createElement('a');
        a.href = file.url;
        a.download = file.name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
      toast({
        title: "Download Started",
        description: `Downloading ${file.name}`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  }

  const handleFileDelete = (collateralIndex: number, fileId: string) => {
    const updatedCollaterals = [...formData.collaterals]
    const fileToDelete = updatedCollaterals[collateralIndex].files.find(f => f.id === fileId);
    
    // Clean up blob URL to prevent memory leaks
    if (fileToDelete && fileToDelete.url.startsWith('blob:')) {
      URL.revokeObjectURL(fileToDelete.url);
    }
    
    updatedCollaterals[collateralIndex].files = updatedCollaterals[collateralIndex].files.filter(
      (file) => file.id !== fileId,
    )
    setFormData(prev => ({
      ...prev,
      collaterals: updatedCollaterals
    }))
    setHasUnsavedChanges(true)
    
    toast({
      title: "File Deleted",
      description: "File removed successfully",
    });
  }

  const handleSave = async () => {
    try {
      const updatedData = {
        ...aboutData,
        name: aboutData.name,
        description: formData.about,
        logos: formData.logo ? [formData.logo] : [],
        color: formData.color,
        contact: {
          ...aboutData.contact,
          socialMedia: formData.socialMedia.reduce((acc, item) => ({
            ...acc,
            [item.name.toLowerCase()]: item.url
          }), {})
        },
        collaterals: formData.collaterals,
        updatedAt: new Date().toISOString()
      };

      const response = await fetch('/api/db/ams-about', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) throw new Error('Failed to save about data');

      setAboutData(updatedData);
      setHasUnsavedChanges(false);
      setIsEditing(false);

      toast({
        title: "Success",
        description: "Academy information saved successfully",
      });
    } catch (error) {
      console.error('Error saving about data:', error);
      toast({
        title: "Error",
        description: "Failed to save academy information",
        variant: "destructive",
      });
    }
  };

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = async () => {
    if (!user?.academyId) return;
    
    try {
      const response = await fetch(`/api/db/ams-about?academyId=${user.academyId}`);
      if (!response.ok) throw new Error('Failed to fetch about data');
      
      const data = await response.json();
      if (data && Object.keys(data).length > 0) {
        setAboutData(data);
        setFormData({
          logo: data.logos?.[0] || null,
          color: data.color || "#000000",
          about: data.description || "",
          socialMedia: Object.entries(data.contact?.socialMedia || {}).map(([name, url]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            url: url as string
          })),
          collaterals: (data.collaterals && data.collaterals.length > 0) ? data.collaterals : formData.collaterals
        });
      }
    } catch (error) {
      console.error('Error reloading data:', error);
      toast({
        title: "Error",
        description: "Failed to reload academy information",
        variant: "destructive",
      });
    }
    
    setIsEditing(false);
    setHasUnsavedChanges(false);
  };

  const deleteTeamPhoto = (index: number) => {
    const newPhotos = [...teamPhotos]
    newPhotos.splice(index, 1)
    setTeamPhotos(newPhotos)
  }

  const handleFileClick = (file: CollateralFile) => {
    setSelectedFile(file)
  }

  // Helper function to get file type icon
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <FileImage className="w-4 h-4" />
    return <FileText className="w-4 h-4" />
  }

  // Helper function to format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  const getSocialIcon = (platformName: string) => {
    const name = platformName.toLowerCase()
    switch (name) {
      case 'facebook':
        return <Facebook className="h-5 w-5 mr-2" />
      case 'instagram':
        return <Instagram className="h-5 w-5 mr-2" />
      case 'youtube':
        return <Youtube className="h-5 w-5 mr-2" />
      case 'twitter':
      case 'x':
        return <Twitter className="h-5 w-5 mr-2" />
      default:
        return null
    }
  }

  // Enhanced CollateralSection with better file management
  const CollateralSection = () => {
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    return (
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Social Media Collaterals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {formData.collaterals.map((collateral, index) => {
            return (
              <Card key={collateral.name} className="relative">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      {collateral.name === "Images & Graphics" && <FileImage className="w-5 h-5" />}
                      {collateral.name === "Documents" && <FileText className="w-5 h-5" />}
                      <span>{collateral.name}</span>
                    </span>
                    {isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current[index]?.click()}
                        className="ml-2"
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Upload
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">
                        {collateral.files.length} file{collateral.files.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-gray-500">
                        Accepts: {collateral.acceptedTypes}
                      </span>
                    </div>
                    
                    <input
                      type="file"
                      ref={el => { fileInputRefs.current[index] = el }}
                      className="hidden"
                      accept={collateral.acceptedTypes}
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          handleFileUpload(index, e.target.files);
                          e.target.value = ''; // Reset input for re-uploads
                        }
                      }}
                    />
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {collateral.files.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <div className="mb-2">
                            {collateral.name === "Images & Graphics" && <FileImage className="w-8 h-8 mx-auto mb-2 opacity-50" />}
                            {collateral.name === "Documents" && <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />}
                          </div>
                          <p className="text-sm">No files uploaded</p>
                          {isEditing && (
                            <p className="text-xs mt-1">Click Upload to add files</p>
                          )}
                        </div>
                      ) : (
                        collateral.files.map(file => (
                          <div key={file.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              {getFileIcon(file.type)}
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-medium text-sm">{file.name}</p>
                                <div className="flex items-center space-x-2 text-xs text-gray-400">
                                  <span>{formatFileSize(file.size)}</span>
                                  <span>•</span>
                                  <span>{new Date(file.dateUploaded).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-1">
                              {/* Preview button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFileClick(file)}
                                className="h-8 w-8 p-0"
                                title="Preview file"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              
                              {/* Download button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFileDownload(file)}
                                className="h-8 w-8 p-0"
                                title="Download file"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              
                              {/* Delete button (only in edit mode) */}
                              {isEditing && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleFileDelete(index, file.id)}
                                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                                  title="Delete file"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col space-y-6 overflow-auto p-8">
        {/* Top bar with Edit/Save buttons */}
        <div className="flex justify-end mb-8 space-x-4">
          {!isEditing ? (
            <Button onClick={handleEdit} className="bg-cyan-500 text-black hover:bg-cyan-400">
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleCancel} 
                variant="ghost" 
                className="text-white border border-gray-600 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                className="bg-green-500 text-black px-6 py-3 font-bold hover:bg-green-400 disabled:bg-gray-500 disabled:text-gray-300"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          )}
        </div>

        {/* Team Logo */}
        <div className="mb-12">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-4">Team Logo</h2>
              <div className="relative">
                <div
                  className={`w-32 h-32 border-2 border-dashed border-gray-600 flex items-center justify-center bg-black 
                    ${isEditing ? 'cursor-pointer' : ''}`}
                  onClick={isEditing ? () => fileInputRef.current?.click() : undefined}
                >
                  {formData.logo ? (
                    <>
                      <Image src={formData.logo || "/placeholder.svg"} alt="Team Logo" width={128} height={128} />
                      {isEditing && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFormChange(prev => ({
                              ...prev,
                              logo: null
                            }));
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">
                      {isEditing ? 'Click to add logo' : 'No logo uploaded'}
                    </span>
                  )}
                </div>
                {isEditing && (
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleLogoUpload} 
                    accept="image/*" 
                  />
                )}
              </div>
            </div>
            <div className="text-right">
              <h3 className="mb-2">Team Color</h3>
              {isEditing ? (
                <input
                  type="color"
                  value={formData.color}
                  onChange={handleColorChange}
                  className="w-32 h-8 bg-black border border-gray-600"
                />
              ) : (
                <div 
                  className="w-32 h-8 border border-gray-600" 
                  style={{backgroundColor: formData.color}}
                />
              )}
            </div>
          </div>
        </div>

        {/* About Section */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>About Academy</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.about}
              onChange={(e) => handleFormChange(prev => ({
                ...prev,
                about: e.target.value
              }))}
              placeholder="Enter academy description..."
              className="min-h-[400px] w-full bg-gray-800 text-white resize-none"
              disabled={!isEditing}
            />
          </CardContent>
        </Card>

        {/* Social Media Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Social Media Details</h2>
          <div className="space-y-4">
            {formData.socialMedia.map((platform, index) => (
              <div key={index} className="flex items-center gap-4">
                {isEditing ? (
                  <>
                    <div className="flex items-center w-1/3">
                      {getSocialIcon(platform.name)}
                      <Input
                        value={platform.name}
                        onChange={(e) => handleSocialMediaChange(index, "name", e.target.value)}
                        placeholder="Platform name"
                        className="bg-black border-gray-600 text-white"
                      />
                    </div>
                    <Input
                      value={platform.url}
                      onChange={(e) => handleSocialMediaChange(index, "url", e.target.value)}
                      placeholder="URL"
                      className="flex-1 bg-black border-gray-600 text-white"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSocialMedia(index)}
                      className="text-white hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center w-1/3">
                      {getSocialIcon(platform.name)}
                      <span>{platform.name}</span>
                    </div>
                    <a 
                      href={platform.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex-1 text-cyan-400 hover:underline"
                    >
                      {platform.url}
                    </a>
                  </>
                )}
              </div>
            ))}
            {isEditing && (
              <Button
                onClick={addSocialMedia}
                variant="ghost"
                className="mt-2 text-white border border-gray-600 hover:bg-gray-800"
              >
                <Plus className="h-4 w-4 mr-2" /> Add More
              </Button>
            )}
          </div>
        </section>

        {/* Social Media Collaterals */}
        <CollateralSection />

        {/* File Content Modal */}
        {selectedFile && (
          <Dialog open={true} onOpenChange={() => setSelectedFile(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  {getFileIcon(selectedFile.type)}
                  <span>{selectedFile.name}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="py-4">
                {selectedFile.type.startsWith("image/") ? (
                  (selectedFile.size && selectedFile.size > 1024 * 1024) ? (
                    <div className="text-center py-8">
                      <FileImage className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="mb-2 text-lg font-medium">File too large to preview</p>
                      <p className="mb-4 text-gray-400">
                        Files larger than 1MB cannot be previewed.<br />
                        File size: {formatFileSize(selectedFile.size)}
                      </p>
                      <Button onClick={() => handleFileDownload(selectedFile)}>
                        <Download className="w-4 h-4 mr-2" />
                        Download to View
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <Image 
                        src={selectedFile.url} 
                        alt={selectedFile.name} 
                        width={600} 
                        height={400} 
                        className="max-w-full h-auto rounded-lg"
                      />
                    </div>
                  )
                ) : (
                  (selectedFile.size && selectedFile.size > 1024 * 1024) ? (
                    <div className="text-center py-8">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="mb-2 text-lg font-medium">Document too large to preview</p>
                      <p className="mb-4 text-gray-400">
                        Files larger than 1MB cannot be previewed.<br />
                        File size: {formatFileSize(selectedFile.size)}
                      </p>
                      <Button onClick={() => handleFileDownload(selectedFile)}>
                        <Download className="w-4 h-4 mr-2" />
                        Download to View
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="mb-4">Preview not available for this file type</p>
                      <Button onClick={() => handleFileDownload(selectedFile)}>
                        <Download className="w-4 h-4 mr-2" />
                        Download to View
                      </Button>
                    </div>
                  )
                )}
              </div>
              <DialogFooter className="flex justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span>Size: {formatFileSize(selectedFile.size)}</span>
                  <span>Uploaded: {new Date(selectedFile.dateUploaded).toLocaleDateString()}</span>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => handleFileDownload(selectedFile)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="default" onClick={() => setSelectedFile(null)}>
                    Close
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}