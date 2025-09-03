"use client"

import * as React from "react"
import { Clock as ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog"
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
  const [tempValue, setTempValue] = React.useState(value || "11:00")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isValid, setIsValid] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState("")
  const [manualInput, setManualInput] = React.useState(value || "")

  // New state for AM/PM
  const [ampm, setAmPm] = React.useState(value && parseInt(value.split(":")[0]) >= 12 ? "PM" : "AM")

  const hoursRef = React.useRef<HTMLDivElement>(null)
  const minutesRef = React.useRef<HTMLDivElement>(null)

  const calculateDuration = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return "0h 0m"
    const [sh, sm] = startTime.split(":").map(Number)
    const [eh, em] = endTime.split(":").map(Number)
    let mins = eh * 60 + em - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const convertTo24Hour = (h: number, meridiem: string) => {
    if (meridiem === "PM" && h !== 12) return h + 12
    if (meridiem === "AM" && h === 12) return 0
    return h
  }

  const validateTime = (time: string, currentAmPm: string) => {
    if (!time) return { isValid: true, message: "" }
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    const formattedTime = `${convertTo24Hour(parseInt(time.split(":")[0]), currentAmPm)}:${time.split(":")[1]}`
    if (!regex.test(formattedTime)) return { isValid: false, message: "Invalid time format" }

    const [h, m] = formattedTime.split(":").map(Number)
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
    const v = validateTime(tempValue, ampm)
    setIsValid(v.isValid)
    setErrorMessage(v.message)
    if (v.isValid) {
      const confirmedTime24 = `${convertTo24Hour(parseInt(tempValue.split(":")[0]), ampm).toString().padStart(2, '0')}:${tempValue.split(":")[1]}`
      setInternalValue(confirmedTime24)
      onChange(confirmedTime24)
      if (companionTime && onDurationChange) {
        onDurationChange(calculateDuration(companionTime, confirmedTime24))
      }
      setIsDialogOpen(false)
    }
  }

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setManualInput(inputValue)
    const regex = /^(0?[1-9]|1[0-2]):[0-5][0-9]$/
    if (regex.test(inputValue)) {
      setTempValue(inputValue)
      setIsValid(true)
      setErrorMessage("")
    } else {
      setIsValid(false)
      setErrorMessage("Invalid time format (HH:mm)")
    }
  }

  const formatDisplayTime = (time: string) => {
    if (!time) return "Select time"
    const [h, m] = time.split(":").map(Number)
    const h12 = h % 12 || 12
    const meridiem = h < 12 ? "AM" : "PM"
    return `${h12}:${m.toString().padStart(2, "0")} ${meridiem}`
  }

  const hours12 = Array.from({ length: 12 }, (_, i) => ((i + 1) % 12 || 12).toString().padStart(2, "0"))
  const minutes = Array.from({ length: 60 / step }, (_, i) => (i * step).toString().padStart(2, "0"))

  // Effect to scroll to the correct position when the dialog opens
  React.useLayoutEffect(() => {
    if (isDialogOpen && hoursRef.current && minutesRef.current) {
      const [h, m] = tempValue.split(":")

      const hour12 = parseInt(h) % 12 || 12
      const formattedHour = hour12.toString().padStart(2, '0')

      const selectedHourDiv = hoursRef.current.querySelector(`[data-value="${formattedHour}"]`) as HTMLDivElement
      const selectedMinuteDiv = minutesRef.current.querySelector(`[data-value="${m}"]`) as HTMLDivElement

      if (selectedHourDiv) {
        hoursRef.current.scrollTop = selectedHourDiv.offsetTop - hoursRef.current.offsetHeight / 2 + selectedHourDiv.offsetHeight / 2;
      }
      if (selectedMinuteDiv) {
        minutesRef.current.scrollTop = selectedMinuteDiv.offsetTop - minutesRef.current.offsetHeight / 2 + selectedMinuteDiv.offsetHeight / 2;
      }
    }
  }, [isDialogOpen, tempValue]);

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (open) {
      const [h, m] = internalValue.split(":").map(Number);
      const h12 = h % 12 || 12;
      setTempValue(`${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      setManualInput(`${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      setAmPm(h < 12 ? "AM" : "PM");
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white rounded-xl transition-colors duration-200",
              !isValid && "border-red-500 ring-2 ring-red-500"
            )}
            disabled={disabled}
          >
            <ClockIcon className="mr-2 h-4 w-4 text-blue-400" />
            {formatDisplayTime(internalValue)}
          </Button>
        </DialogTrigger>

        <DialogContent className="p-0 max-w-sm bg-zinc-950 border-zinc-800 rounded-2xl shadow-xl">
          {/* Top Selection Display */}
          <div className="flex flex-col items-center justify-center p-6 bg-zinc-900 border-b border-zinc-800 rounded-t-2xl">
            <h3 className="text-sm font-medium text-blue-400 mb-2">SELECT TIME</h3>
            <div className="flex items-center text-5xl font-extrabold text-white">
              <span className="font-mono">{tempValue.split(":")[0]}</span>
              <span className="text-blue-400 mx-1">:</span>
              <span className="font-mono">{tempValue.split(":")[1]}</span>
              <span className="ml-3 text-2xl font-bold text-gray-400">{ampm}</span>
            </div>
          </div>

          {/* Scrollable picker */}
          <div className="flex justify-center gap-4 relative py-6">
            {/* Hours */}
            <div
              ref={hoursRef}
              className="overflow-y-scroll snap-y snap-mandatory h-48 w-24 text-center text-white scrollbar-hide rounded-lg"
            >
              {hours12.map((h) => (
                <div
                  key={h}
                  data-value={h}
                  className={cn(
                    "snap-center py-3 cursor-pointer transition-all duration-150",
                    tempValue.split(":")[0] === h
                      ? "text-blue-400 text-xl font-bold bg-zinc-800 rounded-md ring-2 ring-blue-400"
                      : "text-gray-400 text-lg hover:text-white"
                  )}
                  onClick={() => {
                    setTempValue(`${h}:${tempValue.split(":")[1]}`)
                    setManualInput(`${h}:${tempValue.split(":")[1]}`)
                  }}
                >
                  {h}
                </div>
              ))}
            </div>

            <span className="text-2xl font-bold text-gray-300 self-center">:</span>

            {/* Minutes */}
            <div
              ref={minutesRef}
              className="overflow-y-scroll snap-y snap-mandatory h-48 w-24 text-center text-white scrollbar-hide rounded-lg"
            >
              {minutes.map((m) => (
                <div
                  key={m}
                  data-value={m}
                  className={cn(
                    "snap-center py-3 cursor-pointer transition-all duration-150",
                    tempValue.split(":")[1] === m
                      ? "text-blue-400 text-xl font-bold bg-zinc-800 rounded-md ring-2 ring-blue-400"
                      : "text-gray-400 text-lg hover:text-white"
                  )}
                  onClick={() => {
                    setTempValue(`${tempValue.split(":")[0]}:${m}`)
                    setManualInput(`${tempValue.split(":")[0]}:${m}`)
                  }}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>

          {/* AM/PM toggle and Confirm Button */}
          <div className="flex flex-col gap-2 p-6 pt-0">
            <div className="flex justify-center gap-1 mb-4">
              <Button
                variant={ampm === "AM" ? "default" : "outline"}
                onClick={() => setAmPm("AM")}
                className={cn(
                  "w-24 h-10 text-lg font-semibold",
                  ampm === "AM"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-zinc-800 text-gray-400 border-zinc-700 hover:bg-zinc-700 hover:text-white"
                )}
              >
                AM
              </Button>
              <Button
                variant={ampm === "PM" ? "default" : "outline"}
                onClick={() => setAmPm("PM")}
                className={cn(
                  "w-24 h-10 text-lg font-semibold",
                  ampm === "PM"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-zinc-800 text-gray-400 border-zinc-700 hover:bg-zinc-700 hover:text-white"
                )}
              >
                PM
              </Button>
            </div>
            <Button onClick={confirmTime} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-xl shadow-lg">
              Confirm Time
            </Button>
            {!isValid && <p className="text-red-500 text-sm mt-2 text-center">{errorMessage}</p>}
          </div>
        </DialogContent>
      </Dialog>

      {isValid && companionTime && internalValue && (
        <p className="text-green-500 text-sm mt-1">
          Duration: {calculateDuration(companionTime, internalValue)}
        </p>
      )}
    </div>
  )
}

export { TimePicker }