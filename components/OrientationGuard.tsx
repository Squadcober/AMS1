"use client"

import { useState, useEffect } from "react";
import { Smartphone } from "lucide-react";

export function OrientationGuard({ children }: { children: React.ReactNode }) {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [orientationLocked, setOrientationLocked] = useState(false);

  useEffect(() => {
    const lockToLandscape = async () => {
      if ('screen' in window && 'orientation' in window.screen) {
        try {
          // Try to lock to landscape orientation
          await (window.screen.orientation as any).lock('landscape');
          setOrientationLocked(true);
        } catch (error) {
          // Lock failed, fall back to prompting user
          console.log('Could not lock orientation:', error);
          setOrientationLocked(false);
        }
      }
    };

    const checkOrientation = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);

      if (mobile) {
        const portrait = window.innerHeight > window.innerWidth;
        setIsPortrait(portrait);

        // If not already locked and we're in portrait, try to lock to landscape
        if (!orientationLocked && portrait) {
          lockToLandscape();
        }
      } else {
        setIsPortrait(false);
      }
    };

    // Initial check and attempt to lock orientation
    checkOrientation();
    if (window.innerWidth < 1024) {
      lockToLandscape();
    }

    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, [orientationLocked]);

  if (isMobile && isPortrait) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50 p-8">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <Smartphone className="w-24 h-24 text-cyan-500 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Please Rotate Your Device
          </h2>
          <p className="text-gray-400 mb-6">
            This page is best viewed in landscape orientation
          </p>
          <div className="inline-block border-4 border-cyan-500 rounded-lg p-4 animate-bounce">
            <svg className="w-16 h-16 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
