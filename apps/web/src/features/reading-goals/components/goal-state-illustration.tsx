import Image from "next/image";

import { cn } from "@/lib/utils";

const GOAL_STATE_ILLUSTRATION = {
  completed: {
    className: "w-24 sm:w-28 lg:w-32",
    height: 128,
    src: "/illustrations/reading-goals/goal-completed-trophy-books.png",
    width: 128,
  },
  expired: {
    className: "w-24 sm:w-28 lg:w-32",
    height: 117,
    src: "/illustrations/reading-goals/goal-expired-hourglass.png",
    width: 128,
  },
  forecastInsufficient: {
    className: "w-24",
    height: 96,
    src: "/illustrations/reading-goals/goal-forecast-insufficient-data.png",
    width: 96,
  },
} as const satisfies Record<
  string,
  { className: string; height: number; src: string; width: number }
>;

export type GoalStateIllustrationName = keyof typeof GOAL_STATE_ILLUSTRATION;

type GoalStateIllustrationProps = {
  name: GoalStateIllustrationName;
};

export function GoalStateIllustration({ name }: GoalStateIllustrationProps) {
  const art = GOAL_STATE_ILLUSTRATION[name];

  return (
    <Image
      alt=""
      className={cn(
        "pointer-events-none h-auto shrink-0 object-contain select-none",
        art.className,
      )}
      height={art.height}
      src={art.src}
      width={art.width}
    />
  );
}
