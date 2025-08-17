"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { usePlayers } from "@/contexts/PlayerContext"
export type UserRole = "player" | "coach" | "admin" | "coordinator";
import { CustomTooltip } from "@/components/custom-tooltip"

export default function SignUpPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("player")
  const [error, setError] = useState("")
  const [academyId, setAcademyId] = useState("")
  const router = useRouter()
  const { register, login } = useAuth()
  const { players } = usePlayers()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")

    try {
      if (!academyId) {
        setError("Academy ID is required")
        return
      }

      const userData = {
        username,
        password,
        email,
        name,
        role,
        academyId,
        createdAt: new Date(),
        status: role === 'admin' ? 'active' : 'inactive' // always active for admin
      }

      let response;
      try {
        response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(userData),
        });
      } catch (networkError) {
        throw new Error("Network error. Please check your connection.");
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error("Invalid response from server. Please try again.");
      }

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Signup failed');
      }

      if (role !== 'admin') {
        router.push("/auth/admin_permission");
      }

      // After successful signup, redirect based on role
      switch (role) {
        case "player":
          router.push("/auth/admin_permission")
          break
        case "coach":
          router.push("/auth/admin_permission")
          break
        case "coach":
          router.push("/auth/admin_permission")
          break
        case "admin":
          router.push("/dashboard/admin/about")
          break
        case "coordinator":
          router.push("/auth/admin_permission")
          break
        default:
          router.push("/auth/admin_permission")
      }
      
    } catch (error) {
      console.error('Signup error:', error)
      setError(error instanceof Error ? error.message : 'Failed to create account')
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1f2b] flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Sign Up</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <CustomTooltip content="Enter your desired username">
              <label htmlFor="username" className="block text-sm font-medium text-white mb-2">
                Username
              </label>
            </CustomTooltip>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#2a2f3d] border border-[#3a3f4d] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <CustomTooltip content="Enter your password">
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
            </CustomTooltip>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#2a2f3d] border border-[#3a3f4d] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your password"
            />
          </div>

          <div>
            <CustomTooltip content="Enter your full name">
              <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                Name
              </label>
            </CustomTooltip>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#2a2f3d] border border-[#3a3f4d] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <CustomTooltip content="Enter your email address">
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email
              </label>
            </CustomTooltip>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#2a2f3d] border border-[#3a3f4d] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <CustomTooltip content="Select your role">
              <label htmlFor="role" className="block text-sm font-medium text-white mb-2">
                Role
              </label>
            </CustomTooltip>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              required
              className="w-full px-3 py-2 bg-[#2a2f3d] border border-[#3a3f4d] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="player">player</option>
              <option value="coach">Coach</option>
              <option value="admin">Admin</option>
              <option value="coordinator">Coordinator</option>
            </select>
          </div>

          <div>
            <CustomTooltip content="Enter your Academy ID">
              <label htmlFor="academyId" className="block text-sm font-medium text-white mb-2">
                Academy ID
              </label>
            </CustomTooltip>
            <input
              type="text"
              id="academyId"
              value={academyId}
              onChange={(e) => setAcademyId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#2a2f3d] border border-[#3a3f4d] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your Academy ID"
            />
          </div>

          <CustomTooltip content="Click to create your account">
            <button
              type="submit"
              className="w-full bg-white text-black py-2 px-4 rounded-md hover:bg-gray-100 transition-colors duration-200"
            >
              Sign Up
            </button>
          </CustomTooltip>
        </form>

        <div className="mt-6 text-center">
          <CustomTooltip content="Already have an account? Log in">
            <Link href="/auth" className="text-indigo-400 hover:text-indigo-300 text-sm">
              Already have an account? Login
            </Link>
          </CustomTooltip>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-red-900/80 text-white rounded-md"
          >
            <p>Sign up failed</p>
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

