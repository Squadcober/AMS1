"use client"

import { toast } from "@/components/ui/use-toast";

// ...existing imports...

import { useSession } from "next-auth/react";
import { useEffect } from "react";

import { useState } from "react";

export default function Achievement() {
  // ...existing state declarations...
  const [achievements, setAchievements] = useState<any[]>([]);

  // Add state for new achievement form data
  const defaultAchievementData = {
    title: "",
    description: "",
    // add other fields as needed
  };
  const [newAchievementData, setNewAchievementData] = useState(defaultAchievementData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get user from session
  const { data: session } = useSession();
  const user = session?.user;

  // Replace localStorage fetch with MongoDB fetch
  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        if (!user?.id || !user?.academyId) return;

        const response = await fetch(`/api/db/ams-achievement?playerId=${user.id}&academyId=${user.academyId}`);
        if (!response.ok) throw new Error('Failed to fetch achievements');

        const data = await response.json();
        setAchievements(data);
      } catch (error) {
        console.error('Error loading achievements:', error);
      }
    };

    fetchAchievements();
  }, [user?.id, user?.academyId]);

  // Replace localStorage save with MongoDB save
  const handleSaveAchievement = async () => {
    try {
      if (!user?.id || !user?.academyId) {
        toast({
          title: "Error",
          description: "User information not found",
          variant: "destructive",
        });
        return;
      }

      const newAchievement = {
        ...newAchievementData,
        playerId: user.id,
        academyId: user.academyId,
        createdAt: new Date(),
        isVerified: false
      };

      const response = await fetch('/api/db/ams-achievement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAchievement),
      });

      if (!response.ok) throw new Error('Failed to save achievement');

      const savedAchievement = await response.json();

      setAchievements(prev => [...prev, { ...newAchievement, _id: savedAchievement._id }]);
      setIsDialogOpen(false);
      setNewAchievementData(defaultAchievementData);

      toast({
        title: "Success",
        description: "Achievement saved successfully",
      });
    } catch (error) {
      console.error('Error saving achievement:', error);
      toast({
        title: "Error",
        description: "Failed to save achievement",
        variant: "destructive",
      });
    }
  };

  // Replace localStorage delete with MongoDB delete
  const handleDeleteAchievement = async (id: string) => {
    try {
      const response = await fetch(`/api/db/ams-achievement/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete achievement');

      setAchievements(prev => prev.filter(achievement => achievement._id !== id));
      toast({
        title: "Success",
        description: "Achievement deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting achievement:', error);
      toast({
        title: "Error",
        description: "Failed to delete achievement",
        variant: "destructive",
      });
    }
  };

  // ...rest of existing code...

  return (
    <div>
      {/* Replace this with your actual JSX for the Achievement page */}
      <h1>Achievements</h1>
      {/* Example: List achievements */}
      <ul>
        {achievements?.map((achievement: any) => (
          <li key={achievement._id}>{achievement.title}</li>
        ))}
      </ul>
    </div>
  );
}
