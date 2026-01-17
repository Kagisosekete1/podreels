import { motion } from "framer-motion";
import { Eye, Bell, Settings } from "lucide-react";

export const Header = () => {
  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Eye className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-gradient">SciWatch</span>
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-accent/20 text-accent uppercase tracking-wider">
              AI
            </span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {["Discover", "Topics", "Saved", "Insights"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </button>
            <button className="ml-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              Sign In
            </button>
          </div>
        </div>
      </div>
    </motion.header>
  );
};
