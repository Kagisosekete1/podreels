import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface CategoryCardProps {
  icon: LucideIcon;
  title: string;
  count: number;
  color: "primary" | "accent";
  delay?: number;
}

export const CategoryCard = ({
  icon: Icon,
  title,
  count,
  color,
  delay = 0,
}: CategoryCardProps) => {
  return (
    <motion.div
      className="glass rounded-xl p-5 cursor-pointer group hover:border-primary/50 transition-all duration-300"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.02 }}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
          color === "primary"
            ? "bg-primary/10 text-primary"
            : "bg-accent/10 text-accent"
        }`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">
        {count.toLocaleString()} papers
      </p>
    </motion.div>
  );
};
