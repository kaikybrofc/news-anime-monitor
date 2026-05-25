import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";

export function PageKicker({ children, icon = faWandMagicSparkles, className = "", as: Tag = "span" }) {
  const resolvedClassName = ["page-kicker", className].filter(Boolean).join(" ");

  return (
    <Tag className={resolvedClassName}>
      <FontAwesomeIcon icon={icon} className="mr-1.5 text-[0.72em] opacity-80" />
      {children}
    </Tag>
  );
}
