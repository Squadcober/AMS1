"use client"

import type React from "react"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { usePlayers } from "@/contexts/PlayerContext"
import { CustomTooltip } from "@/components/custom-tooltip"
import html2canvas from "html2canvas"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import ComparePlayers from "@/components/ComparePlayers"
import { useBatches } from "@/contexts/BatchContext"
import { Radar, Line } from "react-chartjs-2"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
} from "chart.js"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import Sidebar from "@/components/Sidebar"
import { exportToDoc, exportMultipleToDoc } from "@/lib/doc-export"
import domtoimage from "dom-to-image"
// Removed html2canvas import as it will no longer be used
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import jsPDF from "jspdf"
interface Player {
  id: string | number
  name: string
  position?: string // Add position property
  photoUrl?: string
  academyId: string
  attributes: PlayerAttributes
  performanceHistory?: {
    date: string
    attributes: PlayerAttributes
  }[]
}

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, CategoryScale, LinearScale)

const PLAYER_COLORS = [
  "rgba(255,99,132,0.5)", // Red
  "rgba(54,162,235,0.5)", // Blue
  "rgba(255,206,86,0.5)", // Yellow
  "rgba(75,192,192,0.5)", // Teal
  "rgba(153,102,255,0.5)", // Purple
  "rgba(255,159,64,0.5)", // Orange
  "rgba(199,199,199,0.5)", // Grey
  "rgba(255,99,255,0.5)", // Pink
  "rgba(99,255,132,0.5)", // Green
  "rgba(99,132,255,0.5)", // Light Blue
  "rgba(255,222,99,0.5)", // Light Yellow
]
const PLAYER_BORDER_COLORS = [
  "rgb(255,99,132)",
  "rgb(54,162,235)",
  "rgb(255,206,86)",
  "rgb(75,192,192)",
  "rgb(153,102,255)",
  "rgb(255,159,64)",
  "rgb(199,199,199)",
  "rgb(255,99,255)",
  "rgb(99,255,132)",
  "rgb(99,132,255)",
  "rgb(255,222,99)",
]

interface Position {
  id: string
  name: string
  shortName: string
  type?: string
}

export interface PlayerAttributes {
  Attack: number
  pace: number
  Physicality: number
  Defense: number
  passing: number
  Technique: number
}

interface GamePlan {
  id: string
  _id?: string // Add MongoDB's _id field
  name: string
  size: string
  gk: boolean
  positions: {
    [key: string]: { playerId: string; top: string; left: string } | null
  }
  strategy: string
  coachId: string
  substitutes: {
    playerId: string
    position: string
  }[]
  academyId: string
  formationPositions?: Position[] // Add this new property
  teamSize?: number // Add this new property
}

const positions: Position[] = [
  { id: "gk", name: "Goalkeeper", shortName: "GK" },
  { id: "lb", name: "Left Back", shortName: "LB" },
  { id: "cb1", name: "Center Back 1", shortName: "CB" },
  { id: "cb2", name: "Center Back 2", shortName: "CB" },
  { id: "rb", name: "Right Back", shortName: "RB" },
  { id: "lm", name: "Left Midfielder", shortName: "LM" },
  { id: "cm1", name: "Center Midfielder 1", shortName: "CM" },
  { id: "cm2", name: "Center Midfielder 2", shortName: "CM" },
  { id: "rm", name: "Right Midfielder", shortName: "RM" },
  { id: "st1", name: "Striker 1", shortName: "ST" },
  { id: "st2", name: "Striker 2", shortName: "ST" },
]

const LOCAL_STORAGE_KEY = "team-builder-gameplans"

// Utility function to check if two positions overlap
const checkPositionOverlap = (
  pos1: { top: string; left: string },
  pos2: { top: string; left: string },
  minDistancePercent: number = 5 // Minimum distance between centers as percentage
): boolean => {
  const top1 = parseFloat(pos1.top)
  const left1 = parseFloat(pos1.left)
  const top2 = parseFloat(pos2.top)
  const left2 = parseFloat(pos2.left)

  const distance = Math.sqrt(
    Math.pow(top1 - top2, 2) + Math.pow(left1 - left2, 2)
  )

  return distance < minDistancePercent
}

// Function to find a non-overlapping position near the target
const findNonOverlappingPosition = (
  targetPos: { top: string; left: string },
  existingPositions: { [key: string]: { playerId: string; top: string; left: string } | null },
  excludePositionId: string,
  minDistancePercent: number = 12
): { top: string; left: string } => {
  const targetTop = parseFloat(targetPos.top)
  const targetLeft = parseFloat(targetPos.left)

  // Check if target position is already valid
  const isPositionValid = (testPos: { top: string; left: string }) => {
    for (const [posId, posData] of Object.entries(existingPositions)) {
      if (posId === excludePositionId || !posData) continue
      if (checkPositionOverlap(testPos, { top: posData.top, left: posData.left }, minDistancePercent)) {
        return false
      }
    }
    return true
  }

  if (isPositionValid(targetPos)) {
    return targetPos
  }

  // Use very small increments for precise positioning
  const maxSearchRadius = 25 // Keep search radius reasonable
  const angleStep = 10 // Smaller angle steps for more precision
  const radiusStep = 0.5 // Very small radius increments
  
  // Search in expanding circles with very small increments
  for (let radius = radiusStep; radius <= maxSearchRadius; radius += radiusStep) {
    const positions = []
    
    // Generate all positions at this radius
    for (let angle = 0; angle < 360; angle += angleStep) {
      const radians = (angle * Math.PI) / 180
      const offsetTop = radius * Math.cos(radians)
      const offsetLeft = radius * Math.sin(radians)
      
      const testTop = Math.max(5, Math.min(95, targetTop + offsetTop))
      const testLeft = Math.max(5, Math.min(95, targetLeft + offsetLeft))
      const testPos = { top: `${testTop}%`, left: `${testLeft}%` }
      
      // Calculate actual distance from target for sorting
      const actualDistance = Math.sqrt(
        Math.pow(testTop - targetTop, 2) + Math.pow(testLeft - targetLeft, 2)
      )
      
      positions.push({ pos: testPos, distance: actualDistance })
    }
    
    // Sort by actual distance to target (closest first)
    positions.sort((a, b) => a.distance - b.distance)
    
    // Test each position starting with the closest
    for (const { pos } of positions) {
      if (isPositionValid(pos)) {
        return pos
      }
    }
  }

  // If still no position found, try the absolute minimum distance in each cardinal direction
  const cardinalDirections = [
    { top: 0, left: minDistancePercent + 1 }, // Right
    { top: 0, left: -(minDistancePercent + 1) }, // Left  
    { top: minDistancePercent + 1, left: 0 }, // Down
    { top: -(minDistancePercent + 1), left: 0 }, // Up
  ]

  for (const direction of cardinalDirections) {
    const testTop = Math.max(5, Math.min(95, targetTop + direction.top))
    const testLeft = Math.max(5, Math.min(95, targetLeft + direction.left))
    const testPos = { top: `${testTop}%`, left: `${testLeft}%` }
    
    if (isPositionValid(testPos)) {
      return testPos
    }
  }

  // Final fallback - find the closest valid position in any direction
  let closestValidPosition = null
  let minDistance = Infinity

  // Check a grid around the target position with fine granularity
  for (let topOffset = -20; topOffset <= 20; topOffset += 1) {
    for (let leftOffset = -20; leftOffset <= 20; leftOffset += 1) {
      if (topOffset === 0 && leftOffset === 0) continue // Skip the target position
      
      const testTop = Math.max(5, Math.min(95, targetTop + topOffset))
      const testLeft = Math.max(5, Math.min(95, targetLeft + leftOffset))
      const testPos = { top: `${testTop}%`, left: `${testLeft}%` }
      
      if (isPositionValid(testPos)) {
        const distance = Math.sqrt(topOffset * topOffset + leftOffset * leftOffset)
        if (distance < minDistance) {
          minDistance = distance
          closestValidPosition = testPos
        }
      }
    }
  }

  return closestValidPosition || {
    top: `${Math.max(5, Math.min(95, targetTop))}%`,
    left: `${Math.max(5, Math.min(95, targetLeft))}%`
  }
}

interface AvailablePosition {
  value: string
  label: string
}

// Add these position types at the top with other interfaces
const POSITION_TYPES = [
  { id: "gk", name: "Goalkeeper", shortName: "GK" },
  { id: "def", name: "Defender", shortName: "DEF" },
  { id: "mid", name: "Midfielder", shortName: "MID" },
  { id: "cam", name: "Attacking Midfielder", shortName: "CAM" },
  { id: "lw", name: "Left Winger", shortName: "LW" },
  { id: "rw", name: "Right Winger", shortName: "RW" },
  { id: "fwd", name: "Forward", shortName: "FWD" },
  { id: "any", name: "Any Position", shortName: "ANY" },
] as const

const AVAILABLE_POSITIONS: AvailablePosition[] = [
  { value: "any", label: "Any Position" },
  { value: "goalkeeper", label: "Goalkeeper" },
  // Defenders
  { value: "leftback", label: "Left Back" },
  { value: "rightback", label: "Right Back" },
  { value: "centreback", label: "Centre Back" },
  { value: "defender", label: "Defender" },
  // Midfielders
  { value: "defensivemid", label: "Defensive Midfielder" },
  { value: "centralmid", label: "Central Midfielder" },
  { value: "attackingmid", label: "Attacking Midfielder" },
  { value: "leftmid", label: "Left Midfielder" },
  { value: "rightmid", label: "Right Midfielder" },
  { value: "midfielder", label: "Midfielder" },
  // Forwards/Wingers
  { value: "leftwinger", label: "Left Winger" },
  { value: "rightwinger", label: "Right Winger" },
  { value: "striker", label: "Striker" },
  { value: "forward", label: "Forward" },
]

export default function TeamBuilder() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { players, setPlayers } = usePlayers()
  const { batches, setBatches } = useBatches()
  const [gamePlans, setGamePlans] = useState<GamePlan[]>([])
  const [newGamePlanName, setNewGamePlanName] = useState("")
  const [newGamePlanSize, setNewGamePlanSize] = useState("11")
  const [newGamePlanStrategy, setNewGamePlanStrategy] = useState("")
  const [selectedGamePlan, setSelectedGamePlan] = useState<GamePlan | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [draggedPosition, setDraggedPosition] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [selectedAttribute, setSelectedAttribute] = useState<string>("Attack")
  const [activeTab, setActiveTab] = useState<number>(0)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const fieldRef = useRef<HTMLDivElement>(null) // Add this ref
  const [customPositions, setCustomPositions] = useState<Position[]>([])
  const [showCustomizeMenu, setShowCustomizeMenu] = useState(false)
  const [selectedPositionType, setSelectedPositionType] = useState<string>("any")
  const [deletedPositions, setDeletedPositions] = useState<string[]>([])
  const [showSubstitutesModal, setShowSubstitutesModal] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [positionPlayers, setPositionPlayers] = useState<{ [key: string]: any[] }>({})
  const [substitutePlayers, setSubstitutePlayers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFormation, setSelectedFormation] = useState<string>("4-4-2") // Default formation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [gameplanToDelete, setGameplanToDelete] = useState<string | null>(null)
  const [attributeFilter, setAttributeFilter] = useState<"latest" | "overall">("latest")
  const [attributeFilterState, setAttributeFilterState] = useState<"latest" | "overall">("latest")
  const [isSaving, setIsSaving] = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  // Initialize customPositions and deletedPositions from selectedGamePlan on load
  useEffect(() => {
    if (!selectedGamePlan) return;

    // Extract default position IDs
    const defaultPositionIds = positions.map((pos) => pos.id);

    // Extract formationPositions IDs if available
    const formationPositionIds = (selectedGamePlan.formationPositions || []).map((pos) => pos.id);

    // Identify custom positions: those in selectedGamePlan.positions but not in default or formationPositions
    const customPosIds = Object.keys(selectedGamePlan.positions || {}).filter(
      (posId) => !defaultPositionIds.includes(posId) && !formationPositionIds.includes(posId)
    );

    // Build customPositions array from these IDs
    const customPosArray: Position[] = customPosIds.map((posId) => {
      // Try to get position details from selectedGamePlan.formationPositions or fallback to minimal info
      const formationPos = (selectedGamePlan.formationPositions || []).find((pos) => pos.id === posId);
      return (
        formationPos || {
          id: posId,
          name: "Custom Position",
          shortName: "CUST",
          type: "any",
        }
      );
    });

    setCustomPositions(customPosArray);

    // Identify deleted original positions: those in default or formationPositions but missing in selectedGamePlan.positions
    const deletedPosArray = [...defaultPositionIds, ...formationPositionIds].filter(
      (posId) => !(posId in (selectedGamePlan.positions || {}))
    );

    setDeletedPositions(deletedPosArray);
  }, [selectedGamePlan]);

  // Replace localStorage useEffect with MongoDB fetch
  useEffect(() => {
  const fetchGameplans = async () => {
    try {
      if (!user?.academyId || !user?.id) return

      // Fetch gameplans for the academy filtered by coach on the backend
      // If your API doesn't support coachId filtering, you'll need to modify the API
      // For now, we'll filter on the frontend but ensure we're very explicit about it
      const response = await fetch(`/api/db/ams-gameplan?academyId=${user.academyId}`)
      if (!response.ok) throw new Error("Failed to fetch gameplans")

      const result = await response.json()
      if (result.success) {
        // CRITICAL: Filter gameplans to only those created by the current coach
        // This prevents other coaches' gameplans from appearing
        const coachGamePlans = result.data.filter((plan: any) => {
          console.log('Filtering gameplan:', {
            planId: plan._id,
            planCoachId: plan.coachId,
            currentCoachId: user.id,
            matches: plan.coachId === user.id
          });
          return plan.coachId === user.id;
        });
        
        console.log('Filtered gameplans for coach:', {
          totalPlans: result.data.length,
          coachPlans: coachGamePlans.length,
          coachId: user.id
        });
        
        setGamePlans(coachGamePlans)
        if (coachGamePlans.length > 0) {
          setSelectedGamePlan(coachGamePlans[0])
        } else {
          setSelectedGamePlan(null)
        }
      }
    } catch (error) {
      console.error("Error loading gameplans:", error)
      toast({
        title: "Error",
        description: "Failed to load gameplans",
        variant: "destructive",
      })
    }
  }

  fetchGameplans()
}, [user?.academyId, user?.id, toast])

  useEffect(() => {
    if (gamePlans.length > 0 && !selectedGamePlan) {
      setSelectedGamePlan(gamePlans[0])
    }
  }, [gamePlans, selectedGamePlan])

  // Add useEffect to sync strategy when selected game plan changes
  useEffect(() => {
    if (selectedGamePlan) {
      setNewGamePlanStrategy(selectedGamePlan.strategy || "")
    }
  }, [selectedGamePlan])

  // Replace createGamePlan handler
  const handleCreateGamePlan = async () => {
    if (!user?.id || !user?.academyId) {
      toast({
        title: "Error",
        description: "User information missing",
        variant: "destructive",
      })
      return
    }

    if (!newGamePlanName) {
      toast({
        title: "Error",
        description: "Game plan name is required",
        variant: "destructive",
      })
      return
    }

    const teamSize = Number.parseInt(newGamePlanSize)

    // Validate team size (minimum 2, maximum 11)
    if (teamSize < 2 || teamSize > 11) {
      toast({
        title: "Error",
        description: "Team size must be between 2 and 11 players",
        variant: "destructive",
      })
      return
    }

    try {
      // Get positions for the specified team size
      const formationPositions = getPositionsBySize(teamSize)

      // Create positions object using your existing getDefaultPositionStyle function
      const positions = formationPositions.reduce((acc, pos) => {
        const coordinates = getDefaultPositionStyle(pos.id, teamSize)
        return {
          ...acc,
          [pos.id]: {
            playerId: "",
            top: coordinates.top,
            left: coordinates.left,
          },
        }
      }, {})

      const newGamePlan = {
        name: newGamePlanName,
        size: newGamePlanSize,
        positions: positions,
        strategy: newGamePlanStrategy,
        coachId: user.id,
        academyId: user.academyId,
        substitutes: [],
        formation: selectedFormation,
        teamSize: teamSize, // Store the original team size
        formationPositions: formationPositions, // Store which positions are active
      }

      const response = await fetch("/api/db/ams-gameplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGamePlan),
      })

      if (!response.ok) throw new Error("Failed to create gameplan")

      const result = await response.json()

      if (result.success) {
        setGamePlans((prev) => [...prev, result.data])
        setSelectedGamePlan(result.data)

        setNewGamePlanName("")
        setNewGamePlanSize("11")
        setNewGamePlanStrategy("")
        setIsCreateDialogOpen(false)

        toast({
          title: "Success",
          description: `Game plan created with ${teamSize} player formation`,
        })
      }
    } catch (error) {
      console.error("Error creating gameplan:", error)
      toast({
        title: "Error",
        description: "Failed to create gameplan",
        variant: "destructive",
      })
    }
  }

  // Replace saveGamePlan handler
  const handleSaveGamePlans = async () => {
  try {
    if (!user?.academyId || !selectedGamePlan) {
      toast({
        title: "Error",
        description: "No academy ID or game plan found to save",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    setTimeout(() => setShowSaved(false), 2000)

    // Count the current number of player position circles
    const { totalCount } = countPositions(selectedGamePlan)

    // Update the game plan with the current size and teamSize
    const updatedGamePlan = {
      ...selectedGamePlan,
      size: totalCount.toString(),
      teamSize: totalCount,
    }

    // Save the current game plan to the database
    const response = await fetch(`/api/db/ams-gameplan/${selectedGamePlan._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positions: updatedGamePlan.positions,
        formation: selectedFormation,
        strategy: newGamePlanStrategy,
        substitutes: updatedGamePlan.substitutes || [],
        size: updatedGamePlan.size,
        teamSize: updatedGamePlan.teamSize,
        formationPositions: updatedGamePlan.formationPositions,
        updatedAt: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to save game plan")
    }

    const result = await response.json()

    if (result.success) {
      // Update the specific gameplan in the local state without refetching all
      setGamePlans((prev) =>
        prev.map((gp) =>
          gp._id === selectedGamePlan._id
            ? { ...gp, ...result.data, updatedAt: new Date().toISOString() }
            : gp
        )
      )

      // Update the selected game plan
      setSelectedGamePlan(prev => prev ? { ...prev, ...result.data, updatedAt: new Date().toISOString() } : null)

      toast({
        title: "Success",
        description: `Game plan saved successfully with ${totalCount} players`,
      })
    }
  } catch (error) {
    console.error("Error saving game plan:", error)
    toast({
      title: "Error",
      description: "Failed to save game plan",
      variant: "destructive",
    })
  } finally {
    setIsSaving(false)
  }
}

  // Replace deleteGamePlan handler
  const handleDeleteGamePlan = async () => {
    try {
      if (!user?.academyId || !gameplanToDelete) {
        toast({
          title: "Error",
          description: "Academy ID or gameplan ID is missing",
          variant: "destructive",
        })
        return
      }

      // Use _id instead of id since MongoDB uses _id
      const response = await fetch(`/api/db/ams-gameplan?id=${gameplanToDelete}&academyId=${user.academyId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to delete gameplan: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to delete gameplan")
      }

      // Remove from local state using _id
      setGamePlans((prev) => prev.filter((gp) => gp._id !== gameplanToDelete))

      // Update selected gameplan if it was the one being deleted
      if (selectedGamePlan?._id === gameplanToDelete) {
        const remainingGamePlans = gamePlans.filter((gp) => gp._id !== gameplanToDelete)
        setSelectedGamePlan(remainingGamePlans[0] || null)
        setActiveTab(0) // Reset to first tab
      }

      // Close dialog and reset state
      setShowDeleteDialog(false)
      setGameplanToDelete(null)

      toast({
        title: "Success",
        description: "Game plan deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting gameplan:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete gameplan",
        variant: "destructive",
      })
    }
  }

  const DeleteConfirmationDialog = () => (
    <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Game Plan</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-muted-foreground">
            Are you sure you want to delete this game plan? This action cannot be undone.
          </p>
          {gameplanToDelete && (
            <p className="mt-2 font-medium">Game Plan: {gamePlans.find((gp) => gp._id === gameplanToDelete)?.name}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowDeleteDialog(false)
              setGameplanToDelete(null)
            }}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeleteGamePlan}>
            Delete Game Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const handleExportGamePlan = () => {
    if (!selectedGamePlan) return

    exportToDoc(
      selectedGamePlan,
      players.map((p) => ({ ...p, id: p.id.toString() })),
    )
    toast({
      title: "Game Plan Exported",
      description: "Your game plan has been exported as a DOC file",
    })
  }

  const handleExportAllGamePlans = () => {
    exportMultipleToDoc(
      gamePlans,
      players.map((p) => ({ ...p, id: p.id.toString() })),
    )
    toast({
      title: "Game Plans Exported",
      description: `${gamePlans.length} game plans have been exported as a DOC file`,
    })
  }

      const exportToPDF = async (
  formationRef: React.RefObject<HTMLDivElement>,
  gamePlan: GamePlan,
  players: Player[],
  batches: any[],
) => {
  try {
    const pdf = new jsPDF("p", "mm", "a4")

    // Page 1: Formation Map
    pdf.setFontSize(20)
    pdf.text(gamePlan.name, 105, 20, { align: "center" })
    pdf.setFontSize(10)
    pdf.text("Formation", 105, 30, { align: "center" })

    if (formationRef.current) {
      // Temporarily modify the container to ensure full capture with margins
      const originalStyle = formationRef.current.style.cssText
      
      // Add margins to ensure all absolutely positioned elements are captured
      formationRef.current.style.margin = '60px'
      formationRef.current.style.padding = '20px'
      formationRef.current.style.overflow = 'visible'
      formationRef.current.style.boxSizing = 'content-box'
      formationRef.current.style.position = 'relative'
      
      // Wait for layout to update
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Get dimensions after margins and padding are applied
      const containerWidth = formationRef.current.offsetWidth + 120 // 60px margin on each side
      const containerHeight = formationRef.current.offsetHeight + 120
      
      // Use domtoimage since PNG export is working fine
      const formationImage = await domtoimage.toPng(formationRef.current, {
        quality: 1,
        bgcolor: '#16a34a', // Green field background
        width: containerWidth,
        height: containerHeight,
        style: {
          margin: '60px',
          padding: '20px',
          overflow: 'visible',
          boxSizing: 'content-box',
          position: 'relative'
        },
        filter: (node) => {
          // Ensure all nodes are visible
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.style.display === 'none' || element.style.visibility === 'hidden') {
              return false;
            }
          }
          return true;
        }
      })
      
      // Restore original styles immediately after capture
      formationRef.current.style.cssText = originalStyle

      const pageWidth = 210
      const pageHeight = 297
      const maxWidth = 180
      const maxHeight = 200

      // Create a temporary image to get dimensions
      const img = new Image()
      img.src = formationImage
      
      await new Promise((resolve) => {
        img.onload = resolve
      })

      const imgWidth = img.width
      const imgHeight = img.height
      const imgRatio = imgWidth / imgHeight
      
      let finalWidth = maxWidth
      let finalHeight = finalWidth / imgRatio

      if (finalHeight > maxHeight) {
        finalHeight = maxHeight
        finalWidth = finalHeight * imgRatio
      }

      const leftMargin = (pageWidth - finalWidth) / 2
      const topMargin = 50

      pdf.addImage(formationImage, "PNG", leftMargin, topMargin, finalWidth, finalHeight)
    }

    // Page 2: Details
    pdf.addPage()

    // Add Strategy section with adjusted spacing
    pdf.setFontSize(18)
    pdf.text("Strategy", 20, 20)
    pdf.setFontSize(12)
    const splitStrategy = pdf.splitTextToSize(gamePlan.strategy || "No strategy defined", 170)
    pdf.text(splitStrategy, 20, 30)

    // Add Team Composition section with more spacing
    let yPosition = 60

    // Add Starting lineup header
    pdf.setFontSize(16)
    pdf.text("Starting Lineup", 20, yPosition)
    yPosition += 15 // Increased from 10
    pdf.setFontSize(12)

    // Draw lineup table headers with more space
    pdf.setFont("helvetica", "bold")
    pdf.text("Position", 20, yPosition)
    pdf.text("Player", 80, yPosition)
    pdf.setFont("helvetica", "normal")
    yPosition += 10 // Increased from 8

    // Group and sort positions (unchanged)
    const positionOrder = {
      GK: 1,
      LB: 2,
      CB: 3,
      RB: 4,
      LM: 5,
      CM: 6,
      RM: 7,
      ST: 8,
    }

    const allPositions = [...positions, ...customPositions]
    const orderedEntries = Object.entries(gamePlan.positions)
      .filter(([_, data]) => data?.playerId)
      .map(([positionId, data]) => {
        const position = allPositions.find((p) => p.id === positionId)
        const player = players.find((p) => p.id.toString() === data?.playerId)
        return {
          position,
          player,
          order:
            position?.shortName && position.shortName in positionOrder
              ? positionOrder[position.shortName as keyof typeof positionOrder]
              : 99,
        }
      })
      .sort((a, b) => a.order - b.order)

    // Add lineup entries with increased spacing
    orderedEntries.forEach(({ position, player }) => {
      if (position && player) {
        // Check if we need to add a new page
        if (yPosition > 250) {
          pdf.addPage()
          yPosition = 20
        }
        pdf.text(position.name, 20, yPosition)
        pdf.text(player.name, 80, yPosition)
        yPosition += 12 // Increased from 6
      }
    })

    // Add Substitutes section with proper spacing
    yPosition += 15 // Increased spacing before substitutes section
    pdf.setFontSize(16)
    pdf.text("Substitutes", 20, yPosition)
    yPosition += 15 // Increased from 10
    pdf.setFontSize(12)

    // Draw substitutes table headers
    pdf.setFont("helvetica", "bold")
    pdf.text("Position", 20, yPosition)
    pdf.text("Player", 80, yPosition)
    pdf.setFont("helvetica", "normal")
    yPosition += 10 // Increased from 8

    // Add substitute entries with increased spacing
    ;(gamePlan.substitutes || []).forEach((sub) => {
      const player = players.find((p) => p.id.toString() === sub.playerId)
      if (player) {
        // Check if we need to add a new page
        if (yPosition > 250) {
          pdf.addPage()
          yPosition = 20
        }
        pdf.text(sub.position, 20, yPosition)
        pdf.text(player.name, 80, yPosition)
        yPosition += 12 // Increased from 6
      }
    })

    // Save the PDF
    pdf.save(`${gamePlan.name}_formation.pdf`)

    toast({
      title: "Export Successful",
      description: "Formation and team details have been exported as PDF",
    })
  } catch (error) {
    console.error("Error exporting to PDF:", error)
    toast({
      title: "Export Failed",
      description: "Failed to export formation and team details",
      variant: "destructive",
    })
  }
}
  

  const handleExportField = async () => {
    if (!fieldRef.current || !selectedGamePlan) return

    try {
      // Show export options dialog
      setShowExportDialog(true)
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export formation",
        variant: "destructive",
      })
    }
  }

  const isValidPosition = (player: Player, positionName: string) => {
    const playerPosition = player.position?.toLowerCase() || ""
    if (positionName === "Goalkeeper") {
      return playerPosition === "goalkeeper" || playerPosition === "gk"
    } else if (positionName.includes("Back")) {
      return playerPosition === "defender" || playerPosition === "back"
    } else if (positionName.includes("Midfielder")) {
      return playerPosition === "midfielder" || playerPosition === "mid"
    } else if (positionName.includes("Striker")) {
      return playerPosition === "forward" || playerPosition === "striker" || playerPosition === "attacker"
    }
    return false
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, positionId: string) => {
    setDraggedPosition(positionId)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetPositionId: string) => {
    e.preventDefault()
    if (!selectedGamePlan || !draggedPosition) return

    const sourcePlayer = selectedGamePlan.positions[draggedPosition]
    const targetPlayer = selectedGamePlan.positions[targetPositionId]

    // Swap players between positions
    setSelectedGamePlan({
      ...selectedGamePlan,
      positions: {
        ...selectedGamePlan.positions,
        [draggedPosition]: targetPlayer,
        [targetPositionId]: sourcePlayer,
      },
    })

    setGamePlans(
      gamePlans.map((gp) => (gp.id === selectedGamePlan._id ? { ...gp, positions: selectedGamePlan.positions } : gp)),
    )

    setDraggedPosition(null)
  }

  // Update the handlePlayerSelect function
  const handlePlayerSelect = (playerId: string) => {
    if (!selectedGamePlan || !selectedPosition) {
      toast({
        title: "Error",
        description: "No game plan or position selected",
        variant: "destructive",
      })
      return
    }

    // Check if player is already assigned
    const isPlayerAssigned = Object.values(selectedGamePlan.positions).some((pos) => pos && pos.playerId === playerId)

    if (isPlayerAssigned) {
      toast({
        title: "Error",
        description: "Player is already assigned to another position",
        variant: "destructive",
      })
      return
    }

    // Get position coordinates - use existing coordinates if available, otherwise use default
    const currentPositionData = selectedGamePlan.positions[selectedPosition.id]
    const coordinates =
      currentPositionData && typeof currentPositionData === "object"
        ? { top: currentPositionData.top, left: currentPositionData.left }
        : getDefaultPositionStyle(selectedPosition.id)

    // Create a copy of the current positions
    const updatedPositions = {
      ...selectedGamePlan.positions,
      [selectedPosition.id]: {
        playerId,
        top: coordinates.top,
        left: coordinates.left,
      },
    }

    // Create updated game plan
    const updatedGamePlan = {
      ...selectedGamePlan,
      positions: updatedPositions,
    }

    // Update both states
    setSelectedGamePlan(updatedGamePlan)
    setGamePlans((prevGamePlans) => prevGamePlans.map((gp) => (gp.id === selectedGamePlan._id ? updatedGamePlan : gp)))

    // Save to localStorage immediately
    try {
      const allGamePlans = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]")
      const otherGamePlans = allGamePlans.filter((plan: GamePlan) => plan.id !== selectedGamePlan._id)
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...otherGamePlans, updatedGamePlan]))

      toast({
        title: "Success",
        description: "Player assigned successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      })
    }

    // Close the modal
    setIsModalOpen(false)
    setSelectedPosition(null)
  }

  const handlePlayerDragStart = (e: React.DragEvent<HTMLDivElement>, playerId: string) => {
    e.dataTransfer.setData("playerId", playerId)
  }

  const handlePositionDrop = async (e: React.DragEvent<HTMLDivElement>, positionId: string) => {
    e.preventDefault()
    const playerId = e.dataTransfer.getData("playerId")

    if (playerId && selectedGamePlan) {
      const isPlayerAssigned = Object.values(selectedGamePlan.positions).some((pos) => pos && pos.playerId === playerId)

      if (isPlayerAssigned) {
        toast({
          title: "Error",
          description: "Player is already assigned to another position",
          variant: "destructive",
        })
        return
      }

      // Get position coordinates - use existing coordinates if available, otherwise use default
      const currentPositionData = selectedGamePlan.positions[positionId]
      const coordinates =
        currentPositionData &&
        typeof currentPositionData === "object" &&
        currentPositionData.top &&
        currentPositionData.left
          ? { top: currentPositionData.top, left: currentPositionData.left }
          : getDefaultPositionStyle(positionId)

      const updatedPositions = {
        ...selectedGamePlan.positions,
        [positionId]: {
          playerId,
          top: coordinates.top,
          left: coordinates.left,
        },
      }

      // Update local state
      const updatedGamePlan = {
        ...selectedGamePlan,
        positions: updatedPositions,
      }

      setSelectedGamePlan(updatedGamePlan)
      setGamePlans((prevGamePlans) =>
        prevGamePlans.map((gp) => (gp._id === selectedGamePlan._id ? updatedGamePlan : gp)),
      )

      // Save to database immediately
      try {
        const response = await fetch(`/api/db/ams-gameplan/${selectedGamePlan._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positions: updatedPositions,
            updatedAt: new Date().toISOString(),
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to save position update")
        }

        toast({
          title: "Success",
          description: "Player position saved",
        })
      } catch (error) {
        console.error("Error saving position:", error)
        toast({
          title: "Error",
          description: "Failed to save player position",
          variant: "destructive",
        })
      }
    }
  }

  const handlePositionDragStart = (e: React.DragEvent<HTMLDivElement>, positionId: string) => {
    // Explicitly set drag data type
    e.dataTransfer.setData("application/my-app-position", positionId)
    e.dataTransfer.effectAllowed = "move"
    setDraggedPosition(positionId) // Set dragged position state
  }

  const handlePositionDropOnMap = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!showCustomizeMenu || !selectedGamePlan) return

    const positionId = e.dataTransfer.getData("application/my-app-position")
    if (!positionId) return

    const rect = e.currentTarget.getBoundingClientRect()
    let top = ((e.clientY - rect.top) / rect.height) * 100
    let left = ((e.clientX - rect.left) / rect.width) * 100

    // Clamp values between 0 and 100 to avoid overflow
    top = Math.min(100, Math.max(0, top))
    left = Math.min(100, Math.max(0, left))

    const currentPosition = selectedGamePlan.positions[positionId]

    // First, try the target position
    let targetPosition = {
      ...(typeof currentPosition === "object" && currentPosition !== null
        ? currentPosition
        : { playerId: currentPosition || "" }),
      top: `${top}%`,
      left: `${left}%`,
    }

    // Check for overlap and find non-overlapping position if needed
    const nonOverlappingPos = findNonOverlappingPosition(
      { top: targetPosition.top, left: targetPosition.left },
      selectedGamePlan.positions,
      positionId
    )

    const updatedPosition = {
      ...targetPosition,
      top: nonOverlappingPos.top,
      left: nonOverlappingPos.left,
    }

    const updatedPositions = {
      ...selectedGamePlan.positions,
      [positionId]: updatedPosition,
    }

    // Update selectedGamePlan
    const updatedGamePlan = {
      ...selectedGamePlan,
      positions: updatedPositions,
    }

    setSelectedGamePlan(updatedGamePlan)

    // Update gamePlans and save immediately
    setGamePlans((prevGamePlans) => {
      const newGamePlans = prevGamePlans.map((gp) => (gp.id === selectedGamePlan._id ? updatedGamePlan : gp))

      try {
        const allGamePlans = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]")
        const otherGamePlans = allGamePlans.filter(
          (plan: GamePlan) => plan.academyId !== updatedGamePlan.academyId || plan.coachId !== updatedGamePlan.coachId,
        )
        const finalGamePlans = [...otherGamePlans, ...newGamePlans]
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalGamePlans))
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save changes",
          variant: "destructive",
        })
      }

      return newGamePlans
    })
  }

  const handlePositionClick = (position: Position) => {
    if (!showCustomizeMenu) {
      setSelectedPosition(position)
      setIsModalOpen(true)
    }
  }

  const PlayerSelectionModal = () => {
    const [showAllPositions, setShowAllPositions] = useState(false)

    const positionPlayers = useMemo(() => {
      if (!selectedPosition) return []

      return availablePlayers.filter((player) => {
        if (showAllPositions) return true

        const playerPosition = player.position?.toLowerCase() || ""
        const positionName = selectedPosition.name.toLowerCase()

        switch (positionName) {
          case "goalkeeper":
            return ["goalkeeper", "gk"].includes(playerPosition)
          case "left back":
          case "center back 1":
          case "center back 2":
          case "right back":
            return ["defender", "back", "lb", "rb", "cb"].includes(playerPosition)
          case "left midfielder":
          case "center midfielder 1":
          case "center midfielder 2":
          case "right midfielder":
            return ["midfielder", "mid", "lm", "rm", "cm"].includes(playerPosition)
          case "striker 1":
          case "striker 2":
            return ["forward", "striker", "attacker", "st"].includes(playerPosition)
          default:
            if (selectedPosition.type) {
              return (player.position || "").toLowerCase().includes(selectedPosition.type.toLowerCase())
            }
            return false
        }
      })
    }, [selectedPosition, availablePlayers, showAllPositions])

    const remainingPlayers = useMemo(() => {
      return availablePlayers.filter((player) => !positionPlayers.includes(player))
    }, [availablePlayers, positionPlayers])

    return (
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="space-y-4">
            <DialogTitle>Select Player for {selectedPosition?.name}</DialogTitle>
            {selectedBatch && (
              <div className="text-sm text-blue-400">
                Showing players from: {filteredBatches.find((b) => b.id === selectedBatch)?.name}
              </div>
            )}
            {showAllPositions && (
              <div className="text-sm text-muted-foreground">Showing players from all positions</div>
            )}
          </DialogHeader>

          {positionPlayers.length === 0 ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No Players Available</h3>
              <p className="text-muted-foreground mb-4">
                {selectedBatch
                  ? `There are no players available for the ${selectedPosition?.name} position in the selected batch`
                  : `There are no players available for the ${selectedPosition?.name} position`}
              </p>
              {!showAllPositions && (
                <Button onClick={() => setShowAllPositions(true)} className="w-full">
                  View Players from Other Positions ({remainingPlayers.length})
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {(showAllPositions ? availablePlayers : positionPlayers).map((player) => (
                  <div
                    key={player.id}
                    onClick={() => handlePlayerSelect(player.id.toString())}
                    className="flex items-center justify-between p-3 hover:bg-accent rounded-lg cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={player.photoUrl || "/placeholder.svg"} alt={player.name} />
                        <AvatarFallback className="text-lg bg-gray-900 w-full h-full flex items-center justify-center rounded-full">
                          {player.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium group-hover:text-primary">{player.name}</p>
                        <p className="text-sm text-muted-foreground">{player.position}</p>
                      </div>
                    </div>
                    {showAllPositions && (
                      <span className="text-xs px-2 py-1 rounded-full bg-secondary">{player.position}</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {positionPlayers.length > 0 && !showAllPositions && remainingPlayers.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowAllPositions(true)} className="w-full">
                Show {remainingPlayers.length} More Players from Other Positions
              </Button>
            </div>
          )}

          {showAllPositions && (
            <div className="mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowAllPositions(false)} className="w-full">
                Show Only {selectedPosition?.name} Players
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  const filteredBatches = useMemo(() => {
    console.log("=== FILTER BATCHES DEBUG ===")
    console.log("All batches from context:", batches)
    console.log("Batches length:", batches?.length)
    console.log("Batches type:", typeof batches)
    console.log("Is batches an array?", Array.isArray(batches))

    if (!batches || !Array.isArray(batches)) {
      console.log("❌ Batches is not an array or is null/undefined")
      return []
    }

    console.log("User for filtering:", {
      id: user?.id,
      academyId: user?.academyId,
    })

    if (!user?.academyId) {
      console.log("❌ No academy ID available for filtering")
      return []
    }

    const filtered = batches.filter((batch) => {
      console.log("Filtering batch:", {
        batchId: batch.id, // Using id as per your interface
        batchName: batch.name,
        batchCoachId: batch.coachId,
        batchCoachName: batch.coachName,
        batchAcademyId: batch.academyId,
        userAcademyId: user.academyId,
        userCoachId: user.id,
        sameAcademy: batch.academyId === user.academyId,
        sameCoach: batch.coachId === user.id,
      })

      // Filter by academy ID first
      const isSameAcademy = batch.academyId === user.academyId

      // You can choose to filter by coach as well if needed:
      // const isSameCoach = batch.coachId === user.id;
      // return isSameAcademy && isSameCoach;

      // For now, just filter by academy
      return isSameAcademy
    })

    console.log("✅ Filtered batches result:", filtered)
    console.log("Filtered batches length:", filtered.length)
    return filtered
  }, [batches, user?.academyId, user?.id])

  // Update the availablePlayers memo to exclude both assigned and substitute players
  const availablePlayers = useMemo(() => {
    if (!selectedGamePlan || !user?.academyId || !selectedGamePlan.positions) return []

    // Get IDs of players assigned to positions
    const assignedPlayerIds = Object.values(selectedGamePlan.positions || {})
      .filter((pos): pos is { playerId: string; top: string; left: string } => pos !== null)
      .map((pos) => pos.playerId)

    // Get IDs of substitute players
    const substitutePlayerIds = (selectedGamePlan.substitutes || []).map((sub) => sub.playerId)

    // Combine both arrays to get all used player IDs
    const usedPlayerIds = [...assignedPlayerIds, ...substitutePlayerIds]

    // Filter players by academy and exclude both assigned and substitute players
    let filteredPlayers = players.filter(
      (player) => player.academyId === user.academyId && !usedPlayerIds.includes(player.id.toString()),
    )

    // If a batch is selected, further filter by batch
    if (selectedBatch) {
      // Find the selected batch object
      const batch = filteredBatches.find((b) => b.id === selectedBatch)

      if (batch && batch.players && Array.isArray(batch.players)) {
        // Filter players to only include those in the selected batch
        const batchPlayerIds = batch.players.map((p) => p.toString())
        filteredPlayers = filteredPlayers.filter((player) => batchPlayerIds.includes(player.id.toString()))
      }
    }

    return filteredPlayers
  }, [players, selectedGamePlan, user?.academyId, selectedBatch, filteredBatches])

  // Update groupedPlayers memo to work with filtered players
  const groupedPlayers = useMemo(() => {
    return availablePlayers.reduce(
      (groups, player) => {
        const position = player.position || "Unassigned"
        return {
          ...groups,
          [position]: [...(groups[position] || []), player],
        }
      },
      {} as Record<string, typeof players>,
    )
  }, [availablePlayers])

  const positionGroups = Object.entries(groupedPlayers)

  const filteredPlayers = useMemo(() => {
    return players.filter(
      (player) => player.academyId === user?.academyId && player.name.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [players, searchTerm, user?.academyId])

  const handleRemovePlayer = (positionId: string) => {
    if (!selectedGamePlan) return

    setSelectedGamePlan({
      ...selectedGamePlan,
      positions: {
        ...selectedGamePlan.positions,
        [positionId]: null,
      },
    })
    setGamePlans(
      gamePlans.map((gp) => (gp.id === selectedGamePlan._id ? { ...gp, positions: selectedGamePlan.positions } : gp)),
    )
  }

  const handlePlayerSelection = (playerId: string) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId)
      } else if (prev.length < 11) {
        return [...prev, playerId]
      } else {
        return prev
      }
    })
  }

  const handleDeselectAll = () => {
    setSelectedPlayers([])
  }

  // Add this helper function to get the latest attribute value for a player
  

  // Replace your existing calculateAverageAttributes function
const calculateAverageAttributes = (player: any) => {
  if (!player) return {}
  
  // Filter performance history to only include entries with attributes object
  const entriesWithAttributes = (player.performanceHistory || []).filter(
    (entry: any) => entry.attributes && typeof entry.attributes === 'object'
  )
  
  console.log('Player:', player.name, 'Entries with attributes:', entriesWithAttributes.length)
  
  // If no history with attributes, fall back to current attributes
  if (entriesWithAttributes.length === 0) {
    console.log('No performance history with attributes, using current attributes')
    return player.attributes || {}
  }

  const attributeKeys = ["Attack", "pace", "Physicality", "Defense", "passing", "Technique"] as const
  const averages: Record<string, number> = {}

  attributeKeys.forEach((key) => {
    let total = 0
    let count = 0

    // Calculate average from all performance history entries with attributes
    entriesWithAttributes.forEach((entry: any) => {
      const val = entry.attributes?.[key]
      if (typeof val === 'number' && val > 0) {
        total += val
        count += 1
        console.log(`${player.name} - ${key}: adding ${val} (total: ${total}, count: ${count})`)
      }
    })

    // Include current attributes if they exist and are valid
    const currentVal = player.attributes?.[key]
    if (typeof currentVal === 'number' && currentVal > 0) {
      total += currentVal
      count += 1
      console.log(`${player.name} - ${key}: adding current ${currentVal} (total: ${total}, count: ${count})`)
    }

    averages[key] = count > 0 ? Math.round((total / count) * 10) / 10 : 0
    console.log(`${player.name} - ${key} final average: ${averages[key]}`)
  })

  console.log('Final averages for', player.name, ':', averages)
  return averages
}

// Replace your existing getLatestAttributeValue function
const getLatestAttributeValue = (player: any, attribute: string): number => {
  if (!player) return 0

  // First check current attributes
  if (player.attributes && typeof player.attributes[attribute] === 'number') {
    console.log(`${player.name} - ${attribute} from current attributes: ${player.attributes[attribute]}`)
    return player.attributes[attribute]
  }

  // If no current attributes, check performance history
  if (player.performanceHistory && player.performanceHistory.length > 0) {
    // Filter entries that have attributes object and sort by date descending
    const entriesWithAttributes = player.performanceHistory
      .filter((entry: any) => entry.attributes && typeof entry.attributes === 'object')
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Find the most recent entry with this attribute
    const latestEntry = entriesWithAttributes.find(
      (entry: any) => typeof entry.attributes[attribute] === 'number'
    )

    if (latestEntry) {
      console.log(`${player.name} - ${attribute} from latest entry: ${latestEntry.attributes[attribute]}`)
      return latestEntry.attributes[attribute]
    }
  }

  console.log(`${player.name} - ${attribute} not found, returning 0`)
  return 0
}

// Replace your existing getAttributeValue function
const getAttributeValue = (player: any, attribute: string, mode: "latest" | "overall" = "latest") => {
  if (!player) return 0
  
  console.log(`Getting ${attribute} for ${player.name} in ${mode} mode`)
  
  if (mode === "overall") {
    const averages = calculateAverageAttributes(player)
    const value = averages[attribute] ?? 0
    console.log(`Overall ${attribute} for ${player.name}: ${value}`)
    return value
  }
  
  // Latest mode
  const value = getLatestAttributeValue(player, attribute)
  console.log(`Latest ${attribute} for ${player.name}: ${value}`)
  return value
}

// Also update how you use getAttributeValue in your radar chart data
const radarData = {
  labels: ["Attack", "Pace", "Physicality", "Defense", "passing", "Technique"],
  datasets: selectedPlayers.map((playerId, index) => {
    const player = players.find((p) => p.id.toString() === playerId)
    console.log('Creating radar data for player:', player?.name, 'with filter:', attributeFilter)
    
    return {
      label: player?.name || `Player ${index + 1}`,
      data: [
        getAttributeValue(player, "Attack", attributeFilter),
        getAttributeValue(player, "pace", attributeFilter),
        getAttributeValue(player, "Physicality", attributeFilter),
        getAttributeValue(player, "Defense", attributeFilter),
        getAttributeValue(player, "passing", attributeFilter),
        getAttributeValue(player, "Technique", attributeFilter),
      ],
      backgroundColor: PLAYER_COLORS[index % PLAYER_COLORS.length],
      borderColor: PLAYER_BORDER_COLORS[index % PLAYER_BORDER_COLORS.length],
      borderWidth: 2,
      fill: true,
    }
  }),
}

  // Update the line data generator function
  const lineData = (attribute: string) => {
    // Get all dates from all players' histories
    const allDates = new Set<string>()
    selectedPlayers.forEach((playerId) => {
      const player = players.find((p) => p.id.toString() === playerId)
      player?.performanceHistory?.forEach((entry: any) => {
        allDates.add(new Date(entry.date).toISOString().split("T")[0])
      })
    })

    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort()

    // If no dates exist, create a date range from earliest record to today
    if (sortedDates.length === 0 && selectedPlayers.length > 0) {
      const today = new Date()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(today.getDate() - 30)

      for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
        sortedDates.push(d.toISOString().split("T")[0])
      }
    }

    return {
      labels: sortedDates.map((date) => new Date(date).toLocaleDateString()),
      datasets: selectedPlayers.map((playerId, index) => {
        const player = players.find((p) => p.id.toString() === playerId)
        let lastValue = getLatestAttributeValue(player, attribute)

        const data = sortedDates.map((date) => {
          const entry = player?.performanceHistory?.find(
            (e: any) => new Date(e.date).toISOString().split("T")[0] === date,
          )

          if (entry?.attributes?.[attribute] !== undefined) {
            lastValue = entry.attributes[attribute]
          }

          return lastValue
        })

        return {
          label: player?.name || `Player ${index + 1}`,
          data: data,
          fill: false,
          borderColor: PLAYER_BORDER_COLORS[index % PLAYER_BORDER_COLORS.length],
          backgroundColor: PLAYER_COLORS[index % PLAYER_COLORS.length],
          tension: 0.3, // Makes the line smoother
          pointRadius: 3,
        }
      }),
    }
  }

  const radarOptions = {
  scales: {
    r: {
      beginAtZero: true,
      max: 10,
      min: 0,
      ticks: {
        stepSize: 1,
        display: false,
        color: "rgb(255, 255, 255)",
        font: {
          size: 12,
          weight: "bold" as const, // TypeScript fix
        }
      },
      grid: {
        color: "rgba(255, 255, 255, 0.3)",
      },
      pointLabels: {
        color: "rgb(255, 255, 255)",
        font: {
          size: 14,
          weight: "bold" as const, // TypeScript fix
        },
      },
      angleLines: {
        color: "rgba(255, 255, 255, 0.3)",
      },
    },
  },
  plugins: {
    legend: {
      display: true,
      labels: {
        color: "rgb(255, 255, 255)",
        font: {
          size: 14,
          weight: "bold" as const, // TypeScript fix
        },
        usePointStyle: true,
        pointStyle: 'circle' as const,
      },
    },
    tooltip: {
      titleColor: "rgb(255, 255, 255)",
      bodyColor: "rgb(255, 255, 255)",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
    }
  },
  maintainAspectRatio: false,
  responsive: true,
}

// Fixed lineOptions - replace your existing one
const lineOptions = {
  scales: {
    x: {
      beginAtZero: true,
      grid: {
        color: "rgba(255, 255, 255, 0.2)",
      },
      ticks: {
        color: "rgb(255, 255, 255)",
        font: {
          size: 12,
          weight: "bold" as const, // TypeScript fix
        }
      },
      title: {
        display: true,
        text: 'Date',
        color: "rgb(255, 255, 255)",
        font: {
          size: 14,
          weight: "bold" as const, // TypeScript fix
        }
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: "rgba(255, 255, 255, 0.2)",
      },
      ticks: {
        color: "rgb(255, 255, 255)",
        font: {
          size: 12,
          weight: "bold" as const, // TypeScript fix
        }
      },
      title: {
        display: true,
        text: 'Rating',
        color: "rgb(255, 255, 255)",
        font: {
          size: 14,
          weight: "bold" as const, // TypeScript fix
        }
      }
    },
  },
  plugins: {
    legend: {
      labels: {
        color: "rgb(255, 255, 255)",
        font: {
          size: 14,
          weight: "bold" as const, // TypeScript fix
        },
        usePointStyle: true,
        pointStyle: 'circle' as const,
      },
    },
    tooltip: {
      titleColor: "rgb(255, 255, 255)",
      bodyColor: "rgb(255, 255, 255)",
      backgroundColor: "rgba(0, 0, 0, 0.8)",
    }
  },
  elements: {
    line: {
      tension: 0.3,
    },
    point: {
      radius: 4,
      hoverRadius: 6,
      backgroundColor: "rgba(255, 255, 255, 0.8)",
      borderColor: "rgb(255, 255, 255)",
      borderWidth: 2,
    },
  },
  maintainAspectRatio: false,
  responsive: true,
}


  

  const getColorForAttribute = (attribute: string, value: number) => {
    const values = selectedPlayers.map((playerId) => {
      const player = players.find((p) => p.id.toString() === playerId)
      return getAttributeValue(player, attribute, attributeFilter)
    })
    if (values.length === 0) return ""
    const max = Math.max(...values)
    const min = Math.min(...values)
    if (max === min) return ""
    if (value === max) return "text-green-500 font-bold"
    if (value === min) return "text-red-500 font-bold"
    return ""
  }

  const handleTabChange = (index: number) => {
    setActiveTab(index)
    setSelectedGamePlan(gamePlans[index])
    setNewGamePlanStrategy(gamePlans[index].strategy)
  }

  const handlePrevious = () => {
    if (activeTab > 0) {
      handleTabChange(activeTab - 1)
    }
  }

  const handleNext = () => {
    if (activeTab < gamePlans.length - 1) {
      handleTabChange(activeTab + 1)
    }
  }

  const getPositionColor = (positionName: string): string => {
    if (positionName.includes("Goalkeeper")) return "text-White-600" // White color for GK
    if (positionName.includes("Back")) return "text-lime-200" // Deep lime for defenders
    if (positionName.includes("Midfielder")) return "text-yellow-200" // Deep purple for midfielders
    if (positionName.includes("Striker")) return "text-rose-500" // Deep orange for strikers
    return "text-white"
  }

  const renderPositionContent = (position: any, selectedGamePlan: GamePlan) => {
    if (!selectedGamePlan || !selectedGamePlan.positions) return null

    const playerId = selectedGamePlan.positions[position.id]?.playerId
    const player = players.find((p) => p.id.toString() === playerId)
    const positionColor = getPositionColor(position.name)

    if (player) {
      return (
        <div className="text-white text-center w-full h-full relative flex flex-col items-center justify-center gap-1">
          <Avatar data-player-avatar className={`w-[4.375rem] h-[4.375rem] border-100 ${positionColor.replace("text-", "border-")}`}>
            <AvatarImage
              src={player.photoUrl || "/placeholder.svg"}
              alt={player.name.toUpperCase()}
              className="object-cover w-full h-full"
            />
            <AvatarFallback className="text-lg bg-gray-900 w-full h-full flex items-center justify-center rounded-full">
              {player.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Added padding bottom to ensure text has enough space */}
          <div className="absolute w-[5rem] text-center" style={{ bottom: "-2rem" }}>
            <div className={`text-xs font-semibold px-1 rounded ${positionColor} truncate`}>
              {(() => {
                const nameParts = player.name.split(' ');
                if (nameParts.length >= 2) {
                  // Has both first and last name
                  const firstName = nameParts[0].toUpperCase();
                  const lastName = nameParts.slice(1).join(' ').toUpperCase();
                  return (
                    <div className="flex flex-col leading-tight">
                      <span className="truncate">{firstName}</span>
                      <span className="truncate">{lastName}</span>
                    </div>
                  );
                } else {
                  // Single name or no space
                  return <span className="whitespace-nowrap truncate">{player.name.toUpperCase()}</span>;
                }
              })()}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              handleRemovePlayer(position.id)
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )
    }

    return <div className={`text-base font-medium ${positionColor}`}>{position.shortName}</div>
  }

  // Add this helper function to count positions and goalkeepers
  const countPositions = (selectedGamePlan: GamePlan | null) => {
  if (!selectedGamePlan || !selectedGamePlan.positions) {
    return { totalCount: 0, goalkeeperCount: 0 };
  }

  // Count actual positions that exist in the game plan's positions object
  // This represents what's actually on the field
  const actualPositionIds = Object.keys(selectedGamePlan.positions);
  const totalCount = actualPositionIds.length;

  // Count goalkeepers by checking the position data
  const goalkeeperCount = actualPositionIds.filter(positionId => {
    // Check if it's a goalkeeper position by ID or by looking up position type
    if (positionId === 'gk' || positionId.startsWith('gk')) {
      return true;
    }
    
    // Check in the positions array (default positions)
    const defaultPosition = positions.find(p => p.id === positionId);
    if (defaultPosition && (defaultPosition.type === 'gk' || defaultPosition.shortName === 'GK')) {
      return true;
    }
    
    // Check in custom positions
    const customPosition = customPositions.find(p => p.id === positionId);
    if (customPosition && (customPosition.type === 'gk' || customPosition.shortName === 'GK')) {
      return true;
    }
    
    return false;
  }).length;

  return { totalCount, goalkeeperCount };
};

  // Modify handleAddCustomPosition to include position validation and size update
  const handleAddCustomPosition = () => {
  if (!selectedGamePlan) return;

  // Get current count from what's actually on the field
  const { totalCount, goalkeeperCount } = countPositions(selectedGamePlan);

  // Check total positions - limit to 11
  if (totalCount >= 11) {
    toast({
      title: "Maximum players reached",
      description: "Cannot add more than 11 players",
      variant: "destructive",
    });
    return;
  }

  // Check goalkeeper position
  if (selectedPositionType === "gk" && goalkeeperCount > 0) {
    toast({
      title: "Goalkeeper already exists",
      description: "Only one goalkeeper is allowed in the formation",
      variant: "destructive",
    });
    return;
  }

  const type = POSITION_TYPES.find((t) => t.id === selectedPositionType) || POSITION_TYPES[4];
  const newPosition: Position = {
    id: `custom${Date.now()}`,
    name: type.name,
    shortName: type.shortName,
    type: type.id,
  };

  // Add the new position to customPositions state
  setCustomPositions((prev) => [...prev, newPosition]);

  // Calculate new size based on actual positions + 1
  const newSize = Math.min(totalCount + 1, 11);
  const newTeamSize = totalCount + 1;

  // Add it to the selected game plan's positions and formationPositions
  if (selectedGamePlan) {
    const defaultCoordinates = getDefaultPositionStyle(type.id, newSize);
    const updatedPositions = {
      ...selectedGamePlan.positions,
      [newPosition.id]: {
        playerId: "",
        top: defaultCoordinates.top,
        left: defaultCoordinates.left,
      },
    };

    // Update formationPositions to include the new custom position
    const updatedFormationPositions = [
      ...(selectedGamePlan.formationPositions || []),
      newPosition,
    ];

    const updatedGamePlan = {
      ...selectedGamePlan,
      size: newSize.toString(),
      teamSize: newTeamSize,
      positions: updatedPositions,
      formationPositions: updatedFormationPositions,
    };

    setSelectedGamePlan(updatedGamePlan);

    // Update gamePlans state
    setGamePlans((prev) =>
      prev.map((gp) =>
        gp._id === selectedGamePlan._id ? updatedGamePlan : gp,
      ),
    );
  }

  // Show success toast
  toast({
    title: "Position Added",
    description: `Added new ${type.name} position. Team size increased to ${newSize}`,
  });
};


  const handleRemoveCustomPosition = (positionId: string) => {
    setCustomPositions(customPositions.filter((pos) => pos.id !== positionId))

    if (selectedGamePlan) {
      const updatedPositions = { ...selectedGamePlan.positions }
      delete updatedPositions[positionId]

      setSelectedGamePlan({
        ...selectedGamePlan,
        positions: updatedPositions,
      })
    }
  }

  const handleRemovePosition = (positionId: string) => {
    if (!selectedGamePlan) return;

    // Check if position is original or custom
    const isOriginalPosition =
      positions.some((pos) => pos.id === positionId) ||
      (selectedGamePlan.formationPositions || []).some((pos) => pos.id === positionId);

    if (isOriginalPosition) {
      // Add to deletedPositions to filter out from rendering
      setDeletedPositions((prev) => [...prev, positionId]);
    } else {
      // Remove from customPositions state
      setCustomPositions((prev) => prev.filter((pos) => pos.id !== positionId));
    }

    // Remove position from game plan positions object
    const updatedPositions = { ...selectedGamePlan.positions };
    delete updatedPositions[positionId];

    // Calculate new counts based on remaining positions
    const remainingPositionCount = Object.keys(updatedPositions).length;

    const updatedGamePlan = {
      ...selectedGamePlan,
      positions: updatedPositions,
      size: remainingPositionCount.toString(),
      teamSize: remainingPositionCount,
    };

    setSelectedGamePlan(updatedGamePlan);

    setGamePlans((prev) =>
      prev.map((gp) => (gp._id === selectedGamePlan._id ? updatedGamePlan : gp)),
    );

    toast({
      title: "Position removed",
      description: `${11 - remainingPositionCount} position slots available`,
    });
  };

  const handleResetFormation = () => {
    if (!selectedGamePlan) return

    setDeletedPositions([]) // Clear deleted positions
    setCustomPositions([]) // Clear custom positions

    // Reset to empty positions object
    setSelectedGamePlan({
      ...selectedGamePlan,
      positions: positions.reduce((acc, pos) => ({ ...acc, [pos.id]: null }), {}),
    })
  }

  const handleAddSubstitute = (playerId: string, position: string) => {
    if (!selectedGamePlan) return

    const isAlreadyAssigned =
      Object.values(selectedGamePlan.positions).some((pos) => pos && pos.playerId === playerId) ||
      (selectedGamePlan.substitutes || []).some((sub) => sub.playerId === playerId)

    if (isAlreadyAssigned) {
      toast({
        title: "Player already assigned",
        description: "This player is already in the team or substitutes",
        variant: "destructive",
      })
      return
    }

    // Initialize substitutes array if it doesn't exist
    const currentSubstitutes = selectedGamePlan.substitutes || []

    setSelectedGamePlan({
      ...selectedGamePlan,
      substitutes: [...currentSubstitutes, { playerId, position }],
    })

    setGamePlans(
      gamePlans.map((gp) =>
        gp.id === selectedGamePlan._id
          ? {
              ...gp,
              substitutes: [...(gp.substitutes || []), { playerId, position }],
            }
          : gp,
      ),
    )
  }

  const handleRemoveSubstitute = (playerId: string) => {
    if (!selectedGamePlan) return

    const currentSubstitutes = selectedGamePlan.substitutes || []

    setSelectedGamePlan({
      ...selectedGamePlan,
      substitutes: currentSubstitutes.filter((sub) => sub.playerId !== playerId),
    })

    setGamePlans(
      gamePlans.map((gp) =>
        gp.id === selectedGamePlan._id
          ? {
              ...gp,
              substitutes: (gp.substitutes || []).filter((sub) => sub.playerId !== playerId),
            }
          : gp,
      ),
    )
  }

  const SubstituteModal = () => (
    <Dialog open={showSubstitutesModal} onOpenChange={setShowSubstitutesModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Substitute Player</DialogTitle>
        </DialogHeader>
        <div className="h-[400px] overflow-y-auto">
          {positionGroups.map(([position, players]) => (
            <div key={position} className="mb-4">
              <h3 className="text-sm font-semibold mb-2">{position}</h3>
              {players.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-2 hover:bg-accent rounded-md">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={player.photoUrl || "/placeholder.svg"} alt={player.name} />
                      <AvatarFallback>{player.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span>{player.name}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      handleAddSubstitute(player.id.toString(), position)
                      setShowSubstitutesModal(false)
                    }}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )

  // Update selected batch section to filter batches

  const ExportDialog = () => (
    <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Options</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
<Button
  className="w-full"
  onClick={async () => {
    if (!fieldRef.current || !selectedGamePlan) return

    try {
      // First, temporarily increase the minimum distance between overlapping positions
      const originalStyles: { element: Element; styles: string }[] = []
      
      // Find all position circles and ensure they don't overlap visually
      const playerCircles = fieldRef.current.querySelectorAll('.absolute.w-16.h-16')
      const positions: { element: HTMLElement; rect: DOMRect }[] = []
      
      // Get all position rectangles
      playerCircles.forEach((circle) => {
        const element = circle as HTMLElement
        const rect = element.getBoundingClientRect()
        positions.push({ element, rect })
      })
      
      // Check for overlaps and adjust positions slightly for export
      positions.forEach((pos, index) => {
        const element = pos.element
        originalStyles.push({
          element: element,
          styles: element.style.cssText || ''
        })
        
        // Check if this position overlaps with any other
      const overlapping = positions.slice(index + 1).find(otherPos => {
        const centerX1 = pos.rect.left + pos.rect.width / 3
        const centerY1 = pos.rect.top + pos.rect.height / 3
        const centerX2 = otherPos.rect.left + otherPos.rect.width / 2.3
        const centerY2 = otherPos.rect.top + otherPos.rect.height / 3
        const distance = Math.sqrt(
          Math.pow(centerX1 - centerX2, 2) + 
          Math.pow(centerY1 - centerY2, 2)
        )
        return distance < 70 // If centers are less than 70px apart
      })
        
        if (overlapping) {
          // Slightly adjust position to prevent overlap during capture
          const currentLeft = parseFloat(element.style.left || '50%')
          const currentTop = parseFloat(element.style.top || '50%')
          
          // Small adjustment to ensure separation
          const adjustment = index % 2 === 0 ? -3 : 3 // Alternate left/right adjustment
          element.style.left = `${currentLeft + adjustment}%`
        }
      })
      
      // Wait for DOM to update
      await new Promise(resolve => setTimeout(resolve, 200))

      // Capture with domtoimage
      const image = await domtoimage.toPng(fieldRef.current)

      // Restore all original positions
      originalStyles.forEach(({ element, styles }) => {
        (element as HTMLElement).style.cssText = styles
      })

      // Download the image
      const link = document.createElement("a")
      link.href = image
      link.download = `${selectedGamePlan.name}_formation.png`
      link.click()

      setShowExportDialog(false)
      
      toast({
        title: "Export Successful", 
        description: "Formation exported as PNG image"
      })

    } catch (error) {
      console.error("Error exporting formation:", error)
      
      toast({
        title: "Export Failed",
        description: "Failed to export formation as PNG",
        variant: "destructive",
      })
    }
  }}
>
  Export as Image (PNG)
</Button>
          <Button
            className="w-full"
            onClick={async () => {
              if (!fieldRef.current) {
                toast({
                  title: "Export Failed",
                  description: "Formation field is not ready. Please try again.",
                  variant: "destructive",
                })
                setShowExportDialog(false)
                return
              }

              if (!selectedGamePlan) {
                toast({
                  title: "Export Failed",
                  description: "No game plan selected for export.",
                  variant: "destructive",
                })
                setShowExportDialog(false)
                return
              }

              await exportToPDF(fieldRef, selectedGamePlan, players, batches)
              setShowExportDialog(false)
            }}
          >
            Export as PDF (Formation + Details)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  const handleSaveCustomization = () => {
    // Save the current state
    handleSaveGamePlans()

    // Exit customize mode
    setShowCustomizeMenu(false)

    toast({
      title: "Formation Saved",
      description: "Your customized formation has been saved",
    })
  }

  // Add a component to show position count in customize menu
  const PositionCounter = () => {
    const currentPositions = [...positions.filter((p) => !deletedPositions.includes(p.id)), ...customPositions]
    const { totalCount, goalkeeperCount } = countPositions(selectedGamePlan)
    const currentSize = selectedGamePlan?.teamSize || Number.parseInt(selectedGamePlan?.size || "11")

    return (
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Players: {totalCount}/11</span>
        <span>Goalkeeper: {goalkeeperCount}/1</span>
      </div>
    )
  }

  // Function to change gameplan size by adding/removing positions

  // Add this useEffect to fetch players when component mounts
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        if (!user) {
          console.error("Error: User is not initialized.")
          return
        }

        if (!user.academyId) {
          console.error("Error: Academy ID is missing.")
          return
        }

        setIsLoading(true)

        const response = await fetch(`/api/db/ams-player-data?academyId=${user.academyId}`)
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to fetch players: ${response.status} - ${errorText}`)
        }

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || "Unknown error occurred while fetching players.")
        }

        setPlayers(result.data)
      } catch (error) {
        console.error("Error fetching players:", error)
        toast({
          title: "Error",
          description: "Failed to load players. Please try again later.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (user?.academyId) {
      fetchPlayers()
    }
  }, [user?.academyId, user, setPlayers, toast])
  // Add this useEffect to fetch batches when component mounts
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        if (!user?.academyId || !user?.id) {
          console.log("User or academy ID not available yet")
          return
        }

        const response = await fetch(`/api/db/ams-batches?academyId=${user.academyId}`)
        if (!response.ok) {
          throw new Error("Failed to fetch batches")
        }

        const result = await response.json()
        if (result.success) {
          setBatches(result.data)
          console.log("Batches fetched:", result.data)
        }
      } catch (error) {
        console.error("Error fetching batches:", error)
        toast({
          title: "Error",
          description: "Failed to load batches",
          variant: "destructive",
        })
      }
    }

    fetchBatches()
  }, [user?.academyId, user?.id, setBatches, toast])

  // Updated batch selection section with better debugging
  ;<div className="space-y-4 overflow-x-auto">
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label htmlFor="batch" className="text-white">
          Select Batch ({filteredBatches.length} available)
        </label>
        {selectedBatch && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedBatch(null)}>
            Clear Selection
          </Button>
        )}
      </div>
      <select
        id="batch"
        value={selectedBatch || ""}
        onChange={(e) => {
          console.log("Batch selected:", e.target.value)
          setSelectedBatch(e.target.value)
        }}
        className="w-full p-2 border rounded-md bg-gray-800 text-white"
      >
        <option value="">
          {filteredBatches.length === 0
            ? "No batches available"
            : `Select a batch (${filteredBatches.length} available)`}
        </option>
        {filteredBatches.map((batch) => (
          <option key={batch.id} value={batch.id}>
            {batch.name} {batch.coachId && `(Coach: ${batch.coachId})`}
          </option>
        ))}
      </select>

      {/* Debug information - remove this in production */}
      {process.env.NODE_ENV === "development" && (
        <div className="text-xs text-gray-400 p-2 bg-gray-900 rounded">
          <p>Debug Info:</p>
          <p>Total batches: {batches.length}</p>
          <p>Filtered batches: {filteredBatches.length}</p>
          <p>User Academy ID: {user?.academyId}</p>
          <p>User ID: {user?.id}</p>
        </div>
      )}
    </div>
    {selectedBatch && <ComparePlayers batchId={selectedBatch} />}
  </div>
  // Update handlePositionChange function to properly handle the position value
  const handlePositionChange = async (playerId: string, newPosition: string) => {
    try {
      // Find the position object from AVAILABLE_POSITIONS
      const positionObj = AVAILABLE_POSITIONS.find((pos) => pos.value === newPosition)
      const positionLabel = positionObj ? positionObj.label : "Any Position"

      // Use the label for display but store the value
      const normalizedPosition = newPosition === "any" ? undefined : newPosition

      const response = await fetch(`/api/db/ams-player-data/${playerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: normalizedPosition,
          positionLabel: positionLabel, // Optional: store both value and label
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update position")
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to update position")
      }

      // Update local state with the normalized position
      setPlayers(
        players.map((player) =>
          player.id.toString() === playerId ? { ...player, position: normalizedPosition } : player,
        ),
      )

      toast({
        title: "Success",
        description: "Player position updated successfully",
      })
    } catch (error) {
      console.error("Error updating position:", error)
      toast({
        title: "Error",
        description: "Failed to update player position",
        variant: "destructive",
      })
    }
  }

  // Update the renderPlayersByPosition function
  const renderPlayersByPosition = (position: string) => {
    const players = positionPlayers[position] || []

    return (
      <div className="space-y-2">
        <h3 className="font-semibold">{position}</h3>
        {players.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {players.map((player) => (
              <div
                key={player._id}
                className="flex items-center p-2 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700"
                onClick={() => handlePlayerSelect(player)}
              >
                <div className="w-8 h-8 rounded-full bg-gray-600 mr-2">
                  {player.photoUrl ? (
                    <img
                      src={player.photoUrl || "/placeholder.svg"}
                      alt={player.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">{player.name[0]}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium">{player.name}</div>
                  <div className="text-xs text-gray-400">{player.position}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No players available</div>
        )}
      </div>
    )
  }

  // Update substitute players section
  const renderSubstitutes = () => {
    return (
      <div className="mt-4">
        <h3 className="font-semibold mb-2">Substitute Players</h3>
        {substitutePlayers.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {substitutePlayers.map((player) => (
              <div
                key={player._id}
                className="flex items-center p-2 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700"
                onClick={() => handlePlayerSelect(player)}
              >
                <div className="w-8 h-8 rounded-full bg-gray-600 mr-2">
                  {player.photoUrl ? (
                    <img
                      src={player.photoUrl || "/placeholder.svg"}
                      alt={player.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">{player.name[0]}</div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium">{player.name}</div>
                  <div className="text-xs text-gray-400">Substitute</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No substitute players available</div>
        )}
      </div>
    )
  }

  const handleSaveStrategy = async () => {
    try {
      if (!user?.academyId || !selectedGamePlan) {
        toast({
          title: "Error",
          description: "No academy ID or selected game plan found",
          variant: "destructive",
        })
        return
      }

      // Save the strategy for the selected game plan to MongoDB
      const response = await fetch(`/api/db/ams-gameplan/${selectedGamePlan._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy: selectedGamePlan.strategy,
          updatedAt: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save strategy")
      }

      toast({
        title: "Success",
        description: "Strategy saved successfully",
      })
    } catch (error) {
      console.error("Error saving strategy:", error)
      toast({
        title: "Error",
        description: "Failed to save strategy",
        variant: "destructive",
      })
    }
  }

  const teamSizeForLineup = useMemo(() => {
    // Prefer a numeric teamSize stored in the game plan, fallback to string size, then to the "newGamePlanSize" setting.
    if (selectedGamePlan?.teamSize && typeof selectedGamePlan.teamSize === "number") {
      return selectedGamePlan.teamSize
    }
    if (selectedGamePlan?.size) {
      const parsed = Number.parseInt(String(selectedGamePlan.size))
      return Number.isNaN(parsed) ? 11 : parsed
    }
    const parsedNew = Number.parseInt(newGamePlanSize)
    return Number.isNaN(parsedNew) ? 11 : parsedNew
  }, [selectedGamePlan?.teamSize, selectedGamePlan?.size, newGamePlanSize])

  const lineupPositionsBySize = useMemo(() => {
    try {
      return getPositionsBySize(teamSizeForLineup)
    } catch {
      return getPositionsBySize(11)
    }
  }, [teamSizeForLineup])

  const displayedStartingPositions = useMemo(() => {
  if (!selectedGamePlan) return [];

  // Get all positions that should be displayed
  const allCurrentPositions = [
    // Include default positions that haven't been deleted
    ...positions.filter((p) => !deletedPositions.includes(p.id)),
    // Include all custom positions
    ...customPositions,
    // Include formation-specific positions if they exist and aren't duplicates
    ...(selectedGamePlan?.formationPositions || []).filter(
      (fp) => !positions.some(p => p.id === fp.id) && !customPositions.some(cp => cp.id === fp.id)
    )
  ];

  // Remove any duplicates based on ID
  const uniquePositions = allCurrentPositions.filter(
    (position, index, self) => self.findIndex(p => p.id === position.id) === index
  );

  // Filter to only show positions that actually exist in the game plan's positions object
  // This ensures the table only shows positions that are currently active on the field
  const activePositions = uniquePositions.filter(
    (position) => selectedGamePlan?.positions?.[position.id] !== undefined
  );

  return activePositions;
}, [selectedGamePlan, customPositions, deletedPositions, positions]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      {/* Update the main content container */}
      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className="p-6 space-y-6">
          <CustomTooltip content="Create and manage team formations">
            <h1 className="text-3xl font-bold text-white">Team Builder</h1>
          </CustomTooltip>

          {/* Wrap buttons in a scrollable container */}
          <div className="overflow-x-auto">
            <div className="flex space-x-4 min-w-max pb-2">
              <Button onClick={() =>{setNewGamePlanStrategy(""); setIsCreateDialogOpen(true)}} disabled={gamePlans.length >= 3}>
                Create Game Plan
              </Button>
              <Button onClick={handleSaveGamePlans} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Game Plans"}
              </Button>
              <Button onClick={handleExportField}>Export Formation</Button>
            </div>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Game Plan</DialogTitle>
                <span>Fill in the details below to create a new game plan.</span>
              </DialogHeader>
              <Input
                placeholder="Game Plan Name"
                value={newGamePlanName}
                onChange={(e) => setNewGamePlanName(e.target.value)}
              />
              <Input
                placeholder="Team Size (2-11)"
                type="number"
                min="2"
                max="11"
                value={newGamePlanSize}
                onChange={(e) => {
                  const size = Number.parseInt(e.target.value)
                  if (size >= 2 && size <= 11) {
                    setNewGamePlanSize(e.target.value)
                  } else if (e.target.value === "") {
                    setNewGamePlanSize("")
                  }
                }}
              />
              <Textarea
                placeholder="Notes/Strategies"
                value={newGamePlanStrategy}
                onChange={(e) => setNewGamePlanStrategy(e.target.value)}
              />
              <DialogFooter>
                <Button onClick={handleCreateGamePlan}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {gamePlans.length > 0 && (
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={handlePrevious} disabled={activeTab === 0}>
                <ChevronLeft />
              </Button>
              <span>{gamePlans[activeTab].name}</span>
              <Button variant="outline" onClick={handleNext} disabled={activeTab === gamePlans.length - 1}>
                <ChevronRight />
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setGameplanToDelete(gamePlans[activeTab]?._id || null)
                  setShowDeleteDialog(true)
                }}
              >
                Delete Game Plan
              </Button>
              <DeleteConfirmationDialog />
            </div>
          )}

          {/* Update the grid layout to be more responsive */}
          {selectedGamePlan && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-4">
              {/* Players list card */}
              <Card className="order-2 lg:order-1 min-w-0">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Players by Position</span>
                    {selectedBatch && (
                      <span className="text-sm text-blue-400 font-normal">
                        Batch: {filteredBatches.find((b) => b.id === selectedBatch)?.name}
                      </span>
                    )}
                  </CardTitle>
                  {selectedBatch && availablePlayers.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No players available in the selected batch that aren't already assigned.
                    </p>
                  )}
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="space-y-4">
                    {positionGroups.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {selectedBatch ? "No available players in the selected batch" : "No available players"}
                      </div>
                    ) : (
                      positionGroups.map(([position, positionPlayers]) => (
                        <div key={position}>
                          <h3 className="text-sm font-semibold text-muted-foreground mb-2">{position}</h3>
                          <div className="space-y-2">
                            {positionPlayers.map((player) => (
                              <div
                                key={player.id}
                                className="bg-secondary p-2 rounded-md text-xs flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <div
                                    className="cursor-move"
                                    draggable
                                    onDragStart={(e) => handlePlayerDragStart(e, player.id.toString())}
                                  >
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={player.photoUrl || "/placeholder.svg"} alt={player.name} />
                                      <AvatarFallback>{player.name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{player.name}</span>
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={getPositionValue(player.position)}
                                        onChange={(e) => handlePositionChange(player.id.toString(), e.target.value)}
                                        className="text-xs bg-background border rounded px-1 py-0.5"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {AVAILABLE_POSITIONS.map((pos) => (
                                          <option key={pos.value} value={pos.value}>
                                            {pos.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Separator className="my-4" />
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Formation card */}
              <Card className="order-1 lg:order-2 min-w-0">
                <CardHeader className="flex flex-row justify-between items-center">
                  <div className="space-y-2">
                    <CardTitle>{selectedGamePlan?.name} - Formation</CardTitle>
                    {showCustomizeMenu && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-yellow-500">Edit Mode Active</span>
                          <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Player assignment is disabled while in formation customize mode. Exit customize mode to assign
                          players to positions.
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowCustomizeMenu(!showCustomizeMenu)}>
                      {showCustomizeMenu ? "Exit Customize" : "Customize Formation"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <ScrollArea className="w-full max-h-[800px] overflow-y-auto">
                    <div
                      ref={fieldRef}
                      className={`relative w-full max-w-[600px] aspect-[0.68] bg-green-700 rounded-md mb-4 mx-auto ${
                        showCustomizeMenu ? "border-4 border-dashed border-yellow-500/50" : ""
                      }`}
                      style={{ minWidth: "300px" }}
                      onDragOver={handleDragOver}
                      onDrop={handlePositionDropOnMap}
                    >
                      {/* Field markings - update the outer border to not conflict with dashed border */}
                      <div className="absolute inset-0">
                        <div
                          className={`absolute inset-2 border-2 border-white/50 ${
                            showCustomizeMenu ? "border-white/30" : ""
                          }`}
                        />
                        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/50" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[15%] rounded-full border-2 border-white/50" />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-[15%] border-2 border-b-0 border-white/50" />
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[15%] border-2 border-t-0 border-white/50" />
                      </div>

                      {/* Player positions */}
                      {(selectedGamePlan?.formationPositions || positions)
                        .filter((p: Position) => !deletedPositions.includes(p.id))
                        .concat(customPositions)
                        .map((position: Position) => (
                          <div
                            key={position.id}
                            className="absolute w-16 h-16 bg-white/30 hover:bg-white/40 transition-colors rounded-full flex items-center justify-center border-2 border-white/50 cursor-move group"
                            style={getPositionStyle(position.id, selectedGamePlan)}
                            draggable={showCustomizeMenu}
                            onDragStart={(e) => handlePositionDragStart(e, position.id)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handlePositionDrop(e, position.id)}
                            onClick={() => handlePositionClick(position)}
                          >
                            {renderPositionContent(position, selectedGamePlan)}
                            {showCustomizeMenu && (
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-4 w-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemovePosition(position.id)
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                    </div>
                  </ScrollArea>

                  {/* Add customization menu */}
                  {showCustomizeMenu && (
                    <div className="mt-4 w-full border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Formation Customization</h3>
                        <PositionCounter />
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setShowCustomizeMenu(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleSaveCustomization}>Save Changes</Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Add New Position</h4>
                          <div className="flex gap-2">
                            <select
                              value={selectedPositionType}
                              onChange={(e) => setSelectedPositionType(e.target.value)}
                              className="bg-background border rounded px-2 py-1"
                            >
                              {POSITION_TYPES.map((type) => (
                                <option key={type.id} value={type.id}>
                                  {type.name}
                                </option>
                              ))}
                            </select>
                            <Button variant="outline" size="sm" onClick={handleAddCustomPosition}>
                              Add
                            </Button>
                          </div>
                        </div>

                        <Button variant="destructive" onClick={handleResetFormation} className="mt-2">
                          Reset Formation
                        </Button>
                        <div className="text-sm text-muted-foreground">
                          Drag positions to move them on the field. All positions can be deleted by hovering and
                          clicking the X.
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Make other sections scrollable */}
          <div className="space-y-4 overflow-x-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label htmlFor="batch" className="text-white">
                  Select Batch
                </label>
                {selectedBatch && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBatch(null)}>
                    Clear Selection
                  </Button>
                )}
              </div>
              <select
                id="batch"
                value={selectedBatch || ""}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full p-2 border rounded-md bg-gray-800 text-white"
              >
                <option value="">Select a batch</option>
                {filteredBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedBatch && <ComparePlayers batchId={selectedBatch} />}
            <div className="space-y-4">
  <Button onClick={() => setIsDialogOpen(true)}>Compare Players</Button>
  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
    <DialogContent className="max-h-[80vh] max-w-[80vw] overflow-y-auto bg-gray-900 text-white border-gray-700">
      <DialogHeader className="border-b border-gray-700 pb-4">
        <DialogTitle className="text-white text-xl font-bold">Compare Players</DialogTitle>
      </DialogHeader>
      <CardContent className="pt-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-gray-800 text-white border-gray-600 hover:bg-gray-700">
              Select Players
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 bg-gray-800 border-gray-600">
            <Input
              placeholder="Search players"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2 bg-gray-700 text-white border-gray-600"
            />
            {/* Use filteredPlayers here which now includes academyId filter */}
            {filteredPlayers.map((player) => (
              <DropdownMenuItem
                key={player.id}
                onSelect={() => handlePlayerSelection(player.id.toString())}
                className="text-white hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={selectedPlayers.includes(player.id.toString())}
                  onChange={() => handlePlayerSelection(player.id.toString())}
                  className="mr-2"
                />
                <span className="text-white font-medium">{player.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={handleDeselectAll} className="hover:bg-gray-700">
              <Button variant="outline" className="w-full bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
                Deselect All
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="mt-4">
          <div className="flex justify-center mb-4">
            <div className="flex items-center space-x-2 bg-gray-800 p-3 rounded-lg border border-gray-600">
              <span className="text-sm font-bold text-white">View:</span>
              <div className="flex space-x-2">
                <Button
                  variant={attributeFilter === "latest" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAttributeFilter("latest")}
                  className={attributeFilter === "latest" ? "bg-blue-600 text-white" : "bg-gray-700 text-white border-gray-600 hover:bg-gray-600"}
                >
                  Latest
                </Button>
                <Button
                  variant={attributeFilter === "overall" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAttributeFilter("overall")}
                  className={attributeFilter === "overall" ? "bg-blue-600 text-white" : "bg-gray-700 text-white border-gray-600 hover:bg-gray-600"}
                >
                  Overall
                </Button>
              </div>
            </div>
          </div>
          <div className="w-full h-[500px] bg-gray-800 p-4 rounded-lg">
            <Radar data={radarData} options={radarOptions} />
          </div>
        </div>
        <div className="mt-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="border-b border-gray-700">
              <CardTitle className="text-white text-lg font-bold">Attribute Comparison</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-700">
                    <TableHead className="text-white font-bold text-base">Attribute</TableHead>
                    {selectedPlayers.map((playerId) => (
                      <TableHead key={playerId} className="text-white font-bold text-base">
                        {players.find((p) => p.id.toString() === playerId)?.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {["Attack", "pace", "Physicality", "Defense", "passing", "Technique"].map((attr) => (
                    <TableRow key={attr} className="border-b border-gray-700">
                      <TableCell className="text-white font-semibold text-base">
                        {attr.charAt(0).toUpperCase() + attr.slice(1)}
                      </TableCell>
                      {selectedPlayers.map((playerId) => {
                        const player = players.find((p) => p.id.toString() === playerId)
                        const value = getAttributeValue(player, attr, attributeFilter)
                        return (
                          <TableCell 
                            key={playerId} 
                            className={`text-white font-bold text-base ${getColorForAttribute(attr, value)}`}
                          >
                            {typeof value === "number" ? value.toFixed(1) : "0.0"}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div className="mt-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="border-b border-gray-700">
              <CardTitle className="text-white text-lg font-bold">Performance Graph</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {["Attack", "pace", "Physicality", "Defense", "passing", "Technique"].map((attr) => (
                  <Button
                    key={attr}
                    variant={selectedAttribute === attr ? "default" : "outline"}
                    onClick={() => setSelectedAttribute(attr)}
                    className={selectedAttribute === attr 
                      ? "bg-blue-600 text-white font-semibold" 
                      : "bg-gray-700 text-white border-gray-600 hover:bg-gray-600 font-semibold"
                    }
                  >
                    {attr.charAt(0).toUpperCase() + attr.slice(1)}
                  </Button>
                ))}
              </div>
              <div className="h-[400px] bg-gray-900 p-4 rounded-lg">
                <Line data={lineData(selectedAttribute)} options={lineOptions} />
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </DialogContent>
  </Dialog>
</div>
            <div className="space-y-4">
              <Textarea
                placeholder="Game Strategy"
                value={newGamePlanStrategy}
                onChange={(e) => setNewGamePlanStrategy(e.target.value)}
                className="max-w-[1000px]"
              />
              
            </div>
          </div>

          {/* Update team table container */}
          {selectedGamePlan && (
  <div className="space-y-4 overflow-x-auto">
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="min-w-[600px]">
          {/* Starting lineup table */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Starting Lineup</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Player</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Get all current active positions including custom ones and excluding deleted ones */}
                {(() => {
                  // Get all positions that should be displayed
                  const allCurrentPositions = [
                    // Include default positions that haven't been deleted
                    ...positions.filter((p) => !deletedPositions.includes(p.id)),
                    // Include all custom positions
                    ...customPositions,
                    // Include formation-specific positions if they exist and aren't duplicates
                    ...(selectedGamePlan?.formationPositions || []).filter(
                      (fp) => !positions.some(p => p.id === fp.id) && !customPositions.some(cp => cp.id === fp.id)
                    )
                  ];

                  // Remove any duplicates based on ID
                  const uniquePositions = allCurrentPositions.filter(
                    (position, index, self) => self.findIndex(p => p.id === position.id) === index
                  );

                  // Filter to only show positions that exist in the game plan's positions object
                  const activePositions = uniquePositions.filter(
                    (position) => selectedGamePlan?.positions?.[position.id] !== undefined
                  );

                  return activePositions.map((position) => {
                    if (!selectedGamePlan || !selectedGamePlan.positions) return null;

                    const positionData = selectedGamePlan.positions[position.id];
                    const player = players.find((p) => p.id.toString() === positionData?.playerId);
                    
                    return (
                      <TableRow key={position.id}>
                        <TableCell>{position.name}</TableCell>
                        <TableCell>
                          {player ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={player?.photoUrl || "/placeholder.svg"} alt={player?.name} />
                                <AvatarFallback>{player?.name?.[0]}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-medium">{player?.name}</span>
                                <span className="text-sm text-muted-foreground">{player?.position}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>

          {/* Substitutes section */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Substitutes</h3>
              <Button variant="outline" onClick={() => setShowSubstitutesModal(true)}>
                Add Substitute
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedGamePlan?.substitutes || []).map((sub) => {
                  const player = players.find((p) => p.id.toString() === sub.playerId);
                  return (
                    <TableRow key={sub.playerId}>
                      <TableCell>{sub.position}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={player?.photoUrl || "/placeholder.svg"} alt={player?.name} />
                            <AvatarFallback>{player?.name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium">{player?.name}</span>
                            <span className="text-sm text-muted-foreground">{player?.position}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveSubstitute(sub.playerId)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
)}
        </div>
      </div>
      <SubstituteModal />
      <ExportDialog />
      <PlayerSelectionModal /> {/* Add this line to render the PlayerSelectionModal */}
    </div>
  )
}

function getPositionStyle(positionId: string, selectedGamePlan: GamePlan | null): React.CSSProperties {
  if (!selectedGamePlan || !selectedGamePlan.positions) {
    const defaultCoordinates = getDefaultPositionStyle(positionId)
    return {
      top: defaultCoordinates.top,
      left: defaultCoordinates.left,
      transform: "translate(-50%, -50%)",
    }
  }

  const position = selectedGamePlan.positions[positionId]
  const defaultCoordinates = getDefaultPositionStyle(positionId)
  return {
    top: position?.top || defaultCoordinates.top,
    left: position?.left || defaultCoordinates.left,
    transform: "translate(-50%, -50%)",
  }
}

// Helper function to map player.position to the corresponding value in AVAILABLE_POSITIONS
function getPositionValue(position: string | undefined): string {
  if (!position) return "any"
  // Try to find a matching value in AVAILABLE_POSITIONS
  const found = AVAILABLE_POSITIONS.find((pos) => pos.value.toLowerCase() === position.toLowerCase())
  if (found) return found.value
  // Try to match by label as fallback
  const foundByLabel = AVAILABLE_POSITIONS.find((pos) => pos.label.toLowerCase() === position.toLowerCase())
  if (foundByLabel) return foundByLabel.value
  return "any"
}

const getDefaultPositionStyle = (positionId: string, teamSize = 11): { top: string; left: string } => {
  // Formation templates based on team size
  const formationCoordinates: { [key: number]: { [key: string]: { top: string; left: string } } } = {
    2: {
      gk: { top: "85%", left: "50%" },
      st1: { top: "15%", left: "50%" },
    },
    3: {
      gk: { top: "85%", left: "50%" },
      cb1: { top: "65%", left: "50%" },
      st1: { top: "15%", left: "50%" },
    },
    4: {
      gk: { top: "85%", left: "50%" },
      cb1: { top: "65%", left: "50%" },
      cm1: { top: "45%", left: "50%" },
      st1: { top: "15%", left: "50%" },
    },
    5: {
      gk: { top: "85%", left: "50%" },
      cb1: { top: "65%", left: "50%" },
      cm1: { top: "45%", left: "50%" },
      st1: { top: "15%", left: "35%" },
      st2: { top: "15%", left: "65%" },
    },
    6: {
      gk: { top: "85%", left: "50%" },
      cb1: { top: "65%", left: "35%" },
      cb2: { top: "65%", left: "65%" },
      cm1: { top: "45%", left: "50%" },
      st1: { top: "15%", left: "35%" },
      st2: { top: "15%", left: "65%" },
    },
    7: {
      gk: { top: "85%", left: "50%" },
      cb1: { top: "65%", left: "35%" },
      cb2: { top: "65%", left: "65%" },
      cm1: { top: "45%", left: "35%" },
      cm2: { top: "45%", left: "65%" },
      st1: { top: "15%", left: "35%" },
      st2: { top: "15%", left: "65%" },
    },
    8: {
      gk: { top: "85%", left: "50%" },
      lb: { top: "65%", left: "20%" },
      cb1: { top: "65%", left: "45%" },
      rb: { top: "65%", left: "80%" },
      cm1: { top: "45%", left: "35%" },
      cm2: { top: "45%", left: "65%" },
      st1: { top: "15%", left: "35%" },
      st2: { top: "15%", left: "65%" },
    },
    9: {
      gk: { top: "85%", left: "50%" },
      lb: { top: "65%", left: "20%" },
      cb1: { top: "65%", left: "40%" },
      cb2: { top: "65%", left: "60%" },
      rb: { top: "65%", left: "80%" },
      cm1: { top: "45%", left: "35%" },
      cm2: { top: "45%", left: "65%" },
      st1: { top: "15%", left: "35%" },
      st2: { top: "15%", left: "65%" },
    },
    10: {
      gk: { top: "85%", left: "50%" },
      lb: { top: "65%", left: "20%" },
      cb1: { top: "65%", left: "40%" },
      cb2: { top: "65%", left: "60%" },
      rb: { top: "65%", left: "80%" },
      lm: { top: "45%", left: "20%" },
      cm1: { top: "45%", left: "50%" },
      rm: { top: "45%", left: "80%" },
      st1: { top: "15%", left: "35%" },
      st2: { top: "15%", left: "65%" },
    },
    11: {
      gk: { top: "90%", left: "50%" },
      lb: { top: "75%", left: "20%" },
      cb1: { top: "75%", left: "40%" },
      cb2: { top: "75%", left: "60%" },
      rb: { top: "75%", left: "80%" },
      lm: { top: "45%", left: "20%" },
      cm1: { top: "45%", left: "40%" },
      cm2: { top: "45%", left: "60%" },
      rm: { top: "45%", left: "80%" },
      st1: { top: "15%", left: "35%" },
      st2: { top: "15%", left: "65%" },
    },
  }

  return formationCoordinates[teamSize]?.[positionId] || { top: "50%", left: "50%" }
}

// Add a function to get positions based on team size
const getPositionsBySize = (size: number): Position[] => {
  const formationTemplates: { [key: number]: Position[] } = {
    2: [
      { id: "gk", name: "Goalkeeper", shortName: "GK", type: "gk" },
      { id: "st1", name: "Striker", shortName: "ST", type: "fwd" },
    ],
    3: [
      { id: "gk", name: "Goalkeeper", shortName: "GK", type: "gk" },
      { id: "cb1", name: "Center Back", shortName: "CB", type: "def" },
      { id: "st1", name: "Striker", shortName: "ST", type: "fwd" },
    ],
    4: [
      { id: "gk", name: "Goalkeeper", shortName: "GK", type: "gk" },
      { id: "cb1", name: "Center Back", shortName: "CB", type: "def" },
      { id: "cm1", name: "Center Midfielder", shortName: "CM", type: "mid" },
      { id: "st1", name: "Striker", shortName: "ST", type: "fwd" },
    ],
    5: [
      { id: "gk", name: "Goalkeeper", shortName: "GK", type: "gk" },
      { id: "cb1", name: "Center Back", shortName: "CB", type: "def" },
      { id: "cm1", name: "Center Midfielder", shortName: "CM", type: "mid" },
      { id: "st1", name: "Striker 1", shortName: "ST", type: "fwd" },
      { id: "st2", name: "Striker 2", shortName: "ST", type: "fwd" },
    ],
    6: [
      { id: "gk", name: "Goalkeeper", shortName: "GK", type: "gk" },
      { id: "cb1", name: "Center Back 1", shortName: "CB", type: "def" },
      { id: "cb2", name: "Center Back 2", shortName: "CB", type: "def" },
      { id: "cm1", name: "Center Midfielder", shortName: "CM", type: "mid" },
      { id: "st1", name: "Striker 1", shortName: "ST", type: "fwd" },
      { id: "st2", name: "Striker 2", shortName: "ST", type: "fwd" },
    ],
    7: [
      { id: "gk", name: "Goalkeeper", shortName: "GK", type: "gk" },
      { id: "cb1", name: "Center Back 1", shortName: "CB", type: "def" },
      { id: "cb2", name: "Center Back 2", shortName: "CB", type: "def" },
      { id: "cm1", name: "Center Midfielder 1", shortName: "CM", type: "mid" },
      { id: "cm2", name: "Center Midfielder 2", shortName: "CM", type: "mid" },
      { id: "st1", name: "Striker 1", shortName: "ST", type: "fwd" },
      { id: "st2", name: "Striker 2", shortName: "ST", type: "fwd" },
    ],
    8: [
      { id: "gk", name: "Goalkeeper", shortName: "GK", type: "gk" },
      { id: "lb", name: "Left Back", shortName: "LB", type: "def" },
      { id: "cb1", name: "Center Back", shortName: "CB", type: "def" },
      { id: "rb", name: "Right Back", shortName: "RB", type: "def" },
      { id: "cm1", name: "Center Midfielder 1", shortName: "CM", type: "mid" },
      { id: "cm2", name: "Center Midfielder 2", shortName: "CM", type: "mid" },
      { id: "st1", name: "Striker 1", shortName: "ST", type: "fwd" },
      { id: "st2", name: "Striker 2", shortName: "ST", type: "fwd" },
    ],
    9: [
      { id: "gk", name: "Goalkeeper", shortName: "GK", type: "gk" },
      { id: "lb", name: "Left Back", shortName: "LB", type: "def" },
      { id: "cb1", name: "Center Back 1", shortName: "CB", type: "def" },
      { id: "cb2", name: "Center Back 2", shortName: "CB", type: "def" },
      { id: "rb", name: "Right Back", shortName: "RB", type: "def" },
      { id: "cm1", name: "Center Midfielder 1", shortName: "CM", type: "mid" },
      { id: "cm2", name: "Center Midfielder 2", shortName: "CM", type: "mid" },
      { id: "st1", name: "Striker 1", shortName: "ST", type: "fwd" },
      { id: "st2", name: "Striker 2", shortName: "ST", type: "fwd" },
    ],
    10: [
      { id: "gk", name: "Goalkeeper", shortName: "GK", type: "gk" },
      { id: "lb", name: "Left Back", shortName: "LB", type: "def" },
      { id: "cb1", name: "Center Back 1", shortName: "CB", type: "def" },
      { id: "cb2", name: "Center Back 2", shortName: "CB", type: "def" },
      { id: "rb", name: "Right Back", shortName: "RB", type: "def" },
      { id: "lm", name: "Left Midfielder", shortName: "LM", type: "mid" },
      { id: "cm1", name: "Center Midfielder", shortName: "CM", type: "mid" },
      { id: "rm", name: "Right Midfielder", shortName: "RM", type: "mid" },
      { id: "st1", name: "Striker 1", shortName: "ST", type: "fwd" },
      { id: "st2", name: "Striker 2", shortName: "ST", type: "fwd" },
    ],
    11: [
      { id: "gk", name: "Goalkeeper", shortName: "GK", type: "gk" },
      { id: "lb", name: "Left Back", shortName: "LB", type: "def" },
      { id: "cb1", name: "Center Back 1", shortName: "CB", type: "def" },
      { id: "cb2", name: "Center Back 2", shortName: "CB", type: "def" },
      { id: "rb", name: "Right Back", shortName: "RB", type: "def" },
      { id: "lm", name: "Left Midfielder", shortName: "LM", type: "mid" },
      { id: "cm1", name: "Center Midfielder 1", shortName: "CM", type: "mid" },
      { id: "cm2", name: "Center Midfielder 2", shortName: "CM", type: "mid" },
      { id: "rm", name: "Right Midfielder", shortName: "RM", type: "mid" },
      { id: "st1", name: "Striker 1", shortName: "ST", type: "fwd" },
      { id: "st2", name: "Striker 2", shortName: "ST", type: "fwd" },
    ],
  }

  return formationTemplates[size] || formationTemplates[11]
}
