"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import Sidebar from "@/components/Sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { motion, AnimatePresence } from "framer-motion"

export default function UserManagementPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([]) // Initialize as empty array
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRole, setSelectedRole] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    email: "",
    role: "player",
    password: ""
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    open: false,
    userId: "",
    userName: ""
  })
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/db/ams-users?academyId=${user?.academyId}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const result = await response.json();
      
      // Ensure we're setting an array of users
      if (result.success && Array.isArray(result.data)) {
        setUsers(result.data);
      } else {
        setUsers([]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
      setUsers([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Add user using /api/auth/signup, academyId is always user's academy
  const handleCreateUser = async (formData: any) => {
    try {
      setLoading(true);
      const newUserData: any = {
        username: formData.username || formData.email,
        password: formData.password || "changeme123",
        email: formData.email,
        name: formData.name,
        role: formData.role,
        academyId: user?.academyId,
        createdAt: new Date(),
        status: "active"
      };

      if (!newUserData.name || !newUserData.email || !newUserData.role || !newUserData.academyId || !newUserData.username) {
        toast({
          title: "Error",
          description: "Name, Username, Email, Role, and Academy are required",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchUsers();
        toast({
          title: "User added successfully",
          description: `${newUserData.name} has been added as ${newUserData.role}`,
        });
        setIsDialogOpen(false);
        setNewUser({
          name: "",
          username: "",
          email: "",
          role: "player",
          password: ""
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to add user",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add user",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete user with password verification
  const handleDeleteUser = async (userId: string, userName: string) => {
    setDeleteConfirmDialog({
      open: true,
      userId: userId,
      userName: userName
    });
    setDeletePassword("");
  };

  const confirmDeleteUser = async () => {
    if (!deletePassword) {
      toast({
        title: "Error",
        description: "Password is required to delete user",
        variant: "destructive"
      });
      return;
    }

    try {
      setDeleteLoading(true);
      
      // First verify the current user's password
      const authResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          username: user?.username, 
          password: deletePassword 
        }),
      });

      const authData = await authResponse.json();

      if (!authData.success) {
        toast({
          title: "Error",
          description: "Invalid password",
          variant: "destructive"
        });
        return;
      }

      // If password is valid, proceed with deletion
      const deleteResponse = await fetch(`/api/db/ams-users/${deleteConfirmDialog.userId}`, {
        method: 'DELETE'
      });
      
      const deleteData = await deleteResponse.json();
      
      if (deleteData.success) {
        await fetchUsers();
        toast({
          title: "User deleted",
          description: "User has been deleted successfully",
          variant: "destructive"
        });
        setDeleteConfirmDialog({ open: false, userId: "", userName: "" });
        setDeletePassword("");
      } else {
        toast({
          title: "Error",
          description: deleteData.error || "Failed to delete user",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStatusToggle = async (userId: string) => {
    try {
      const userToUpdate = users.find(u => u.id === userId);
      if (!userToUpdate) return;

      const newStatus = userToUpdate.status === 'active' ? 'inactive' : 'active';

      // Only update ams-player-info for players
      if (userToUpdate.role === 'player') {
        // Ensure required fields exist before calling player endpoint
        if (!userToUpdate.username || !userToUpdate.academyId) {
          throw new Error('Missing username or academyId for player update');
        }

        const resPlayer = await fetch('/api/db/ams-player-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: userToUpdate.username,
            academyId: userToUpdate.academyId,
            status: newStatus
          })
        });

        const dataPlayer = await resPlayer.json();
        if (!resPlayer.ok || !dataPlayer.success) {
          throw new Error(dataPlayer.error || 'Failed to update player status');
        }
      }

      // Always update ams-users status
      const resUser = await fetch(`/api/db/ams-users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const dataUser = await resUser.json();
      if (!resUser.ok || !dataUser.success) {
        throw new Error(dataUser.error || 'Failed to update user status');
      }

      // Update local state immediately
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === userId ? { ...u, status: newStatus } : u
        )
      );

      // Toast message differs for players vs non-players
      if (userToUpdate.role === 'player') {
        toast({
          title: "Status Updated",
          description: `Player status changed to ${newStatus} in ams-player-data and ams-users`,
        });
      } else {
        toast({
          title: "Status Updated",
          description: `User status changed to ${newStatus} in ams-users`,
        });
      }

    } catch (error) {
      toast({
        title: "Error",
        description: (error as any)?.message || "Failed to update player/user status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user?.academyId) {
      fetchUsers();
    }
  }, [user?.academyId]);

  const filteredUsers = Array.isArray(users) ? users.filter(user => {
    if (!user) return false;
    
    const matchesSearch = (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === "all" || user.role === selectedRole;
    const matchesStatus = selectedStatus === "all" || user.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  }) : [];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto p-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-4">
              <h1 className="text-2xl sm:text-3xl font-bold">User Management</h1>
              <div className="text-sm text-muted-foreground">
                Academy ID: {user?.academyId}
              </div>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">Add New User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input
                    placeholder="Name"
                    value={newUser.name}
                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  />
                  <Input
                    placeholder="Username"
                    value={newUser.username}
                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  />
                  <Select
                    value={newUser.role}
                    onValueChange={value => setNewUser({ ...newUser, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="player">player</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                      <SelectItem value="coordinator">Coordinator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => handleCreateUser(newUser)}>Add User</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Users ({filteredUsers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4 mb-4">
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full sm:max-w-sm"
                  />
                  <Select
                    value={selectedRole}
                    onValueChange={setSelectedRole}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="player">player</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                      <SelectItem value="coordinator">Coordinator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedStatus === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedStatus("all")}
                    className="transition-all duration-200 flex-1 sm:flex-none"
                  >
                    All Users ({users.length})
                  </Button>
                  <Button
                    variant={selectedStatus === "active" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedStatus("active")}
                    className="transition-all duration-200 flex-1 sm:flex-none"
                  >
                    Active ({users.filter(u => u?.status === "active").length})
                  </Button>
                  <Button
                    variant={selectedStatus === "inactive" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedStatus("inactive")}
                    className="transition-all duration-200 flex-1 sm:flex-none"
                  >
                    Inactive ({users.filter(u => u?.status === "inactive").length})
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Name</TableHead>
                      <TableHead className="min-w-[200px]">Email</TableHead>
                      <TableHead className="min-w-[100px]">Role</TableHead>
                      <TableHead className="min-w-[120px]">Academy ID</TableHead>
                      <TableHead className="min-w-[80px]">Status</TableHead>
                      <TableHead className="min-w-[150px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          Loading users...
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map(user => (
                        <TableRow key={user.id}>
                          <TableCell className="break-words whitespace-normal">{user.name}</TableCell>
                          <TableCell className="break-words whitespace-normal">{user.email}</TableCell>
                          <TableCell className="capitalize break-words whitespace-normal">{user.role}</TableCell>
                          <TableCell className="break-words whitespace-normal">{user.academyId}</TableCell>
                          <TableCell>
                            <Badge variant={user.status === "active" ? "default" : "secondary"}>
                              {user.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:space-x-2">
                              {user.role !== 'admin' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStatusToggle(user.id)}
                                  className="w-full sm:w-auto"
                                >
                                  {user.status === 'active' ? 'Deactivate' : 'Activate'}
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                className="w-full sm:w-auto"
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Password Confirmation Dialog for User Deletion */}
          <AnimatePresence>
            {deleteConfirmDialog.open && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setDeleteConfirmDialog({ open: false, userId: "", userName: "" })}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative bg-white dark:bg-[#2a2f3d] p-6 rounded-lg shadow-xl w-[90%] max-w-md z-10"
                >
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Confirm User Deletion
                  </h3>
                  <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                      Are you sure you want to delete <strong>{deleteConfirmDialog.userName}</strong>?
                    </p>
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      This action cannot be undone.
                    </p>
                    <div>
                      <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Enter your password to confirm
                      </label>
                      <Input
                        type="password"
                        id="deletePassword"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDeleteConfirmDialog({ open: false, userId: "", userName: "" });
                        setDeletePassword("");
                      }}
                      disabled={deleteLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={confirmDeleteUser}
                      disabled={deleteLoading || !deletePassword}
                    >
                      {deleteLoading ? 'Deleting...' : 'Delete User'}
                    </Button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}