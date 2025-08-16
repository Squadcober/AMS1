"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, CalendarIcon, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import Sidebar from "@/components/Sidebar"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"

interface User {
  id: string
  name: string
  email: string
  academyId: string
  status: string
}

interface AttendanceRecord {
  id?: string
  userId: string
  date: string
  status: "present" | "absent" | "late"
  markedBy: string
  academyId: string
  type: "players" | "coaches"
  markedAt?: string
}

export default function AttendancePage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [date, setDate] = useState<Date>(new Date())
  const [userType, setUserType] = useState<"players" | "coaches">("players")
  const [users, setUsers] = useState<any[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [visibleCount, setVisibleCount] = useState(20)
  const [currentPage, setCurrentPage] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const ITEMS_PER_PAGE = 10;

  const fetchAttendanceData = async () => {
    if (!user?.academyId) return;
    
    const yearStart = new Date(date.getFullYear(), 0, 1).toISOString().split('T')[0];
    const yearEnd = new Date(date.getFullYear(), 11, 31).toISOString().split('T')[0];
    const response = await fetch(
      `/api/db/ams-attendance?academyId=${user.academyId}&startDate=${yearStart}&endDate=${yearEnd}&type=${userType}`
    );
    
    if (response.ok) {
      const data = await response.json();
      setAttendance(Array.isArray(data) ? data : []);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.academyId) return;

        let response;
        if (userType === "players") {
          response = await fetch(`/api/db/ams-player-data?academyId=${user.academyId}`);
          if (!response.ok) throw new Error('Failed to fetch players');
          const result = await response.json();
          
          if (result.success && Array.isArray(result.data)) {
            const formattedplayers = result.data
              .filter((player: any) => {
                // Log the player data to debug
                console.log('player data:', player);
                return player.status === 'active' || !player.status;
              })
              .map((player: any) => ({
                id: player.id || player._id,
                name: player.name || player.username || 'Unknown player',
                email: player.email,
                academyId: player.academyId,
                status: player.status || 'active' // Default to active if status is not set
              }));
            console.log('Formatted players:', formattedplayers);
            setUsers(formattedplayers);
          } else {
            console.error('Invalid player data format:', result);
            setUsers([]);
          }
        } else {
          // Handle coaches fetch
          response = await fetch(`/api/db/ams-users?academyId=${user.academyId}&role=coach`);
          if (!response.ok) throw new Error('Failed to fetch coaches');
          const coachData = await response.json();
          
          const activeCoaches = Array.isArray(coachData) 
            ? coachData
                .filter(coach => {
                  // Log the coach data to debug
                  console.log('Coach data:', coach);
                  return coach.status === 'active' || !coach.status;
                })
                .map(coach => ({
                  id: coach.id || coach._id,
                  name: coach.name || coach.username || 'Unknown Coach',
                  email: coach.email,
                  academyId: coach.academyId,
                  status: coach.status || 'active'
                }))
            : [];
          console.log('Formatted coaches:', activeCoaches);
          setUsers(activeCoaches);
        }

        await fetchAttendanceData();
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to fetch data",
          variant: "destructive",
        });
      }
    };

    fetchData();
  }, [user?.academyId, userType, date]);

  const getAttendanceStats = (userId: string) => {
    const selectedYear = date.getFullYear();
    const startOfYear = new Date(selectedYear, 0, 1);
    const currentDate = new Date();
    
    const endDate = selectedYear === currentDate.getFullYear() ? currentDate : new Date(selectedYear, 11, 31);
    const totalDaysPassed = Math.floor(
      (endDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Get all attendance records for the user in this year
    const userRecords = attendance.filter(record => 
      record.userId === userId && 
      new Date(record.date).getFullYear() === selectedYear
    );

    // Count present (including late) and late days
    const presentDays = userRecords.filter(record => 
      record.status === "present" || record.status === "late"
    ).length;
    
    const lateDays = userRecords.filter(record => record.status === "late").length;

    // Calculate percentages with 2 decimal places
    const attendancePercentage = Number(((presentDays / totalDaysPassed) * 100).toFixed(2));
    const latePercentage = Number(((lateDays / totalDaysPassed) * 100).toFixed(2));

    return {
      total: totalDaysPassed,
      present: presentDays,
      late: lateDays,
      percentage: attendancePercentage,
      latePercentage
    };
  };

  const handleMarkAttendance = async (userId: string, status: "present" | "absent" | "late") => {
    try {
      if (!user?.academyId) throw new Error("Academy ID not found");
      
      const dateStr = date.toISOString().split("T")[0];
      
      const attendanceData = {
        academyId: user.academyId,
        userId,
        date: dateStr,
        status,
        type: userType,
        markedBy: user.id,
        markedAt: new Date().toISOString()
      };

      const response = await fetch("/api/db/ams-attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attendanceData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(errorText || "Failed to mark attendance");
      }

      // After successful attendance marking, refresh the attendance data
      await fetchAttendanceData();

      toast({
        title: "Success",
        description: `Attendance marked as ${status}`,
      });

    } catch (error) {
      console.error("Error marking attendance:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark attendance",
        variant: "destructive",
      });
    }
  };

  const getUserAttendanceStatus = (userId: string) => {
    const dateStr = date.toISOString().split("T")[0];
    const record = attendance.find(r => 
      r.userId === userId && 
      r.date === dateStr && 
      r.type === userType
    );
    
    // If a record exists for this date, return its status
    if (record) {
      return record.status;
    }

    // If no record exists, check if there's a record marking them present
    const presentRecord = attendance.find(r =>
      r.userId === userId &&
      r.date === dateStr &&
      r.status === "present"
    );

    return presentRecord ? "present" : "Not marked";
  };

  const exportAttendance = () => {
    // Get attendance stats for all users
    const exportData = users
      .filter(user => user.academyId === user?.academyId)
      .map(user => {
        const stats = getAttendanceStats(user.id);
        return {
          id: user.id,
          name: user.name,
          attendance: `${stats.present}/${stats.total}`
        };
      });

    // Create CSV content
    const csvContent = [
      ['player ID', 'player Name', 'Attendance (Present/Total)'].join(','),
      ...exportData.map(row => [
        row.id,
        row.name,
        row.attendance
      ].join(','))
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_report_${date.toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getFilteredUsers = () => {
    if (!Array.isArray(users)) return [];
    if (!searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase().trim();
    return users.filter(user => 
      (user.name || '').toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query)
    );
  };

  // Update useEffect dependencies to include searchQuery
  useEffect(() => {
    // Reset to first page when searching
    setCurrentPage(0);
  }, [searchQuery]);

  const paginateUsers = (users: any[]) => {
    const filteredUsers = getFilteredUsers();
    const startIndex = currentPage * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  const totalPages = Math.ceil(getFilteredUsers().length / ITEMS_PER_PAGE);

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Attendance Management</h2>
            <p className="text-muted-foreground">
              Mark and monitor attendance for players and coaches
            </p>
          </div>
          <Button onClick={exportAttendance} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex space-x-4">
            <Select value={userType} onValueChange={(v) => setUserType(v as "players" | "coaches")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="players">players</SelectItem>
                <SelectItem value="coaches">Coaches</SelectItem>
              </SelectContent>
            </Select>

            <div className={`relative transition-all duration-300 ease-in-out ${
              isSearchFocused ? 'w-[600px]' : 'w-[240px]'
            }`}>
              <div className="relative w-full">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${userType}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="pl-8 w-full transition-all duration-300"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Sheet</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginateUsers(users).map((user) => {
                      const currentStatus = getUserAttendanceStatus(user.id)
                      return (
                        <TableRow key={user.id}>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                currentStatus === "present"
                                  ? "success"
                                  : currentStatus === "late"
                                  ? "outline"
                                  : currentStatus === "absent"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {currentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant={currentStatus === "present" ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleMarkAttendance(user.id, "present")}
                              >
                                Present
                              </Button>
                              <Button
                                variant={currentStatus === "late" ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleMarkAttendance(user.id, "late")}
                              >
                                Late
                              </Button>
                              <Button
                                variant={currentStatus === "absent" ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleMarkAttendance(user.id, "absent")}
                              >
                                Absent
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                <div className="flex justify-between items-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage + 1} of {totalPages}
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

            <Card>
              <CardHeader>
                <CardTitle>Attendance Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Total Days</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Late Days</TableHead>
                      <TableHead>Overall %</TableHead>
                      <TableHead>Late %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginateUsers(users).map((user) => {
                      const stats = getAttendanceStats(user.id)
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{stats.total}</TableCell>
                          <TableCell>{stats.present}</TableCell>
                          <TableCell>{stats.late}</TableCell>
                          <TableCell>
                            <Badge variant={stats.percentage >= 75 ? "success" : "destructive"}>
                              {stats.percentage}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={stats.latePercentage <= 25 ? "success" : "destructive"}>
                              {stats.latePercentage}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                <div className="flex justify-between items-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage + 1} of {totalPages}
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
      </div>
    </div>
  )
}



