"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { profile } from "console";

interface Batch {
  id: string;
  name: string;
  coachId: string;
  coachName: string;
  players: string[];
  academyId: string;
}

interface BatchContextType {
  batches: Batch[];
  setBatches: React.Dispatch<React.SetStateAction<Batch[]>>;
  setPublicRoute: (isPublic: boolean) => void;
  addSkippedRoute: (route: string) => void;
  removeSkippedRoute: (route: string) => void;
  isRouteSkipped: (route: string) => boolean;
}

const BatchContext = createContext<BatchContextType | undefined>(undefined);

export const BatchProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isPublicRoute, setIsPublicRoute] = useState(false);
  const [skippedRoutes, setSkippedRoutes] = useState<Set<string>>(
    new Set([
      '/auth',
      '/auth/signup',
      '/auth/admin_permission',
      '/dashboard/admin/about',
      '/dashboard/admin/attendance',
      '/dashboard/admin/finances',
      '/dashboard/admin/performance-reports',
      '/dashboard/admin/settings',
      '/dashboard/admin/user-management',
      '/dashboard/admin',
      '/dashboard/coach/profile',
      '/dashboard/coach/settings',
      '/dashboard/coach/credentials',
      '/dashboard/coordinator/about',
      '/dashboard/coordinator/attendance',
      '/dashboard/coordinator/finances',
      '/dashboard/coordinator/performance-reports',
      '/dashboard/coordinator/settings',
      '/dashboard/coordinator/user-management',
      '/dashboard/player/profile',
      '/dashboard/player/settings',
      '/dashboard/player/performance',
      '/dashboard/player/schedule',
      '/dashboard/player/training',
      '/dashboard/Owner/academy-management',
      '/dashboard/Owner/user-management',
      '/dashboard/Owner/consult',
    ])
  );

  const setPublicRoute = useCallback((isPublic: boolean) => {
    setIsPublicRoute(isPublic);
  }, []);

  const addSkippedRoute = useCallback((route: string) => {
    setSkippedRoutes(prev => new Set([...prev, route]));
  }, []);

  const removeSkippedRoute = useCallback((route: string) => {
    setSkippedRoutes(prev => {
      const newSet = new Set(prev);
      newSet.delete(route);
      return newSet;
    });
  }, []);

  const isRouteSkipped = useCallback((route: string) => {
    return skippedRoutes.has(route) || Array.from(skippedRoutes).some(skippedRoute => 
      route.startsWith(skippedRoute)
    );
  }, [skippedRoutes]);

  const shouldSkipFetching = useCallback(() => {
    const currentPath = window.location.pathname;
    
    // Skip if explicitly set as public route
    if (isPublicRoute) return true;
    
    // Skip if current path is in skipped routes
    if (isRouteSkipped(currentPath)) return true;
    
    // Skip if no user or academyId
    if (!user?.academyId) return true;
    
    return false;
  }, [user?.academyId, isPublicRoute, isRouteSkipped]);

  const fetchBatches = useCallback(async () => {
    if (shouldSkipFetching()) {
      console.log('Skipping batch fetch - route excluded or no user');
      return;
    }

    try {
      console.log('Fetching batches from API in BatchContext...');
      const response = await fetch(`/api/db/ams-batches?academyId=${encodeURIComponent(user!.academyId)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch batches');
      }
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        console.log('Fetched batches in BatchContext:', result.data);
        setBatches(result.data);
      } else {
        console.error('Invalid batch data format in BatchContext:', result);
        setBatches([]);
      }
    } catch (error) {
      console.error('Error fetching batches in BatchContext:', error);
      setBatches([]);
    }
  }, [user?.academyId, shouldSkipFetching]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const value: BatchContextType = {
    batches,
    setBatches,
    setPublicRoute,
    addSkippedRoute,
    removeSkippedRoute,
    isRouteSkipped,
  };

  return (
    <BatchContext.Provider value={value}>
      {children}
    </BatchContext.Provider>
  );
};

export const useBatches = () => {
  const context = useContext(BatchContext);
  if (!context) {
    throw new Error("useBatches must be used within a BatchProvider");
  }
  return context;
};