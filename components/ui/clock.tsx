"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ClockProps {
  value: string // HH:MM format
  onChange: (time: string) => void
  onCancel: () => void
  className?: string
}

const Clock: React.FC<ClockProps> = ({ value, onChange, onCancel, className }) => {
  const [isDragging, setIsDragging] = useState<"hour" | "minute" | null>(null)
  const [isAm, setIsAm] = useState(true)
  const clockRef = useRef<HTMLDivElement>(null)

  // Parse initial time
  const [hours, minutes] = value ? value.split(':').map(Number) : [12, 0]
  const initialHours12 = hours % 12 || 12
  const initialIsAm = hours < 12

  const [selectedHours, setSelectedHours] = useState(initialHours12)
  const [selectedMinutes, setSelectedMinutes] = useState(minutes)
  const [internalIsAm, setInternalIsAm] = useState(initialIsAm)

  // Convert to 24-hour format for output
  const outputHours = internalIsAm ? selectedHours : selectedHours + 12
  const formattedTime = `${outputHours.toString().padStart(2, '0')}:${selectedMinutes.toString().padStart(2, '0')}`

  const handleClockClick = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!clockRef.current) return

    const rect = clockRef.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
    
    const x = clientX - rect.left - centerX
    const y = clientY - rect.top - centerY
    
    const distance = Math.sqrt(x * x + y * y)
    const radius = centerX - 20 // Account for padding
    
    if (distance > radius) return // Click outside clock face
    
    const angle = Math.atan2(y, x) * (180 / Math.PI) + 90
    const normalizedAngle = angle < 0 ? angle + 360 : angle
    
    if (isDragging === "hour" || distance < radius * 0.6) {
      // Hour hand (inner circle)
      const hour = Math.floor(normalizedAngle / 30) % 12
      setSelectedHours(hour === 0 ? 12 : hour)
      setIsDragging("hour")
    } else {
      // Minute hand (outer circle)
      const minute = Math.floor(normalizedAngle / 6) % 60
      setSelectedMinutes(minute)
      setIsDragging("minute")
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(null)
  }, [])

  // Add event listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchend', handleMouseUp)
      return () => {
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchend', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseUp])

  const handleConfirm = () => {
    onChange(formattedTime)
  }

  const toggleAmPm = () => {
    setInternalIsAm(!internalIsAm)
  }

  // Calculate hand angles
  const hourAngle = (selectedHours % 12) * 30 + (selectedMinutes / 60) * 30
  const minuteAngle = selectedMinutes * 6

  return (
    <div className={cn("flex flex-col items-center space-y-4 p-4", className)}>
      {/* Time Display */}
      <div className="text-2xl font-bold text-center mb-4">
        {selectedHours.toString().padStart(2, '0')}:{selectedMinutes.toString().padStart(2, '0')}
        <span className="ml-2 text-sm font-normal text-gray-400 cursor-pointer" onClick={toggleAmPm}>
          {internalIsAm ? 'AM' : 'PM'}
        </span>
      </div>

      {/* Clock Face */}
      <div
        ref={clockRef}
        className="relative w-64 h-64 rounded-full border-2 border-gray-300 bg-black cursor-pointer"
        onMouseDown={handleClockClick}
        onTouchStart={handleClockClick}
        onMouseMove={(e) => isDragging && handleClockClick(e)}
        onTouchMove={(e) => isDragging && handleClockClick(e)}
      >
        {/* Clock numbers */}
        {Array.from({ length: 12 }, (_, i) => {
          const hour = i === 0 ? 12 : i
          const angle = i * 30 - 90
          const rad = (angle * Math.PI) / 180
          const distance = 45 // Distance from center
          const x = 50 + distance * Math.cos(rad)
          const y = 50 + distance * Math.sin(rad)
          
          return (
            <div
              key={i}
              className="absolute text-sm font-medium text-gray-300 pointer-events-none"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {hour}
            </div>
          )
        })}

        {/* Minute markers */}
        {Array.from({ length: 60 }, (_, i) => {
          if (i % 5 === 0) return null // Skip where numbers are
          const angle = i * 6 - 90
          const rad = (angle * Math.PI) / 180
          const distance = 48
          const x = 50 + distance * Math.cos(rad)
          const y = 50 + distance * Math.sin(rad)
          
          return (
            <div
              key={i}
              className="absolute w-1 h-1 bg-gray-400 rounded-full pointer-events-none"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)'
              }}
            />
          )
        })}

        {/* Hour hand */}
        <div
          className="absolute top-1/2 left-1/2 w-1 h-16 bg-white origin-bottom pointer-events-none"
          style={{
            transform: `translate(-50%, -100%) rotate(${hourAngle}deg)`
          }}
        />

        {/* Minute hand */}
        <div
          className="absolute top-1/2 left-1/2 w-1 h-24 bg-blue-500 origin-bottom pointer-events-none"
          style={{
            transform: `translate(-50%, -100%) rotate(${minuteAngle}deg)`
          }}
        />

        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Buttons */}
      <div className="flex space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleConfirm}>
          Confirm
        </Button>
      </div>
    </div>
  )
}

export { Clock }
