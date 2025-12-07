"use client"

import { useState } from "react"
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { CustomTooltip } from "@/components/custom-tooltip"
import { useRouter } from "next/navigation"

export default function AuthPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isBlocked, setIsBlocked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const { login, isLoading: authLoading } = useAuth()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setIsBlocked(false)
    setShowDialog(false)
    setIsLoading(true)

    try {
      // Try logging in with owner credentials first
      if (username === 'ownerams' && password === 'pass5key') {
        await login(username, password);
        return;
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      // Check for inactive status using the new error field
      if (data.error === 'inactive') {
        setIsBlocked(true);
        setError(data.message || 'Your account is currently inactive');
        setShowDialog(true);
        return;
      }

      // Then check for invalid credentials
      if (!data.success) {
        throw new Error(data.message || 'Invalid username or password');
      }

      // If all checks pass, proceed with login
      await login(username, password);
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during login');
    } finally {
      setIsLoading(false);
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
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <CustomTooltip content="Enter your username">
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
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pr-10 px-3 py-2 bg-[#2a2f3d] border border-[#3a3f4d] rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
              >
                {showPassword ? (
                  // eye-off icon
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7 1.11-2.27 2.84-4.08 4.83-5.16M6.1 6.1A9.966 9.966 0 0112 5c5 0 9.27 3.11 11 7-1.01 2.05-2.68 3.78-4.66 4.86M3 3l18 18" />
                  </svg>
                ) : (
                  // eye icon
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.01 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <CustomTooltip content="Click to log in">
            <button
              type="submit"
              disabled={isLoading || authLoading}
              className="w-full bg-white text-black py-2 px-4 rounded-md hover:bg-gray-100 transition-colors duration-200"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </CustomTooltip>
        </form>

        <div className="mt-6 text-center">
          <CustomTooltip content="Create a new account">
            <Link href="/auth/signup" className="text-indigo-400 hover:text-indigo-300 text-sm">
              Need an account? Sign Up
            </Link>
          </CustomTooltip>
        </div>
      </motion.div>

      <AnimatePresence>
        {showDialog && (
          <Dialog.Root open={showDialog} onOpenChange={setShowDialog}>
            <Dialog.Portal>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Dialog.Overlay
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Dialog.Content
                  className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#2a2f3d] p-6 rounded-lg shadow-xl w-[90%] max-w-md"
                >
                  <Dialog.Title className="text-xl font-semibold text-white mb-4">
                    Account Inactive
                  </Dialog.Title>
                  <div className="space-y-4">
                    <p className="text-white">Your account is currently inactive.</p>
                    <p className="text-yellow-200">Please wait for administrator approval to access the system.</p>
                    <p className="text-gray-300 text-sm">Contact the administrator for account activation.</p>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className="mt-6 w-full bg-white text-black py-2 px-4 rounded-md hover:bg-gray-100 transition-colors duration-200"
                    >
                      Close
                    </button>
                  </Dialog.Close>
                </Dialog.Content>
              </motion.div>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </AnimatePresence>

      {/* Show regular error messages for non-blocked cases */}
      {error && !isBlocked && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-red-900/80 text-white rounded-md"
        >
          <p className="font-medium">Login Failed</p>
          <p className="text-sm">{error}</p>
        </motion.div>
      )}
    </div>
  )
}