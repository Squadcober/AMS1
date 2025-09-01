"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Sidebar from "@/components/Sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"

interface User {
  id: string
  name: string
  email: string
  academyId: string
  status: string
}

interface Session {
  _id: string
  id: string
  name: string
  date: string
  startTime: string
  endTime: string
  status: "Upcoming" | "Finished" | "On-going"
  assignedPlayers: string[]
  attendance: {
    [playerId: string]: {
      status: "Present" | "Absent"
      markedAt: string
      markedBy: string
    }
  }
  isOccurrence: boolean
  parentSessionId?: string
  academyId: string
}

interface PlayerAttendanceSummary {
  playerId: string
  totalSessions: number
  present: number
  absent: number
  unmarked: number
  presentDates: string[]
  absentDates: string[]
  unmarkedDates: string[]
}

const updateSessionStatus = (sessions: Session[]): Session[] => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return sessions.map(session => {
    const occurrenceDateTime = new Date(session.date)
    const [startHour, startMinute] = session.startTime.split(":").map(Number)
    const [endHour, endMinute] = session.endTime.split(":").map(Number)

    const sessionStart = new Date(occurrenceDateTime)
    sessionStart.setHours(startHour, startMinute, 0)

    const sessionEnd = new Date(occurrenceDateTime)
    sessionEnd.setHours(endHour, endMinute, 0)

    let status: Session["status"]
    if (occurrenceDateTime < today) {
      status = "Finished"
    } else if (occurrenceDateTime.getTime() === today.getTime()) {
      if (now >= sessionEnd) {
        status = "Finished"
      } else if (now >= sessionStart && now <= sessionEnd) {
        status = "On-going"
      } else {
        status = "Upcoming"
      }
    } else {
      status = "Upcoming"
    }

    return { ...session, status }
  })
}

export default function AttendancePage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [date, setDate] = useState<Date>(new Date())
  const [users, setUsers] = useState<User[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [academies, setAcademies] = useState<any[]>([])
  const [selectedAcademy, setSelectedAcademy] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(0)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const ITEMS_PER_PAGE = 10

  const fetchSessionsData = async () => {
    if (!selectedAcademy) return
    try {
      const response = await fetch(`/api/db/ams-sessions?academyId=${encodeURIComponent(selectedAcademy)}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && Array.isArray(result.data)) {
          const updatedSessions = updateSessionStatus(result.data)
          setSessions(updatedSessions)
        } else {
          setSessions([])
        }
      }
    } catch (error) {
      console.error("Error fetching sessions:", error)
    }
  }

  const fetchUsersData = async () => {
    if (!selectedAcademy) return
    try {
      const response = await fetch(`/api/db/ams-player-data?academyId=${selectedAcademy}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && Array.isArray(result.data)) {
          const formattedPlayers: User[] = result.data
            .filter((player: any) => player.status === "active" || !player.status)
            .map((player: any) => ({
              id: player.id || player._id,
              name: player.name || player.username || "Unknown player",
              email: player.email,
              academyId: player.academyId,
              status: player.status || "active"
            }))
          setUsers(formattedPlayers)
        }
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const fetchAcademies = async () => {
    try {
      const response = await fetch('/api/db/ams-academy')
      if (response.ok) {
        const result = await response.json()
        if (result.success && Array.isArray(result.data)) {
          setAcademies(result.data)
          if (result.data.length > 0 && !selectedAcademy) {
            setSelectedAcademy(result.data[0].id || result.data[0]._id)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching academies:", error)
    }
  }

  const calculatePlayerAttendance = (sessions: Session[]): Record<string, PlayerAttendanceSummary> => {
    const finishedSessions = sessions.filter(s => s.status === "Finished")

    const summary: Record<string, PlayerAttendanceSummary> = {}

    for (const session of finishedSessions) {
      for (const playerId of session.assignedPlayers) {
        if (!summary[playerId]) {
          summary[playerId] = {
            playerId,
            totalSessions: 0,
            present: 0,
            absent: 0,
            unmarked: 0,
            presentDates: [],
            absentDates: [],
            unmarkedDates: []
          }
        }

        summary[playerId].totalSessions++

        const attendanceRecord = session.attendance?.[playerId]
        if (attendanceRecord?.status === "Present") {
          summary[playerId].present++
          summary[playerId].presentDates.push(session.date)
        } else if (attendanceRecord?.status === "Absent") {
          summary[playerId].absent++
          summary[playerId].absentDates.push(session.date)
        } else {
          // No attendance record means unmarked
          summary[playerId].unmarked++
          summary[playerId].unmarkedDates.push(session.date)
        }
      }
    }

    return summary
  }

  const exportAttendance = () => {
    const report = calculatePlayerAttendance(sessions)
    const exportData = users.map(u => {
      const stats = report[u.id] || {
        totalSessions: 0,
        present: 0,
        absent: 0,
        unmarked: 0
      }
      return {
        id: u.id,
        name: u.name,
        total: stats.totalSessions,
        present: stats.present,
        absent: stats.absent,
        unmarked: stats.unmarked,
        attendance: stats.totalSessions > 0 ? 
          `${Math.round((stats.present / stats.totalSessions) * 100)}%` : "0%"
      }
    })

    const csvContent = [
      ["Player ID", "Player Name", "Total Sessions", "Present", "Absent", "Unmarked", "Attendance %"].join(","),
      ...exportData.map(row => [
        row.id, 
        row.name, 
        row.total, 
        row.present, 
        row.absent, 
        row.unmarked, 
        row.attendance
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `attendance_report_${date.toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getFilteredUsers = () => {
    if (!Array.isArray(users)) return []
    if (!searchQuery.trim()) return users
    const query = searchQuery.toLowerCase().trim()
    return users.filter(
      u => (u.name || "").toLowerCase().includes(query) || (u.email || "").toLowerCase().includes(query)
    )
  }

  useEffect(() => {
    fetchAcademies()
  }, [])

  useEffect(() => {
    if (selectedAcademy) {
      fetchUsersData()
      fetchSessionsData()
    }
  }, [selectedAcademy])

  useEffect(() => {
    setCurrentPage(0)
  }, [searchQuery])

  const paginateUsers = () => {
    const filtered = getFilteredUsers()
    const startIndex = currentPage * ITEMS_PER_PAGE
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }

  const totalPages = Math.ceil(getFilteredUsers().length / ITEMS_PER_PAGE)

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(prev => prev + 1)
  }
  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(prev => prev - 1)
  }

  const report = calculatePlayerAttendance(sessions)

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Attendance Management</h2>
            <p className="text-muted-foreground">Monitor attendance for players</p>
            <Select onValueChange={setSelectedAcademy} value={selectedAcademy}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select Academy" />
              </SelectTrigger>
              <SelectContent>
                {academies.map(academy => (
                  <SelectItem key={academy.id || academy._id} value={academy.id || academy._id}>
                    {academy.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={exportAttendance} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar mode="single" selected={date} onSelect={newDate => newDate && setDate(newDate)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Attendance Statistics</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Unmarked</TableHead>
                  <TableHead>Attendance%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginateUsers().map(u => {
                  const stats = report[u.id] || {
                    totalSessions: 0,
                    present: 0,
                    absent: 0,
                    unmarked: 0
                  }
                  const percentage =
                    stats.totalSessions > 0 ? Math.round((stats.present / stats.totalSessions) * 100) : 0
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{stats.totalSessions}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {stats.present}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          {stats.absent}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          {stats.unmarked}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={percentage >= 75 ? "default" : "destructive"} 
                               className={percentage >= 75 ? "bg-green-600" : ""}>
                          {percentage}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <div className="flex justify-between items-center mt-4">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 0}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage + 1} of {totalPages} ({getFilteredUsers().length} players)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
