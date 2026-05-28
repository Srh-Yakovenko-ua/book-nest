import { useEffect, useState } from "react";
import { useNavigation } from "react-router";

export function RouteProgress() {
  const navigation = useNavigation();
  if (navigation.state === "idle") return null;
  return <ProgressBar />;
}

function ProgressBar() {
  const [progress, setProgress] = useState(0.15);

  useEffect(() => {
    const rampTimer = window.setTimeout(() => setProgress(0.7), 80);
    const midTimer = window.setTimeout(() => setProgress(0.92), 600);
    return () => {
      window.clearTimeout(rampTimer);
      window.clearTimeout(midTimer);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]">
      <div
        className="relative h-full w-full origin-left overflow-hidden ease-out"
        style={{
          background: "var(--primary)",
          boxShadow: "0 0 12px 1px var(--primary), 0 0 4px 0 var(--primary)",
          transform: `scaleX(${progress})`,
          transitionDuration: "400ms",
          transitionProperty: "transform",
        }}
      >
        <div
          className="absolute inset-y-0 w-20 -skew-x-12"
          style={{
            animation: "progress-shimmer 1.2s ease-in-out infinite",
            background:
              "linear-gradient(90deg, transparent 0%, oklch(1 0 0 / 0.5) 50%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
}
