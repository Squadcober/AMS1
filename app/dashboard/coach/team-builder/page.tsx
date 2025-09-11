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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import jsPDF from "jspdf"

interface Player {
  id: string | number
  name: string
  position?: string
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
  "rgba(255,99,132,0.5)",
  "rgba(54,162,235,0.5)",
  "rgba(255,206,86,0.5)",
  "rgba(75,192,192,0.5)",
  "rgba(153,102,255,0.5)",
  "rgba(255,159,64,0.5)",
  "rgba(199,199,199,0.5)",
  "rgba(255,99,255,0.5)",
  "rgba(99,255,132,0.5)",
  "rgba(99,132,255,0.5)",
  "rgba(255,222,99,0.5)",
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
  _id?: string
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
  formationPositions?: Position[]
  teamSize?: number
}

interface AvailablePosition {
  value: string
  label: string
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

const checkPositionOverlap = (
  pos1: { top: string; left: string },
  pos2: { top: string; left: string },
  minDistancePercent: number = 5
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

const findNonOverlappingPosition = (
  targetPos: { top: string; left: string },
  existingPositions: { [key: string]: { playerId: string; top: string; left: string } | null },
  excludePositionId: string,
  minDistancePercent: number = 12
): { top: string; left: string } => {
  const targetTop = parseFloat(targetPos.top)
  const targetLeft = parseFloat(targetPos.left)

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

  const maxSearchRadius = 25
  const angleStep = 10
  const radiusStep = 0.5

  for (let radius = radiusStep; radius <= maxSearchRadius; radius += radiusStep) {
    const positions = []

    for (let angle = 0; angle < 360; angle += angleStep) {
      const radians = (angle * Math.PI) / 180
      const offsetTop = radius * Math.cos(radians)
      const offsetLeft = radius * Math.sin(radians)

      const testTop = Math.max(5, Math.min(95, targetTop + offsetTop))
      const testLeft = Math.max(5, Math.min(95, targetLeft + offsetLeft))
      const testPos = { top: `${testTop}%`, left: `${testLeft}%` }

      const actualDistance = Math.sqrt(
        Math.pow(testTop - targetTop, 2) + Math.pow(testLeft - targetLeft, 2)
      )

      positions.push({ pos: testPos, distance: actualDistance })
    }

    positions.sort((a, b) => a.distance - b.distance)

    for (const { pos } of positions) {
      if (isPositionValid(pos)) {
        return pos
      }
    }
  }

  const cardinalDirections = [
    { top: 0, left: minDistancePercent + 1 },
    { top: 0, left: -(minDistancePercent + 1) },
    { top: minDistancePercent + 1, left: 0 },
    { top: -(minDistancePercent + 1), left: 0 },
  ]

  for (const direction of cardinalDirections) {
    const testTop = Math.max(5, Math.min(95, targetTop + direction.top))
    const testLeft = Math.max(5, Math.min(95, targetLeft + direction.left))
    const testPos = { top: `${testTop}%`, left: `${testLeft}%` }

    if (isPositionValid(testPos)) {
      return testPos
    }
  }

  let closestValidPosition = null
  let minDistance = Infinity

  for (let topOffset = -20; topOffset <= 20; topOffset += 1) {
    for (let leftOffset = -20; leftOffset <= 20; leftOffset += 1) {
      if (topOffset === 0 && leftOffset === 0) continue

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
  { value: "leftback", label: "Left Back" },
  { value: "rightback", label: "Right Back" },
  { value: "centreback", label: "Centre Back" },
  { value: "defender", label: "Defender" },
  { value: "defensivemid", label: "Defensive Midfielder" },
  { value: "centralmid", label: "Central Midfielder" },
  { value: "attackingmid", label: "Attacking Midfielder" },
  { value: "leftmid", label: "Left Midfielder" },
  { value: "rightmid", label: "Right Midfielder" },
  { value: "midfielder", label: "Midfielder" },
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
  const fieldRef = useRef<HTMLDivElement>(null)
  const [customPositions, setCustomPositions] = useState<Position[]>([])
  const [showCustomizeMenu, setShowCustomizeMenu] = useState(false)
  const [selectedPositionType, setSelectedPositionType] = useState<string>("any")
  const [deletedPositions, setDeletedPositions] = useState<string[]>([])
  const [showSubstitutesModal, setShowSubstitutesModal] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [positionPlayers, setPositionPlayers] = useState<{ [key: string]: any[] }>({})
  const [substitutePlayers, setSubstitutePlayers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFormation, setSelectedFormation] = useState<string>("4-4-2")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [gameplanToDelete, setGameplanToDelete] = useState<string | null>(null)
  const [attributeFilter, setAttributeFilter] = useState<"latest" | "overall">("latest")
  const [attributeFilterState, setAttributeFilterState] = useState<"latest" | "overall">("latest")
  const [isSaving, setIsSaving] = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  // Touch drag state for mobile support
  const [isTouchDragging, setIsTouchDragging] = useState(false)
  const [touchDraggedItem, setTouchDraggedItem] = useState<string | null>(null)
  const [touchDraggedType, setTouchDraggedType] = useState<'position' | 'player' | null>(null)
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null)

  // Existing functions...

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

  // Stub implementations for missing functions and components

  const handleSaveGamePlans = () => {
    // Stub: Implement save logic here
    console.log("Save game plans clicked")
  }

  const handleExportField = () => {
    // Stub: Implement export logic here
    console.log("Export formation clicked")
  }

  const handlePositionDropOnMap = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    // Stub: Implement position drop on map logic here
    console.log("Position dropped on map")
  }

  const getPositionStyle = (positionId: string, gamePlan: GamePlan | null): React.CSSProperties => {
    if (!gamePlan) return {}
    const pos = gamePlan.positions[positionId]
    if (!pos) return {}
    return {
      top: pos.top,
      left: pos.left,
      position: "absolute",
    }
  }

  const handlePositionDragStart = (e: React.DragEvent<HTMLDivElement>, positionId: string) => {
    e.dataTransfer.setData("text/plain", positionId)
    setDraggedPosition(positionId)
  }

  const handlePositionDrop = (e: React.DragEvent<HTMLDivElement>, positionId: string) => {
    e.preventDefault()
    // Stub: Implement position drop logic here
    console.log(`Position dropped on ${positionId}`)
  }

  const handlePositionClick = (position: Position) => {
    // Stub: Implement position click logic here
    console.log(`Position clicked: ${position.id}`)
  }

  const renderPositionContent = (position: Position, gamePlan: GamePlan | null) => {
    // Stub: Render position content here
    return <span>{position.shortName}</span>
  }

  const handleRemovePosition = (positionId: string) => {
    // Stub: Implement remove position logic here
    console.log(`Remove position: ${positionId}`)
  }

  const SubstituteModal = () => {
    return <div style={{ display: "none" }}></div>
  }

  const ExportDialog = () => {
    return <div style={{ display: "none" }}></div>
  }

  const PlayerSelectionModal = () => {
    return <div style={{ display: "none" }}></div>
  }

  // Touch event handlers for mobile drag support

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, id: string, type: 'position' | 'player') => {
    e.stopPropagation()
    setIsTouchDragging(true)
    setTouchDraggedItem(id)
    setTouchDraggedType(type)
    const touch = e.touches[0]
    setTouchStartPos({ x: touch.clientX, y: touch.clientY })
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isTouchDragging || !touchDraggedItem || !touchDraggedType || !fieldRef.current) return

    e.preventDefault()
    const touch = e.touches[0]
    const rect = fieldRef.current.getBoundingClientRect()

    let topPercent = ((touch.clientY - rect.top) / rect.height) * 100
    let leftPercent = ((touch.clientX - rect.left) / rect.width) * 100

    topPercent = Math.min(100, Math.max(0, topPercent))
    leftPercent = Math.min(100, Math.max(0, leftPercent))

    if (!selectedGamePlan) return

    if (touchDraggedType === 'position') {
      const currentPosition = selectedGamePlan.positions[touchDraggedItem]
      if (!currentPosition) return

      const nonOverlappingPos = findNonOverlappingPosition(
        { top: `${topPercent}%`, left: `${leftPercent}%` },
        selectedGamePlan.positions,
        touchDraggedItem
      )

      const updatedPosition = {
        ...currentPosition,
        top: nonOverlappingPos.top,
        left: nonOverlappingPos.left,
      }

      const updatedPositions = {
        ...selectedGamePlan.positions,
        [touchDraggedItem]: updatedPosition,
      }

      setSelectedGamePlan({
        ...selectedGamePlan,
        positions: updatedPositions,
      })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isTouchDragging) return
    setIsTouchDragging(false)
    setTouchDraggedItem(null)
    setTouchDraggedType(null)
    setTouchStartPos(null)
  }

  // Existing JSX rendering...

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className="p-6 space-y-6">
          <CustomTooltip content="Create and manage team formations">
            <h1 className="text-3xl font-bold text-white">Team Builder</h1>
          </CustomTooltip>

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

          {/* Other dialogs and UI components */}

          {selectedGamePlan && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-4">
              <Card className="order-2 lg:order-1 min-w-0">
                {/* Players list card content */}
              </Card>

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
                      <div className="absolute inset-0">
                        <div
                          className={`absolute inset-2 border-2 border-white/50 ${
                            showCustomizeMenu ? "border-white/30" : ""
                          }`}
                        />
                        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/50" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[15%] rounded-full border-2 border-white/50" />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-[15%] border-2 border-b-0 border-white/50" />
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[15%] border-2 border-t-0 border-white/50"  />
                        {showCustomizeMenu && (
                          <>
                            <div className="absolute left-0 right-0 top-[28.33%] border-t-4 border-dashed border-yellow-500/50" />
                            <div className="absolute left-0 right-0 top-[66.66%] border-t-4 border-dashed border-yellow-500/50" />
                          </>
                        )}
                      </div>

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
                            onTouchStart={(e) => handleTouchStart(e, position.id, 'position')}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
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

                  {showCustomizeMenu && (
                    <div className="mt-4 w-full border rounded-lg p-4">
                      {/* Customization menu content */}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Other UI components */}
        </div>
      </div>
      <SubstituteModal />
      <ExportDialog />
      <PlayerSelectionModal />
    </div>
  )
}

// Other helper functions remain unchanged
