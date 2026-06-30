import { forwardRef, type ReactNode } from "react";

type AuthHeadingProps = {
  subtitle?: ReactNode;
  tabIndex?: number;
  title: ReactNode;
};

export const AuthHeading = forwardRef<HTMLHeadingElement, AuthHeadingProps>(function AuthHeading(
  { subtitle, tabIndex, title },
  ref,
) {
  return (
    <div>
      <h1
        className="font-heading text-[clamp(1.65rem,3vw,2.3rem)] leading-tight font-semibold text-ink outline-none"
        ref={ref}
        tabIndex={tabIndex}
      >
        {title}
      </h1>
      {subtitle === undefined ? null : (
        <p className="mt-2 mb-6 text-base leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
});
