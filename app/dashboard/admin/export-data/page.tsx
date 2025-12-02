"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import Sidebar from "@/components/Sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import * as XLSX from 'xlsx';

// Add: detect wrapped APK / WebView (heuristic)
const isWrappedWebView = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  // webtonative may include its name; wv/webview + android is common for Android WebView
  return ua.includes('webtonative') || ua.includes('wv') || (ua.includes('android') && ua.includes('webview'));
};

export default function ExportDataPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const exportOptions = [
    { id: 'players', label: 'Players Data' },
    { id: 'coaches', label: 'Coaches Data' },
    { id: 'batches', label: 'Batches Data' },
    { id: 'performance', label: 'Performance History' },
    { id: 'finances', label: 'Financial Records' },
  ]

  const calculateOverallRating = (attributes: any) => {
    const stats = [
      attributes?.Attack || 0,
      attributes?.pace || 0,
      attributes?.Physicality || 0,
      attributes?.Defense || 0,
      attributes?.passing || 0,
      attributes?.Technique || 0
    ];
    
    const validStats = stats.filter(stat => stat > 0);
    if (validStats.length === 0) return 0;
    
    const total = validStats.reduce((sum, stat) => sum + Number(stat), 0);
    return Math.round((total / (validStats.length * 10)) * 100);
  };

  const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString()
    };
  };

  const formatCSV = (data: any[], type: string) => {
    if (!data.length) return '';
    
    let csvContent = '';

    switch (type) {
      case 'players':
        csvContent = [
          'ID,Name,Position,Age,Overall Rating,Attack,Pace,Physicality,Defense,passing,Technique,Average Performance,Stamina,Enrollment Date',
          ...data.map(p => {
            const attrs = p.attributes || {};
            const overallRating = calculateOverallRating(attrs);
            return [
              p.id || p._id,
              `"${p.name || ''}"`,
              `"${p.position || ''}"`,
              p.age || '',
              `${overallRating}`,
              attrs.Attack || '',
              attrs.pace || '',
              attrs.Physicality || '',
              attrs.Defense || '',
              attrs.passing || '',
              attrs.Technique || '',
              p.averagePerformance || '',
              p.stamina || '',
              p.enrollmentDate || ''
            ].join(',');
          }),
        ].join('\n');
        break;

      case 'coaches':
        csvContent = [
          'ID,Name,Email,Specialization,Experience,Rating',
          ...data.map(c => [
            c.id || c._id,
            `"${c.name || ''}"`,
            `"${c.email || ''}"`,
            `"${c.specialization || ''}"`,
            `"${c.experience || ''}"`,
            c.rating || ''
          ].join(',')),
        ].join('\n');
        break;

      case 'performance':
        // API returns flattened array of performance records with playerId, playerName, and session data
        console.log('Performance export data received:', data); // Debug log
        
        if (!data || !Array.isArray(data) || data.length === 0) {
          console.log('No performance data found');
          return 'Player ID,Player Name,Date,Time,Session ID,Type,Attack,Pace,Physicality,Defense,passing,Technique,Session Rating,Overall\n'; // Empty CSV with headers
        }

        console.log('Total performance records:', data.length); // Debug log

        csvContent = [
          'Player ID,Player Name,Date,Time,Session ID,Type,Attack,Pace,Physicality,Defense,passing,Technique,Session Rating,Overall',
          ...data.map((session: any) => {
            const { date, time } = formatDateTime(session.date);
            const attrs = session.attributes || {};
            const overallRating = calculateOverallRating(attrs);
            
            return [
              session.playerId || '',
              `"${session.playerName || ''}"`,
              date,
              time,
              session.sessionId || '',
              session.type || 'training',
              attrs.Attack || session.Attack || '',
              attrs.pace || session.pace || '',
              attrs.Physicality || session.Physicality || '',
              attrs.Defense || session.Defense || '',
              attrs.passing || session.passing || '',
              attrs.Technique || session.Technique || '',
              session.sessionRating || '',
              `${overallRating}`
            ].join(',');
          }),
        ].join('\n');
        break;

      case 'batches':
        data.forEach((batch: any, idx: number) => {
          // Batch header
          csvContent += `Batch No.,${idx + 1},Batch Name,"${batch.name || ''}"\n`;
          csvContent += '\n';

          // Coach section
          csvContent += 'Role,ID,Name,Email,Specialization,Experience,Rating\n';
          if (batch.coachIds?.length > 0) {
            batch.coachIds.forEach((coachId: string) => {
              csvContent += [
                'Coach',
                `"${coachId}"`,
                `"${batch.coachNames?.[batch.coachIds.indexOf(coachId)] || ''}"`,
                `"${''}"`, // Email (if available)
                `"${''}"`, // Specialization (if available)
                `"${''}"`, // Experience (if available)
                `"${''}"`, // Rating (if available)
              ].join(',') + '\n';
            });
          }

          csvContent += '\n';

          // Player section header
          csvContent += [
            'Role', 'ID', 'Name', 'Position', 'Age', 'Overall Rating',
            'Attack', 'pace', 'Physicality', 'Defense', 'passing', 'Technique',
            'averagePerformance', 'stamina', 'lastUpdated'
          ].join(',') + '\n';

          // Use the fetched player data directly with overall calculation
          if (batch.playersData?.length > 0) {
            batch.playersData.forEach((player: any) => {
              const attrs = player.attributes || {};
              const overallRating = calculateOverallRating(attrs);
              
              csvContent += [
                'Player',
                `"${player.id}"`,
                `"${player.name}"`,
                `"${player.position}"`,
                `"${player.age}"`,
                `"${overallRating}"`,  // Overall rating as percentage
                `"${attrs.Attack}"`,
                `"${attrs.pace}"`,
                `"${attrs.Physicality}"`,
                `"${attrs.Defense}"`,
                `"${attrs.passing}"`,
                `"${attrs.Technique}"`,
                `"${player.averagePerformance}"`,
                `"${player.stamina}"`,
                `"${player.lastUpdated}"`
              ].join(',') + '\n';
            });
          }

          csvContent += '\n\n\n';
        });
        break;

      // Add more cases for other data types
    }

    return csvContent.trim();
  };

  const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const fetchCoachDetails = async (ids: string[]) => {
    if (!ids?.length) return [];
    const res = await fetch(`/api/db/coaches?ids=${ids.join(',')}`);
    if (!res.ok) return [];
    const coaches = await res.json();
    // Map fields if needed
    return coaches.map((c: any) => ({
      id: c.id || c._id || c.coachId || '',
      name: c.name || c.fullName || c.coachName || '',
      email: c.email || '',
      specialization: c.specialization || '',
      experience: c.experience || '',
      rating: c.rating || ''
    }));
  };

  const fetchPlayerDetails = async (ids: string[]) => {
    if (!ids?.length) return [];
    
    try {
      // Fetch all players from the same endpoint as player export
      const res = await fetch(`/api/db/export?academyId=${user?.academyId}&collection=players`);
      if (!res.ok) return [];
      const allPlayers = await res.json();

      // Filter and map the players we need
      return ids.map(playerId => {
        const playerData = allPlayers.find((p: any) => p.id === playerId || p._id === playerId) || {};
        return {
          id: playerId,
          name: playerData.name || '',
          position: playerData.position || '',
          age: playerData.age || '',
          attributes: playerData.attributes || {
            overall: playerData.overall || '',
            Attack: playerData.Attack || '',
            pace: playerData.pace || '',
            Physicality: playerData.Physicality || '',
            Defense: playerData.Defense || '',
            passing: playerData.passing || '',
            Technique: playerData.Technique || ''
          },
          averagePerformance: playerData.averagePerformance || '',
          stamina: playerData.stamina || '',
          lastUpdated: playerData.lastUpdated || ''
        };
      });
    } catch (error) {
      console.error('Error fetching player details:', error);
      return [];
    }
  };

  const formatFinancialData = (data: any[]) => {
    const pickTransactionId = (item: any) =>
      item.transactionId || item.transaction_id || item.id || item._id || '';

    const toDateTimeFields = (rawDate: any) => {
      if (!rawDate) return { date: '', time: '' };
      try {
        const { date, time } = formatDateTime(String(rawDate));
        return { date, time };
      } catch {
        return { date: String(rawDate), time: '' };
      }
    };

    const income = data
      .filter(item => item.type === 'income')
      .map(item => {
        const dt = toDateTimeFields(item.date);
        return {
          'Transaction ID': pickTransactionId(item),
          'Date': dt.date,
          'Time': dt.time,
          'Description': item.description,
          'Amount': item.amount,
          'Quantity': item.quantity || 1
        };
      });

    const expenses = data
      .filter(item => item.type === 'expense')
      .map(item => {
        const dt = toDateTimeFields(item.date);
        return {
          'Transaction ID': pickTransactionId(item),
          'Date': dt.date,
          'Time': dt.time,
          'Description': item.description,
          'Amount': item.amount,
          'Quantity': item.quantity || 1
        };
      });

    return { income, expenses };
  };

  const downloadExcel = (data: any, filename: string) => {
    const wb = XLSX.utils.book_new();
    
    // Add Income worksheet
    const wsIncome = XLSX.utils.json_to_sheet(data.income);
    XLSX.utils.book_append_sheet(wb, wsIncome, 'Income');
    
    // Add Expenses worksheet
    const wsExpenses = XLSX.utils.json_to_sheet(data.expenses);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');
    
    // Save the workbook
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handleExport = async (type: string) => {
    // Prevent multiple downloads at once
    if (loading) {
      toast({
        title: "Export in Progress",
        description: "Please wait for the current export to complete before starting another one.",
        variant: "destructive",
      });
      return;
    }

    setLoading(type);

    try {
      const response = await fetch(`/api/db/export?academyId=${user?.academyId}&collection=${type}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      // For APK/WebView, the API returns CSV directly for download
      if (isWrappedWebView()) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `export-${type}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        // Ensure loading resets after download
        setTimeout(() => setLoading(null), 1000);
        return;
      } else {
        // Web app logic
        let data = await response.json();

        if (type === 'finances') {
          const formattedData = formatFinancialData(data);
          downloadExcel(formattedData, 'financial_records');
        } else if (type === 'performance') {
          // For performance history, we need to get all players with their performance history
          const csvContent = formatCSV(data, type);
          if (!csvContent) {
            toast({
              title: "No Data",
              description: "No performance history data found to export.",
              variant: "destructive",
            });
            return;
          }
          downloadCSV(csvContent, 'performance_history.csv');
        } else if (type === 'batches') {
          const batches = Array.isArray(data) ? data : [data];
          for (const batch of batches) {
            if ((!batch.coaches || !batch.coaches.length) && batch.coachIds?.length) {
              batch.coaches = await fetchCoachDetails(batch.coachIds);
            }
            if ((!batch.playersData || !batch.playersData.length) && batch.players?.length) {
              batch.playersData = await fetchPlayerDetails(batch.players);
            }
          }
          const csvContent = formatCSV(batches, type);
          downloadCSV(csvContent, 'batches.csv');
        } else {
          const csvContent = formatCSV(data, type);
          downloadCSV(csvContent, `${type}.csv`);
        }
      }

      toast({
        title: "Success",
        description: "Data exported successfully",
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-8">Export Data</h1>

        <Card>
          <CardHeader>
            <CardTitle>Select Data to Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exportOptions.map(option => (
                <Card key={option.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{option.label}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(option.id)}
                      disabled={loading !== null}
                    >
                      {loading === option.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        'Export'
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
