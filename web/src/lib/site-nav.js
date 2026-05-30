import {
  faHouse,
  faNewspaper,
  faFire,
  faCalendarDays,
  faLayerGroup,
  faSatelliteDish,
  faCode,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";

export const siteNav = [
  { href: "/", label: "Home", icon: faHouse },
  { href: "/noticias", label: "Notícias", icon: faNewspaper },
  { href: "/tendencias", label: "Tendências", icon: faFire },
  { href: "/calendario", label: "Calendário", icon: faCalendarDays },
  { href: "/franquias", label: "Franquias", icon: faLayerGroup },
  { href: "/fontes", label: "Fontes", icon: faSatelliteDish },
  { href: "/api", label: "API", icon: faCode },
  { href: "/sobre", label: "Sobre", icon: faCircleInfo },
];
