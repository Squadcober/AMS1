"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { usePlayers } from "../contexts/PlayerContext"
import { useBatches } from "../contexts/BatchContext"
import { Radar } from "react-chartjs-2"
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from "chart.js"
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Loader2, TrendingUp, Calendar } from "lucide-react"

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface PlayerAttributes {
  Attack: number;
  pace: number;
  Physicality: number;
  Defense: number;
  passing: number;
  Technique: number;
}

interface Props {
  batchId: string
}

type FilterType = 'latest' | 'overall'

export default function ComparePlayers({ batchId }: Props) {
  const { players } = usePlayers()
  const { batches } = useBatches()
  const [playersToCompare, setPlayersToCompare] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [attributeFilter, setAttributeFilter] = useState<FilterType>('latest')

  // Get the selected batch
  const selectedBatch = useMemo(() => {
    return batches.find(batch => batch.id === batchId)
  }, [batches, batchId])

  // Get players from the selected batch
  const batchPlayers = useMemo(() => {
    if (!selectedBatch || !selectedBatch.players) return []
    
    return players.filter(player => 
      selectedBatch.players.includes(player.id.toString())
    )
  }, [players, selectedBatch])

  const handlePlayerSelect = (playerId: string) => {
    if (playersToCompare.includes(playerId)) {
      setPlayersToCompare(playersToCompare.filter((id) => id !== playerId))
    } else if (playersToCompare.length < 11) {
      setPlayersToCompare([...playersToCompare, playerId])
    }
  }

  const clearAllSelections = () => {
    setPlayersToCompare([])
  }

  // Helper function to get latest attribute value for a player
  const getLatestAttributeValue = (player: any, attribute: string): number => {
    if (!player) return 0;
    
    // First check current attributes
    if (player.attributes && player.attributes[attribute] !== undefined) {
      return player.attributes[attribute];
    }

    // If no current attributes, check performance history
    if (player.performanceHistory && player.performanceHistory.length > 0) {
      // Sort history by date in descending order
      const sortedHistory = [...player.performanceHistory].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      // Find the most recent entry with this attribute
      const latestEntry = sortedHistory.find(entry => 
        entry.attributes && entry.attributes[attribute] !== undefined
      );

      if (latestEntry) {
        return latestEntry.attributes[attribute];
      }
    }

    return 0;
  };

  // Enhanced helper function to get average attribute value for a player
  const getAverageAttributeValue = (player: any, attribute: string): number => {
    if (!player) return 0;

    const values: number[] = [];

    // Add current attribute if available
    if (player.attributes && player.attributes[attribute] !== undefined) {
      values.push(player.attributes[attribute]);
    }

    // Add all historical values
    if (player.performanceHistory && player.performanceHistory.length > 0) {
      player.performanceHistory.forEach((entry: any) => {
        if (entry.attributes && entry.attributes[attribute] !== undefined) {
          values.push(entry.attributes[attribute]);
        }
      });
    }

    if (values.length === 0) return 0;

    // Calculate average and round to 1 decimal place
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / values.length) * 10) / 10;
  };

  // Helper function to get the number of data points for a player
  const getDataPointsCount = (player: any): number => {
    let count = 0;
    if (player.attributes) count += 1;
    if (player.performanceHistory) count += player.performanceHistory.length;
    return count;
  };

  // Updated generateRadarData function with enhanced styling
  const generateRadarData = () => {
    const labels = ["Attack", "Pace", "Physicality", "Defense", "passing", "Technique"]
    
    // Define distinct colors for better visibility
    const colors = [
      { bg: "rgba(255, 99, 132, 0.3)", border: "rgb(255, 99, 132)" },    // Red
      { bg: "rgba(54, 162, 235, 0.3)", border: "rgb(54, 162, 235)" },    // Blue
      { bg: "rgba(255, 206, 86, 0.3)", border: "rgb(255, 206, 86)" },    // Yellow
      { bg: "rgba(75, 192, 192, 0.3)", border: "rgb(75, 192, 192)" },    // Teal
      { bg: "rgba(153, 102, 255, 0.3)", border: "rgb(153, 102, 255)" },  // Purple
      { bg: "rgba(255, 159, 64, 0.3)", border: "rgb(255, 159, 64)" },    // Orange
      { bg: "rgba(199, 199, 199, 0.3)", border: "rgb(199, 199, 199)" },  // Grey
      { bg: "rgba(83, 102, 255, 0.3)", border: "rgb(83, 102, 255)" },    // Indigo
      { bg: "rgba(255, 99, 255, 0.3)", border: "rgb(255, 99, 255)" },    // Magenta
      { bg: "rgba(99, 255, 132, 0.3)", border: "rgb(99, 255, 132)" },    // Lime
      { bg: "rgba(255, 193, 7, 0.3)", border: "rgb(255, 193, 7)" },      // Amber
    ];
    
    const datasets = playersToCompare.map((playerId, index) => {
      const player = players.find((p) => p.id.toString() === playerId)
      const colorSet = colors[index % colors.length];
      
      // Get attribute values based on selected filter
      const getAttributeValue = attributeFilter === 'latest' 
        ? (attr: string) => getLatestAttributeValue(player, attr)
        : (attr: string) => getAverageAttributeValue(player, attr)

      const dataPointsCount = getDataPointsCount(player);
      const labelSuffix = attributeFilter === 'overall' && dataPointsCount > 1 
        ? ` (${dataPointsCount} points)` 
        : '';

      return {
        label: `${player?.name || ""}${labelSuffix}`,
        data: [
          getAttributeValue('Attack'),
          getAttributeValue('pace'),
          getAttributeValue('Physicality'),
          getAttributeValue('Defense'),
          getAttributeValue('passing'),
          getAttributeValue('Technique'),
        ],
        backgroundColor: colorSet.bg,
        borderColor: colorSet.border,
        borderWidth: 3,
        pointBackgroundColor: colorSet.border,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
      }
    })
    return { labels, datasets }
  }

  const radarOptions = {
    scales: {
      r: {
        beginAtZero: true,
        max: 10,
        min: 0,
        ticks: {
          stepSize: 1,
          display: false,
        },
        grid: {
          color: "rgba(255, 255, 255, 0.2)",
        },
        pointLabels: {
          color: "rgb(255, 255, 255)",
          font: {
            size: 14,
            weight: 'bold' as const,
          },
        },
        angleLines: {
          color: "rgba(255, 255, 255, 0.2)",
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: "rgb(255, 255, 255)",
          font: {
            size: 12,
            weight: 'bold' as const,
          },
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'rgb(255, 255, 255)',
        bodyColor: 'rgb(255, 255, 255)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const value = attributeFilter === 'overall' 
              ? context.parsed.r.toFixed(1) 
              : context.parsed.r.toString();
            return `${context.dataset.label}: ${value}`;
          }
        }
      },
    },
    maintainAspectRatio: false,
  }

  // Show loading state if batches are still loading
  if (batches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compare Players</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading batches...</span>
        </CardContent>
      </Card>
    )
  }

  // Show empty state if no batch is selected or no players in batch
  if (!selectedBatch || batchPlayers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compare Players</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          {!selectedBatch ? (
            <p>Please select a batch to compare players</p>
          ) : (
            <p>No players available in the selected batch</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Compare Players</span>
          <div className="flex items-center gap-2">
            {playersToCompare.length > 0 && (
              <>
                <Badge variant="secondary">
                  {playersToCompare.length} selected
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearAllSelections}
                >
                  Clear All
                </Button>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {/* Section 1: Player List with Horizontal Scrolling */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Select Players</h3>
                <p className="text-sm text-muted-foreground">
                  Choose players to compare (up to 11). Scroll horizontally to browse all players.
                </p>
              </div>
              {playersToCompare.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {playersToCompare.length} selected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllSelections}
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto -mx-2 px-2 pb-4">
              <div className="flex gap-3 py-2 min-w-full">
                {batchPlayers.map((player) => {
                  const isSelected = playersToCompare.includes(player.id.toString())
                  const dataPoints = getDataPointsCount(player);

                  return (
                    <div
                      key={player.id}
                      className={`min-w-[240px] flex-shrink-0 flex items-center p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-sm"
                          : "bg-card hover:bg-accent"
                      }`}
                      onClick={() => handlePlayerSelect(player.id.toString())}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handlePlayerSelect(player.id.toString())}
                        className="mr-3 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Avatar className="h-10 w-10 mr-3 flex-shrink-0">
                        <AvatarImage src={player.photoUrl} alt={player.name} />
                        <AvatarFallback className="text-sm">
                          {player.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{player.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {player.position && (
                            <p className="text-xs text-muted-foreground">
                              {player.position}
                            </p>
                          )}
                          {dataPoints > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {dataPoints} records
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Badge variant="outline" className="ml-2 flex-shrink-0">
                          Selected
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Radar Chart Area */}
          {playersToCompare.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Radar Chart Comparison</h3>
                  <p className="text-sm text-muted-foreground">
                    Visual comparison of player attributes
                  </p>
                </div>

                {/* Filter buttons for radar chart */}
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  <Button
                    variant={attributeFilter === 'latest' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setAttributeFilter('latest')}
                    className="flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Latest
                  </Button>
                  <Button
                    variant={attributeFilter === 'overall' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setAttributeFilter('overall')}
                    className="flex items-center gap-2"
                  >
                    <TrendingUp className="h-4 w-4" />
                    Overall Avg
                  </Button>
                </div>
              </div>

              {/* Filter description */}
              <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary/50">
                <div className="flex items-start gap-2">
                  {attributeFilter === 'latest' ? (
                    <Calendar className="h-4 w-4 mt-0.5 text-primary" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mt-0.5 text-primary" />
                  )}
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {attributeFilter === 'latest' ? 'Latest Values' : 'Overall Average'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {attributeFilter === 'latest'
                        ? "Shows the most recent attribute values for each player from their latest assessment or performance record"
                        : "Shows averaged attribute values calculated from all available performance history data points"
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Radar chart container */}
              <div className="h-96 bg-card/50 rounded-lg p-4 border">
                <Radar data={generateRadarData()} options={radarOptions} />
              </div>
            </div>
          )}

          {/* Section 3: Attribute Comparison Table with Horizontal Scrolling */}
          {playersToCompare.length > 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Detailed Attribute Comparison</h3>
                <p className="text-sm text-muted-foreground">
                  Scroll horizontally to view all player comparisons. Scroll vertically for all attributes.
                </p>
              </div>

              <div
                className="overflow-x-auto overflow-y-auto max-h-96 border rounded-lg"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="min-w-[800px]">
                  <table className="w-full border-collapse border border-gray-700 text-sm">
                    <thead className="sticky top-0 bg-gray-800 z-10">
                      <tr>
                        <th className="border border-gray-700 px-4 py-3 text-left font-semibold min-w-[120px]">
                          Attribute
                        </th>
                        {playersToCompare.map((playerId) => {
                          const player = players.find((p) => p.id.toString() === playerId)
                          const dataPoints = getDataPointsCount(player);
                          return (
                            <th key={playerId} className="border border-gray-700 px-4 py-3 text-left min-w-[150px]">
                              <div>
                                <div className="font-semibold">{player?.name}</div>
                                {attributeFilter === 'overall' && dataPoints > 1 && (
                                  <div className="text-xs text-muted-foreground font-normal mt-1">
                                    {dataPoints} data points
                                  </div>
                                )}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {["Attack", "pace", "Physicality", "Defense", "passing", "Technique"].map((attr) => (
                        <tr key={attr} className="even:bg-gray-900/50 hover:bg-gray-800/30">
                          <td className="border border-gray-700 px-4 py-3 font-semibold capitalize sticky left-0 bg-gray-800">
                            {attr === 'passing' ? 'Passing' : attr}
                          </td>
                          {playersToCompare.map((playerId) => {
                            const player = players.find((p) => p.id.toString() === playerId)
                            const value = attributeFilter === 'latest'
                              ? getLatestAttributeValue(player, attr)
                              : getAverageAttributeValue(player, attr)

                            // Find max value for highlighting
                            const allValues = playersToCompare.map(id => {
                              const p = players.find(player => player.id.toString() === id);
                              return attributeFilter === 'latest'
                                ? getLatestAttributeValue(p, attr)
                                : getAverageAttributeValue(p, attr);
                            });
                            const maxValue = Math.max(...allValues);
                            const isHighest = value === maxValue && value > 0;

                            return (
                              <td
                                key={playerId}
                                className={`border border-gray-700 px-4 py-3 text-center ${
                                  isHighest ? 'bg-green-500/20 font-semibold' : ''
                                }`}
                              >
                                <div className="flex items-center justify-center gap-2">
                                  <span>{attributeFilter === 'overall' ? value.toFixed(1) : value}</span>
                                  {isHighest && value > 0 && (
                                    <span className="text-green-400 text-lg">★</span>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Empty state when no players selected */}
          {playersToCompare.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="max-w-sm mx-auto">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h4 className="text-lg font-medium mb-2">No Players Selected</h4>
                <p className="text-sm">
                  Select players from the list above to see their attribute comparison chart and detailed analysis
                </p>
                <p className="text-xs mt-2 opacity-75">
                  You can select up to 11 players at once
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}