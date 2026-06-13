import type { ReactNode } from "react";

type AuthHeadingProps = {
  subtitle?: ReactNode;
  title: ReactNode;
};

export function AuthHeading({ subtitle, title }: AuthHeadingProps) {
  return (
    <div>
      <h1 className="font-heading text-[clamp(1.65rem,3vw,2.3rem)] leading-tight font-semibold text-ink">
        {title}
      </h1>
      {subtitle === undefined ? null : (
        <p className="mt-2 mb-[22px] text-[0.96rem] leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  );
}
