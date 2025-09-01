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
import { UserRole } from "@/types/user"

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  createdAt: string;
  academyId: string;
}

export default function UserManagement() {
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

      let allUsers: any[] = [];

      // For owners, fetch all academies first, then fetch users from all academies
      if (user?.role === UserRole.OWNER && !user?.academyId) {
        // First fetch all academies
        const academiesResponse = await fetch('/api/db/ams-academy');
        if (!academiesResponse.ok) throw new Error('Failed to fetch academies');

        const academiesResult = await academiesResponse.json();

        if (academiesResult.success && Array.isArray(academiesResult.data)) {
          const academyIds = academiesResult.data.map((academy: any) => academy.id);

          // Fetch users from all academies
          const userPromises = academyIds.map((academyId: string) =>
            fetch(`/api/db/ams-users?academyId=${academyId}`)
              .then(res => res.json())
              .then(result => result.success && Array.isArray(result.data) ? result.data : [])
              .catch(error => {
                console.error(`Error fetching users for academy ${academyId}:`, error);
                return [];
              })
          );

          const userResults = await Promise.all(userPromises);
          allUsers = userResults.flat();
        }
      } else {
        // For other users, fetch users filtered by their academyId
        const response = await fetch(`/api/db/ams-users?academyId=${user?.academyId}`);
        if (!response.ok) throw new Error('Failed to fetch users');

        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
          allUsers = result.data;
        }
      }

      setUsers(allUsers);
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

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

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
    const userToUpdate = users.find(u => u.id === userId);
    if (!userToUpdate) return;

    // Prevent status toggle for admin users
    if (userToUpdate.role === "admin") {
      toast({
        title: "Error",
        description: "Cannot change status of admin users",
        variant: "destructive"
      });
      return;
    }

    const newStatus = userToUpdate.status === "active" ? "inactive" : "active";

    try {
      setLoading(true);

      // Update ams-users
      const userResponse = await fetch(`/api/db/ams-users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const userData = await userResponse.json();

      if (!userData.success) {
        toast({
          title: "Error",
          description: userData.error || "Failed to update user status",
          variant: "destructive"
        });
        return;
      }

      // If user is a player, also update ams-player-info
      if (userToUpdate.role === "player") {
        const playerResponse = await fetch(`/api/db/ams-player-info/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });

        const playerData = await playerResponse.json();

        if (!playerData.success) {
          toast({
            title: "Warning",
            description: "User status updated but player info may not be synced",
            variant: "destructive"
          });
        }
      }

      // Update local state
      setUsers(prev =>
        prev.map(u =>
          (u.id === userId)
            ? { ...u, status: newStatus }
            : u
        )
      );

      toast({
        title: "User status updated",
        description: `User status has been updated successfully`,
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === "all" || user.role === selectedRole
    const matchesStatus = selectedStatus === "all" || user.status === selectedStatus
    return matchesSearch && matchesRole && matchesStatus
  })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto p-8">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">User Management</h1>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>Add New User</Button>
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
                      <SelectItem value="player">Player</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                      <SelectItem value="coordinator">Coordinator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => handleCreateUser(newUser)} disabled={loading}>
                    {loading ? "Adding..." : "Add User"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4 mb-4">
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                <Select
                  value={selectedRole}
                  onValueChange={setSelectedRole}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="coordinator">Coordinator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedStatus}
                  onValueChange={setSelectedStatus}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5}>Loading...</TableCell>
                      </TableRow>
                    ) : filteredUsers.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="capitalize">{user.role}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === "active" ? "default" : "secondary"}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusToggle(user.id)}
                            >
                              Toggle Status
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id, user.name)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmDialog.open} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmDialog({ open: false, userId: "", userName: "" });
          setDeletePassword("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>Are you sure you want to delete user "{deleteConfirmDialog.userName}"?</p>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <Input
              type="password"
              placeholder="Enter your password to confirm"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
            />
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirmDialog({ open: false, userId: "", userName: "" });
                  setDeletePassword("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteUser}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

