import { motion } from "framer-motion";
import { TrendingUp, FileText, Users, Zap } from "lucide-react";

const stats = [
  { icon: FileText, label: "Papers Today", value: "2,847" },
  { icon: TrendingUp, label: "Trending Topics", value: "156" },
  { icon: Users, label: "Researchers", value: "12.4K" },
  { icon: Zap, label: "AI Insights", value: "892" },
];

export const StatsBar = () => {
  return (
    <motion.div
      className="glass rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 p-2"
        >
          <div className="p-2 rounded-lg bg-primary/10">
            <stat.icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
};
