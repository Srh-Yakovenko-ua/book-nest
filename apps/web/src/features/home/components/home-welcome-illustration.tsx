import Image from "next/image";

const WELCOME_ILLUSTRATION = {
  height: 440,
  src: "/illustrations/home/home-welcome-bookshelf.png",
  width: 880,
} as const;

export function HomeWelcomeIllustration() {
  return (
    <Image
      alt=""
      aria-hidden
      className="pointer-events-none hidden h-auto w-66 object-contain select-none @5xl/home:block @6xl/home:w-72"
      height={WELCOME_ILLUSTRATION.height}
      src={WELCOME_ILLUSTRATION.src}
      unoptimized
      width={WELCOME_ILLUSTRATION.width}
    />
  );
}
