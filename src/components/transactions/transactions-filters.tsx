"use client"

import { useRef, useState } from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import type { TransactionFilters } from "@/lib/transactions"
import { BROKERS } from "@/lib/types"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

interface TransactionsFiltersProps {
  filters: TransactionFilters
  onFiltersChange: (filters: TransactionFilters) => void
}

const allBrokers = [...BROKERS.active, ...BROKERS.archived]

export function TransactionsFilters({
  filters,
  onFiltersChange,
}: TransactionsFiltersProps) {
  const [symbolInput, setSymbolInput] = useState(filters.symbol ?? "")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSymbolChange(value: string) {
    setSymbolInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, symbol: value || undefined })
    }, 300)
  }

  function handlePlatformChange(value: string) {
    onFiltersChange({
      ...filters,
      platform: value === "all" ? undefined : value,
    })
  }

  function handleTypeChange(value: string) {
    onFiltersChange({
      ...filters,
      type: value === "all" || value === "" ? undefined : value,
    })
  }

  function handleDateFromChange(date: Date | undefined) {
    onFiltersChange({
      ...filters,
      dateFrom: date ? format(date, "yyyy-MM-dd") : undefined,
    })
  }

  function handleDateToChange(date: Date | undefined) {
    onFiltersChange({
      ...filters,
      dateTo: date ? format(date, "yyyy-MM-dd") : undefined,
    })
  }

  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Symbol search */}
      <Input
        placeholder="Search symbol..."
        className="w-[200px]"
        value={symbolInput}
        onChange={(e) => handleSymbolChange(e.target.value)}
      />

      {/* Platform dropdown */}
      <Select
        value={filters.platform ?? "all"}
        onValueChange={handlePlatformChange}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Platforms" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Platforms</SelectItem>
          {allBrokers.map((broker) => (
            <SelectItem key={broker} value={broker}>
              {broker}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Buy/Sell toggle */}
      <ToggleGroup
        type="single"
        variant="outline"
        value={filters.type ?? "all"}
        onValueChange={handleTypeChange}
      >
        <ToggleGroupItem value="all" aria-label="Show all">
          All
        </ToggleGroupItem>
        <ToggleGroupItem value="Buy" aria-label="Show buys">
          Buy
        </ToggleGroupItem>
        <ToggleGroupItem value="Sell" aria-label="Show sells">
          Sell
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Date From */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[140px] justify-start text-left font-normal",
              !dateFrom && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {dateFrom ? format(dateFrom, "dd MMM yyyy") : "From"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateFrom}
            onSelect={handleDateFromChange}
          />
        </PopoverContent>
      </Popover>

      {/* Date To */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[140px] justify-start text-left font-normal",
              !dateTo && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {dateTo ? format(dateTo, "dd MMM yyyy") : "To"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateTo}
            onSelect={handleDateToChange}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
