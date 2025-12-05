"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { useAuth } from "@/contexts/AuthContext"
import { CustomTooltip } from "@/components/custom-tooltip"
import { Menu } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const navItems = {
  player: [
    { name: "Profile", href: "/dashboard/player/profile" },
    { name: "My Sessions", href: "/dashboard/player/training" },
    { name: "Performance", href: "/dashboard/player/performance" },
    { name: "Schedule", href: "/dashboard/player/schedule" },
    { name: "Match Day", href: "/dashboard/player/matchday" },
    { name: "My Batch", href: "/dashboard/player/batch" },
    { name: "Settings", href: "/dashboard/player/settings" },
    { name: "Logout", href: "/auth" },
  ],
  coach: [
    { name: "Profile", href: "/dashboard/coach/profile" },
    { name: "Batches", href: "/dashboard/coach/batches" },
    { name: "Credentials", href: "/dashboard/coach/credentials" },
    { name: "Sessions", href: "/dashboard/coach/training-data" },
    { name: "Batch Performance", href: "/dashboard/coach/batch-performance" },
    { name: "Team Builder", href: "/dashboard/coach/team-builder" },
    { name: "Match Day", href: "/dashboard/coach/match-day" },
    { name: "Drills", href: "/dashboard/coach/drills" },
    { name: "Settings", href: "/dashboard/coach/settings" },
    { name: "logout", href: "/auth" },
  ],
  admin: [
    { name: "Dashboard", href: "/dashboard/admin/detail" },
    { name: "About", href: "/dashboard/admin/about" },
    { name: "Sessions", href: "/dashboard/admin/sessions" },
    { name: "Match Day", href: "/dashboard/admin/match-day" },
    { name: "Attendance", href: "/dashboard/admin/attendance" },
    { name: "Performance Reports", href: "/dashboard/admin/performance-reports" },
    { name: "Search", href: "/dashboard/admin/search" },
    { name: "Batches", href: "/dashboard/admin/batches" },
    { name: "Finances", href: "/dashboard/admin/finances" },
    { name: "Export Data", href: "/dashboard/admin/export-data" },
    { name: "User Management", href: "/dashboard/admin/user-management" },
    { name: "Settings", href: "/dashboard/admin/settings" },
    { name: "logout", href: "/auth" },
  ],
  coordinator: [
    { name: "Dashboard", href: "/dashboard/coordinator" },
    { name: "About", href: "/dashboard/coordinator/overview" },
    { name: "Sessions", href: "/dashboard/coordinator/sessions" },
    { name: "Match Day", href: "/dashboard/coordinator/match-day" },
    { name: "Attendance", href: "/dashboard/coordinator/attendance" },
    { name: "Performance Reports", href: "/dashboard/coordinator/performance-reports" },
    { name: "Search", href: "/dashboard/coordinator/search" },
    { name: "Batches", href: "/dashboard/coordinator/batches" },
    { name: "Finances", href: "/dashboard/coordinator/finances" },
    { name: "Consult", href: "/dashboard/coordinator/consult" },
    { name: "Export Data", href: "/dashboard/coordinator/export-data" },
    { name: "User Management", href: "/dashboard/coordinator/user-management" },
    { name: "logout", href: "/auth" },
  ],
  OWNER: [
    { name: "Sessions", href: "/dashboard/Owner/sessions" },
    { name: "Match Day", href: "/dashboard/Owner/match-day" },
    { name: "Attendance", href: "/dashboard/Owner/attendance" },
    { name: "Search", href: "/dashboard/Owner/search" },
    { name: "Batches", href: "/dashboard/Owner/batches" },
    { name: "academy management", href: "/dashboard/Owner/academy-management" },
    { name: "Consult", href: "/dashboard/Owner/consult" },
    { name: "User Management", href: "/dashboard/Owner/user-management" },
    { name: "logout", href: "/auth" },
  ],
}



export const Sidebar = ({ className }: { className?: string }) => {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  if (!user) return null

  const handleLogout = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    await logout();
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-20 md:hidden"
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Desktop collapse toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="fixed top-4 left-4 z-20 hidden md:flex"
      >
        <Menu className="h-6 w-6" />
      </Button>

      <motion.aside
        initial={{ width: 256 }}
        animate={{
          width: isCollapsed ? 0 : 256,
          transition: { duration: 0.2 }
        }}
        className={`fixed left-0 top-0 bottom-0 bg-background z-30 ${className || ''} ${
          isMobileOpen ? 'block' : 'hidden md:block'
        }`}
      >
        <Card className="h-full relative">

          <CardHeader className="p-4">
            <CardTitle className={`transition-all duration-200 ${
              isCollapsed ? 'text-center text-sm' : 'text-xl'
            }`}>
              {isCollapsed ? 'AMS' : 'AMS Dashboard'}
            </CardTitle>
          </CardHeader>
          
          <ScrollArea className="flex-1 h-[calc(100vh-8rem)] px-2">
            <CardContent className="p-2">
              {/* Remove Quick Access section and keep only navigation items */}
              <div className="space-y-1">
                {!isCollapsed && (
                  <h2 className="text-lg font-semibold mb-2"></h2>
                )}
                {navItems[user.role as unknown as keyof typeof navItems]?.map((item) => (
                  <CustomTooltip 
                    key={item.name} 
                    content={isCollapsed ? item.name : `Go to ${item.name}`}
                  >
                    {item.name.toLowerCase() === 'logout' ? (
                      <a
                        href="#"
                        onClick={handleLogout}
                        className={`block rounded-md transition-all duration-200
                          ${pathname === item.href 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-accent"
                          }
                          ${isCollapsed 
                            ? 'p-2 text-center w-10 mx-auto' 
                            : 'w-full p-2'
                          }
                        `}
                      >
                        {isCollapsed ? 'L' : 'Logout'}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={`block rounded-md transition-all duration-200
                          ${pathname === item.href 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-accent"
                          }
                          ${isCollapsed 
                            ? 'p-2 text-center w-10 mx-auto' 
                            : 'w-full p-2'
                          }
                        `}
                      >
                        {isCollapsed ? item.name.charAt(0) : item.name}
                      </Link>
                    )}
                  </CustomTooltip>
                ))}
              </div>
            </CardContent>
          </ScrollArea>

          <div className={`p-4 border-t transition-all duration-200 ${
            isCollapsed ? 'text-center' : ''
          }`}>
            <div className="text-sm text-muted-foreground truncate">
              {isCollapsed ? user.name?.charAt(0) : `Logged in as: ${user.name}`}
            </div>
          </div>
        </Card>
      </motion.aside>

      {/* Add wrapper div for main content with margin */}
      <div className={`${isCollapsed ? 'md:ml-0' : 'md:ml-64'} transition-all duration-200`}>
        {/* Main content goes here */}
      </div>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  )
}

// Keep the default export
export default Sidebar