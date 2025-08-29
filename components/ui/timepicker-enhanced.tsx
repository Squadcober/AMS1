"use client"

import * as React from "react"
import { Clock as ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Clock as ClockComponent } from "@/components/ui/clock"

interface TimePickerEnhancedProps {
  id: string
  value: string | null
  onChange: (time: string) => void
  className?: string
  minTime?: string
  maxTime?: string
  step?: number
  disabled?: boolean
  onDurationChange?: (duration: string) => void
  companionTime?: string // For calculating duration between two times
}

const TimePickerEnhanced: React.FC<TimePickerEnhancedProps> = ({
  id,
  value,
  onChange,
  className = "",
  minTime,
  maxTime,
  step = 900, // 15 minutes default
  disabled = false,
  onDurationChange,
  companionTime
}) => {
  const [internalValue, setInternalValue] = React.useState(value || "11:00")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isValid, setIsValid] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState("")

  // Calculate duration between two times
  const calculateDuration = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return "0h 0m"
    
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    
    let durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
    if (durationMinutes < 0) durationMinutes += 24 * 60 // Handle overnight sessions
    
    const hours = Math.floor(durationMinutes / 60)
    const minutes = durationMinutes % 60
    
    return `${hours}h ${minutes}m`
  }

  // Validate time against constraints
  const validateTime = (time: string): { isValid: boolean; message: string } => {
    if (!time) return { isValid: true, message: "" }

    // Basic format validation
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(time)) {
      return { isValid: false, message: "Invalid time format" }
    }

    const [hours, minutes] = time.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes

    // Validate against minTime
    if (minTime) {
      const [minHours, minMinutes] = minTime.split(':').map(Number)
      const minTotalMinutes = minHours * 60 + minMinutes
      if (totalMinutes < minTotalMinutes) {
        return { 
          isValid: false, 
          message: `Time must be after ${minTime}` 
        }
      }
    }

    // Validate against maxTime
    if (maxTime) {
      const [maxHours, maxMinutes] = maxTime.split(':').map(Number)
      const maxTotalMinutes = maxHours * 60 + maxMinutes
      if (totalMinutes > maxTotalMinutes) {
        return { 
          isValid: false, 
          message: `Time must be before ${maxTime}` 
        }
      }
    }

    return { isValid: true, message: "" }
  }

  const handleTimeChange = (newTime: string) => {
    const validation = validateTime(newTime)
    setIsValid(validation.isValid)
    setErrorMessage(validation.message)

    if (validation.isValid && newTime) {
      setInternalValue(newTime)
      onChange(newTime)
      
      // Calculate duration if companion time is provided
      if (companionTime && onDurationChange) {
        const duration = calculateDuration(companionTime, newTime)
        onDurationChange(duration)
      }
    }
    setIsDialogOpen(false)
  }

  const handleCancel = () => {
    setIsDialogOpen(false)
  }

  // Format time for display (convert 24h to 12h with AM/PM)
  const formatDisplayTime = (time: string) => {
    if (!time) return "Select time"
    
    const [hours, minutes] = time.split(':').map(Number)
    const hours12 = hours % 12 || 12
    const ampm = hours < 12 ? 'AM' : 'PM'
    
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  // Update internal value when prop changes
  React.useEffect(() => {
    setInternalValue(value || "11:00")
    const validation = validateTime(value || "")
    setIsValid(validation.isValid)
    setErrorMessage(validation.message)
  }, [value])

  // Calculate duration when companion time changes
  React.useEffect(() => {
    if (companionTime && internalValue && onDurationChange) {
      const duration = calculateDuration(companionTime, internalValue)
      onDurationChange(duration)
    }
  }, [companionTime, internalValue, onDurationChange])

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Hidden input for form submission */}
      <input
        type="time"
        id={id}
        value={internalValue}
        onChange={(e) => {
          setInternalValue(e.target.value)
          onChange?.(e.target.value)
        }}
        className="absolute opacity-0 w-0 h-0"
        min={minTime}
        max={maxTime}
        step={step}
        disabled={disabled}
      />
      
      {/* Custom time picker button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-black border-gray-600 text-white hover:bg-gray-800 hover:text-white",
              !internalValue && "text-muted-foreground",
              !isValid && 'border-red-500 ring-2 ring-red-500'
            )}
            disabled={disabled}
          >
            <ClockIcon className="mr-2 h-4 w-4" />
            {formatDisplayTime(internalValue)}
          </Button>
        </DialogTrigger>
        <DialogContent className="p-0 max-w-min border-gray-600 bg-black">
          <ClockComponent
            value={internalValue}
            onChange={handleTimeChange}
            onCancel={handleCancel}
          />
        </DialogContent>
      </Dialog>
      
      {!isValid && (
        <p className="text-red-500 text-sm mt-1">{errorMessage}</p>
      )}
      {isValid && companionTime && internalValue && (
        <p className="text-green-500 text-sm mt-1">
          Duration: {calculateDuration(companionTime, internalValue)}
        </p>
      )}
    </div>
  )
}

export { TimePickerEnhanced }
