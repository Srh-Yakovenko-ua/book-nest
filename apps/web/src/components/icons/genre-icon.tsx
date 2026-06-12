import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

export type GenreIconName =
  | "antyutopiia"
  | "avtobiohrafiia"
  | "biohrafiia"
  | "biznes"
  | "cozy-fantasy"
  | "detektyv"
  | "drama"
  | "dukhovnist"
  | "dytiacha-literatura"
  | "ekonomika"
  | "epichne-fentezi"
  | "eseistyka"
  | "fentezi"
  | "fentezi-romantyka"
  | "filosofiia"
  | "finansy"
  | "horor"
  | "hotychnyy-roman"
  | "hrafichnyy-roman"
  | "humor"
  | "inshe"
  | "istoriia"
  | "istorychna-romantyka"
  | "istorychnyy-roman"
  | "it"
  | "kazky"
  | "khobi"
  | "kiberpank"
  | "klasychna-literatura"
  | "klasychnyy-detektyv"
  | "komiksy"
  | "kryminalnyy-roman"
  | "kulinariia"
  | "kultura"
  | "manga"
  | "marketynh"
  | "medytsyna"
  | "memuary"
  | "menedzhment"
  | "miske-fentezi"
  | "mistychnyy-tryler"
  | "mistyka"
  | "movy"
  | "mystetstvo"
  | "naukova-fantastyka"
  | "navchalna-literatura"
  | "new-adult"
  | "non-fikshn"
  | "osvita"
  | "paranormalna-romantyka"
  | "paranormalne"
  | "pidlitkova-literatura"
  | "pidruchnyk"
  | "piesa"
  | "podorozhi"
  | "poeziia"
  | "politseyskyy-detektyv"
  | "polityka"
  | "populiarna-nauka"
  | "postapokalipsys"
  | "pravo"
  | "profesiyna-literatura"
  | "prohramuvannia"
  | "pryhody"
  | "psykholohichna-proza"
  | "psykholohichnyy-detektyv"
  | "psykholohichnyy-tryler"
  | "psykholohiia"
  | "publitsystyka"
  | "relihiia"
  | "reportazhystyka"
  | "roman"
  | "romantychna-komediia"
  | "romantyka"
  | "samorozvytok"
  | "saspens"
  | "satyra"
  | "shpyhunskyy-tryler"
  | "simeyna-saha"
  | "sotsialna-proza"
  | "sotsiolohiia"
  | "sport"
  | "stympank"
  | "suchasna-proza"
  | "suchasna-romantyka"
  | "temne-fentezi"
  | "tryler"
  | "young-adult"
  | "zdorovia";

type GenreIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: GenreIconName;
  size?: number;
  title?: string;
};

export function GenreIcon({ className, name, size = 20, title, ...props }: GenreIconProps) {
  const labelled = title !== undefined || props["aria-label"] !== undefined;

  return (
    <svg
      aria-hidden={labelled ? undefined : true}
      className={cn("shrink-0", className)}
      fill="none"
      height={size}
      role={labelled ? "img" : undefined}
      width={size}
      {...props}
    >
      {title === undefined ? null : <title>{title}</title>}
      <use href={`/icons/genre-icons.svg#genre-${name}`} />
    </svg>
  );
}
