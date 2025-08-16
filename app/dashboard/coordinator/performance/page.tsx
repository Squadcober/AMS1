"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import Sidebar from "@/components/Sidebar"
import { useToast } from "@/components/ui/use-toast"

export default function PerformancePage() {
  const { user } = useAuth()
  const [players, setplayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchplayers = async () => {
      try {
        if (!user?.academyId) return;

        const response = await fetch(`/api/db/ams-player-data?academyId=${user.academyId}`);
        if (!response.ok) throw new Error('Failed to fetch players');
        
        const data = await response.json();
        setplayers(data);
      } catch (error) {
        console.error('Error fetching players:', error);
        toast({
          title: "Error",
          description: "Failed to load player data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchplayers();
  }, [user?.academyId]);

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="flex items-center justify-center h-full">
            Loading player data...
          </div>
        </div>
      </div>
    );
  }

  // ...existing code for the rest of the component...
}