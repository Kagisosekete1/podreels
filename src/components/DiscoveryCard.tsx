import { motion } from "framer-motion";
import { Clock, ArrowUpRight, Bookmark } from "lucide-react";

interface DiscoveryCardProps {
  title: string;
  summary: string;
  category: string;
  timeAgo: string;
  isHot?: boolean;
  delay?: number;
}

export const DiscoveryCard = ({
  title,
  summary,
  category,
  timeAgo,
  isHot,
  delay = 0,
}: DiscoveryCardProps) => {
  return (
    <motion.article
      className="glass rounded-xl p-6 cursor-pointer group hover:border-primary/50 transition-all duration-300"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      whileHover={{ x: 4 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 text-xs rounded-md bg-secondary text-secondary-foreground">
              {category}
            </span>
            {isHot && (
              <span className="px-2 py-1 text-xs rounded-md bg-accent/20 text-accent font-medium">
                🔥 Trending
              </span>
            )}
          </div>
          <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {summary}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeAgo}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
            <Bookmark className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="p-2 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.article>
  );
};
