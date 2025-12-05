"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { useAuth } from "@/contexts/AuthContext"
import { CustomTooltip } from "@/components/custom-tooltip"
import {
  LayoutDashboard,
  School,
  Users,
  CalendarDays,
  ClipboardList,
  Info,
  Settings,
  Group,
  ChevronLeft,
  ChevronRight,
  Menu,
  User,
  Calendar,
  BarChart3,
  Trophy,
  Award,
  Target,
  Search,
  DollarSign,
  Download,
  LogOut
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const navItems = {
  player: [
    { name: "Profile", href: "/dashboard/player/profile", icon: User },
    { name: "My Sessions", href: "/dashboard/player/training", icon: Calendar },
    { name: "Performance", href: "/dashboard/player/performance", icon: BarChart3 },
    { name: "Schedule", href: "/dashboard/player/schedule", icon: CalendarDays },
    { name: "Match Day", href: "/dashboard/player/matchday", icon: Trophy },
    { name: "My Batch", href: "/dashboard/player/batch", icon: Group },
    { name: "Settings", href: "/dashboard/player/settings", icon: Settings },
    { name: "Logout", href: "/auth", icon: LogOut },
  ],
  coach: [
    { name: "Profile", href: "/dashboard/coach/profile", icon: User },
    { name: "Batches", href: "/dashboard/coach/batches", icon: Group },
    { name: "Credentials", href: "/dashboard/coach/credentials", icon: Award },
    { name: "Sessions", href: "/dashboard/coach/training-data", icon: Calendar },
    { name: "Batch Performance", href: "/dashboard/coach/batch-performance", icon: BarChart3 },
    { name: "Team Builder", href: "/dashboard/coach/team-builder", icon: Users },
    { name: "Match Day", href: "/dashboard/coach/match-day", icon: Trophy },
    { name: "Drills", href: "/dashboard/coach/drills", icon: Target },
    { name: "Settings", href: "/dashboard/coach/settings", icon: Settings },
    { name: "logout", href: "/auth", icon: LogOut },
  ],
  admin: [
    { name: "Dashboard", href: "/dashboard/admin/detail", icon: LayoutDashboard },
    { name: "About", href: "/dashboard/admin/about", icon: Info },
    { name: "Sessions", href: "/dashboard/admin/sessions", icon: Calendar },
    { name: "Match Day", href: "/dashboard/admin/match-day", icon: Trophy },
    { name: "Attendance", href: "/dashboard/admin/attendance", icon: ClipboardList },
    { name: "Performance Reports", href: "/dashboard/admin/performance-reports", icon: BarChart3 },
    { name: "Search", href: "/dashboard/admin/search", icon: Search },
    { name: "Batches", href: "/dashboard/admin/batches", icon: Group },
    { name: "Finances", href: "/dashboard/admin/finances", icon: DollarSign },
    { name: "Export Data", href: "/dashboard/admin/export-data", icon: Download },
    { name: "User Management", href: "/dashboard/admin/user-management", icon: Users },
    { name: "Settings", href: "/dashboard/admin/settings", icon: Settings },
    { name: "logout", href: "/auth", icon: LogOut },
  ],
  coordinator: [
    { name: "Dashboard", href: "/dashboard/coordinator", icon: LayoutDashboard },
    { name: "About", href: "/dashboard/coordinator/overview", icon: Info },
    { name: "Sessions", href: "/dashboard/coordinator/sessions", icon: Calendar },
    { name: "Match Day", href: "/dashboard/coordinator/match-day", icon: Trophy },
    { name: "Attendance", href: "/dashboard/coordinator/attendance", icon: ClipboardList },
    { name: "Performance Reports", href: "/dashboard/coordinator/performance-reports", icon: BarChart3 },
    { name: "Search", href: "/dashboard/coordinator/search", icon: Search },
    { name: "Batches", href: "/dashboard/coordinator/batches", icon: Group },
    { name: "Finances", href: "/dashboard/coordinator/finances", icon: DollarSign },
    { name: "Consult", href: "/dashboard/coordinator/consult", icon: Users },
    { name: "Export Data", href: "/dashboard/coordinator/export-data", icon: Download },
    { name: "User Management", href: "/dashboard/coordinator/user-management", icon: Users },
    { name: "logout", href: "/auth", icon: LogOut },
  ],
  OWNER: [
    { name: "Sessions", href: "/dashboard/Owner/sessions", icon: Calendar },
    { name: "Match Day", href: "/dashboard/Owner/match-day", icon: Trophy },
    { name: "Attendance", href: "/dashboard/Owner/attendance", icon: ClipboardList },
    { name: "Search", href: "/dashboard/Owner/search", icon: Search },
    { name: "Batches", href: "/dashboard/Owner/batches", icon: Group },
    { name: "academy management", href: "/dashboard/Owner/academy-management", icon: School },
    { name: "Consult", href: "/dashboard/Owner/consult", icon: Users },
    { name: "User Management", href: "/dashboard/Owner/user-management", icon: Users },
    { name: "logout", href: "/auth", icon: LogOut },
  ],
}

const ownerRoutes = [
  {
    label: "Academies",
    icon: School,
    href: "/dashboard/owner/academies",
    color: "text-violet-500",
  },
  {
    label: "User Management",
    icon: Users,
    href: "/dashboard/owner/user-management",
    color: "text-pink-700",
  },
  {
    label: "Sessions",
    icon: CalendarDays,
    href: "/dashboard/owner/sessions",
    color: "text-orange-700",
  },
  {
    label: "Batches",
    icon: Group,
    href: "/dashboard/owner/batches",
    color: "text-emerald-500",
  },
  {
    label: "Attendance",
    icon: ClipboardList,
    href: "/dashboard/owner/attendance",
    color: "text-green-700",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/dashboard/owner/settings",
  },
];

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

      <motion.aside
        initial={{ width: 256 }}
        animate={{
          width: isCollapsed ? 80 : 256,
          transition: { duration: 0.2 }
        }}
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isCollapsed ? 'p-2' : 'p-4'} fixed left-0 top-0 bottom-0 bg-background z-30 ${className || ''} ${
          isMobileOpen ? 'block' : 'hidden md:block'
        }`}
      >
        <Card className="h-full relative">
          {/* Collapse toggle button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-6 z-50 h-6 w-6 rounded-full bg-primary text-primary-foreground"
          >
            {isCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>

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
                {navItems[user.role as unknown as keyof typeof navItems]?.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <CustomTooltip
                      key={item.name}
                      content={isCollapsed ? item.name : `Go to ${item.name}`}
                    >
                      {item.name.toLowerCase() === 'logout' ? (
                        <a
                          href="#"
                          onClick={handleLogout}
                          className={`flex items-center rounded-md transition-all duration-200
                            ${pathname === item.href
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent"
                            }
                            ${isCollapsed
                              ? 'p-2 justify-center w-10 mx-auto'
                              : 'w-full p-2'
                            }
                          `}
                        >
                          {IconComponent && <IconComponent className={isCollapsed ? "h-5 w-5" : "h-4 w-4"} />}
                          {!isCollapsed && <span className="ml-2">Logout</span>}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileOpen(false)}
                          className={`flex items-center rounded-md transition-all duration-200
                            ${pathname === item.href
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent"
                            }
                            ${isCollapsed
                              ? 'p-2 justify-center w-10 mx-auto'
                              : 'w-full p-2'
                            }
                          `}
                        >
                          {IconComponent && <IconComponent className={isCollapsed ? "h-5 w-5" : "h-4 w-4"} />}
                          {!isCollapsed && <span className="ml-2">{item.name}</span>}
                        </Link>
                      )}
                    </CustomTooltip>
                  );
                })}
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
      <div className={`${isCollapsed ? 'md:ml-20' : 'md:ml-64'} transition-all duration-200`}>
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