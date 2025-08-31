"use client"

import * as React from "react"
import { Clock as ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface TimePickerProps {
  id: string
  value: string | null
  onChange: (time: string) => void
  className?: string
  minTime?: string
  maxTime?: string
  step?: number
  disabled?: boolean
  onDurationChange?: (duration: string) => void
  companionTime?: string
}

const TimePicker: React.FC<TimePickerProps> = ({
  id,
  value,
  onChange,
  className = "",
  minTime,
  maxTime,
  step = 1,
  disabled = false,
  onDurationChange,
  companionTime
}) => {
  const [internalValue, setInternalValue] = React.useState(value || "11:00")
  const [tempValue, setTempValue] = React.useState(value || "11:00") // temporary until confirm
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isValid, setIsValid] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState("")
  const [manualInput, setManualInput] = React.useState(value || "")

  const calculateDuration = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return "0h 0m"
    const [sh, sm] = startTime.split(":").map(Number)
    const [eh, em] = endTime.split(":").map(Number)
    let mins = eh * 60 + em - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const validateTime = (time: string) => {
    if (!time) return { isValid: true, message: "" }
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!regex.test(time)) return { isValid: false, message: "Invalid time" }
    const [h, m] = time.split(":").map(Number)
    const total = h * 60 + m
    if (minTime) {
      const [mh, mm] = minTime.split(":").map(Number)
      if (total < mh * 60 + mm) return { isValid: false, message: `Must be after ${minTime}` }
    }
    if (maxTime) {
      const [Mh, Mm] = maxTime.split(":").map(Number)
      if (total > Mh * 60 + Mm) return { isValid: false, message: `Must be before ${maxTime}` }
    }
    return { isValid: true, message: "" }
  }

  const confirmTime = () => {
    const v = validateTime(tempValue)
    setIsValid(v.isValid)
    setErrorMessage(v.message)
    if (v.isValid) {
      setInternalValue(tempValue)
      setManualInput(tempValue)
      onChange(tempValue)
      if (companionTime && onDurationChange) {
        onDurationChange(calculateDuration(companionTime, tempValue))
      }
      setIsDialogOpen(false)
    }
  }

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualInput(e.target.value)
    const v = validateTime(e.target.value)
    setIsValid(v.isValid)
    setErrorMessage(v.message)
    if (v.isValid) {
      setTempValue(e.target.value) // update temp selection
    }
  }

  const formatDisplayTime = (time: string) => {
    if (!time) return "Select time"
    const [h, m] = time.split(":").map(Number)
    const h12 = h % 12 || 12
    return `${h12}:${m.toString().padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
  }

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"))

  return (
    <div className={cn("flex flex-col", className)}>
      <input type="time" id={id} value={internalValue} className="hidden" readOnly />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-black border-gray-600 text-white hover:bg-gray-800 hover:text-white rounded-xl",
              !isValid && "border-red-500 ring-2 ring-red-500"
            )}
            disabled={disabled}
          >
            <ClockIcon className="mr-2 h-4 w-4" />
            {formatDisplayTime(internalValue)}
          </Button>
        </DialogTrigger>

        <DialogContent className="p-6 max-w-md bg-zinc-900 border-gray-700 rounded-2xl shadow-xl">
          {/* Heading with manual input */}
          <div className="flex flex-col gap-2 mb-6">
            <label className="text-gray-300 text-sm">Enter Time (HH:mm)</label>
            <Input
              type="text"
              value={manualInput}
              onChange={handleManualInput}
              placeholder="e.g. 10:30"
              className="bg-zinc-800 text-white border-gray-600 rounded-lg"
            />
          </div>

          {/* Scrollable picker */}
          <div className="flex justify-center gap-8 relative">
            {/* Hours */}
            <div className="overflow-y-scroll snap-y snap-mandatory h-48 w-20 text-center text-white scrollbar-hide rounded-lg">
              {hours.map((h) => (
                <div
                  key={h}
                  className={cn(
                    "snap-center py-3 cursor-pointer transition-all duration-150",
                    tempValue.split(":")[0] === h
                      ? "text-blue-400 text-xl font-bold bg-zinc-800 rounded-md"
                      : "text-gray-400 text-lg hover:text-white"
                  )}
                  onClick={() => setTempValue(`${h}:${tempValue.split(":")[1]}`)}
                >
                  {h}
                </div>
              ))}
            </div>

            <span className="text-2xl font-bold text-gray-300 self-center">:</span>

            {/* Minutes */}
            <div className="overflow-y-scroll snap-y snap-mandatory h-48 w-20 text-center text-white scrollbar-hide rounded-lg">
              {minutes.map((m) => (
                <div
                  key={m}
                  className={cn(
                    "snap-center py-3 cursor-pointer transition-all duration-150",
                    tempValue.split(":")[1] === m
                      ? "text-blue-400 text-xl font-bold bg-zinc-800 rounded-md"
                      : "text-gray-400 text-lg hover:text-white"
                  )}
                  onClick={() => setTempValue(`${tempValue.split(":")[0]}:${m}`)}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>

          {/* Confirm button */}
          <div className="mt-6 text-center">
            <Button onClick={confirmTime} className="w-full">
              Confirm Time
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!isValid && <p className="text-red-500 text-sm mt-1">{errorMessage}</p>}
      {isValid && companionTime && internalValue && (
        <p className="text-green-500 text-sm mt-1">
          Duration: {calculateDuration(companionTime, internalValue)}
        </p>
      )}
    </div>
  )
}

export { TimePicker }
