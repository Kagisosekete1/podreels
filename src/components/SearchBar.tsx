import { Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export const SearchBar = () => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      className={`relative w-full max-w-2xl mx-auto transition-all duration-300 ${
        isFocused ? "scale-[1.02]" : ""
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div
        className={`glass rounded-2xl p-1 gradient-border transition-all duration-300 ${
          isFocused ? "glow-primary" : ""
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search scientific papers, topics, or ask a question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
            <Sparkles className="w-4 h-4" />
            <span>AI Search</span>
          </button>
        </div>
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {["Quantum Computing", "CRISPR", "Dark Matter", "Neural Networks"].map(
          (tag) => (
            <button
              key={tag}
              className="px-3 py-1.5 text-xs rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              {tag}
            </button>
          )
        )}
      </div>
    </motion.div>
  );
};
