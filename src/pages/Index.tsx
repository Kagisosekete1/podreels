import { motion } from "framer-motion";
import { Atom, Brain, Dna, Microscope, Rocket, Cpu } from "lucide-react";
import { Header } from "@/components/Header";
import { ScanningOrb } from "@/components/ScanningOrb";
import { SearchBar } from "@/components/SearchBar";
import { CategoryCard } from "@/components/CategoryCard";
import { DiscoveryCard } from "@/components/DiscoveryCard";
import { StatsBar } from "@/components/StatsBar";

const categories = [
  { icon: Atom, title: "Physics", count: 24567, color: "primary" as const },
  { icon: Dna, title: "Biology", count: 31245, color: "accent" as const },
  { icon: Brain, title: "Neuroscience", count: 18934, color: "primary" as const },
  { icon: Cpu, title: "AI & ML", count: 42156, color: "accent" as const },
  { icon: Microscope, title: "Chemistry", count: 21789, color: "primary" as const },
  { icon: Rocket, title: "Astronomy", count: 15432, color: "accent" as const },
];

const discoveries = [
  {
    title: "Breakthrough in Quantum Error Correction Achieves 99.9% Fidelity",
    summary: "Researchers at MIT demonstrate a new quantum error correction protocol that significantly reduces decoherence in superconducting qubits.",
    category: "Quantum Physics",
    timeAgo: "2 hours ago",
    isHot: true,
  },
  {
    title: "Novel CRISPR Variant Shows Promise for Treating Inherited Diseases",
    summary: "A modified CRISPR-Cas12 system demonstrates enhanced precision in targeting genetic mutations with minimal off-target effects.",
    category: "Genetics",
    timeAgo: "4 hours ago",
    isHot: true,
  },
  {
    title: "AI Model Predicts Protein Structures with Atomic Precision",
    summary: "New deep learning architecture achieves unprecedented accuracy in predicting protein folding patterns.",
    category: "AI & Biology",
    timeAgo: "6 hours ago",
    isHot: false,
  },
  {
    title: "James Webb Telescope Discovers New Exoplanet with Earth-like Atmosphere",
    summary: "Spectroscopic analysis reveals presence of water vapor and potential biosignatures in distant planetary system.",
    category: "Astronomy",
    timeAgo: "8 hours ago",
    isHot: false,
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Background grid pattern */}
      <div
        className="fixed inset-0 bg-grid-pattern bg-[size:50px_50px] opacity-30 pointer-events-none"
        style={{
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />

      <Header />

      <main className="relative pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left content */}
            <motion.div
              className="flex-1 text-center lg:text-left"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm text-muted-foreground">
                  Monitoring 2.8M+ papers in real-time
                </span>
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Your AI-Powered{" "}
                <span className="text-gradient">Scientific</span>{" "}
                Observatory
              </h1>

              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
                Stay ahead of scientific breakthroughs. Our AI continuously scans, 
                analyzes, and summarizes the latest research across all disciplines.
              </p>

              <SearchBar />
            </motion.div>

            {/* Right visual */}
            <motion.div
              className="flex-shrink-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <ScanningOrb />
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="container mx-auto px-4 py-8">
          <StatsBar />
        </section>

        {/* Categories Section */}
        <section className="container mx-auto px-4 py-12">
          <motion.div
            className="flex items-center justify-between mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-2xl font-bold text-foreground">
              Explore Topics
            </h2>
            <a
              href="#"
              className="text-sm text-primary hover:underline"
            >
              View all →
            </a>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat, index) => (
              <CategoryCard
                key={cat.title}
                icon={cat.icon}
                title={cat.title}
                count={cat.count}
                color={cat.color}
                delay={0.5 + index * 0.1}
              />
            ))}
          </div>
        </section>

        {/* Latest Discoveries Section */}
        <section className="container mx-auto px-4 py-12">
          <motion.div
            className="flex items-center justify-between mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">
                Latest Discoveries
              </h2>
              <p className="text-sm text-muted-foreground">
                AI-curated breakthroughs from the past 24 hours
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground">
                All
              </button>
              <button className="px-4 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                Trending
              </button>
              <button className="px-4 py-2 text-sm rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                For You
              </button>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            {discoveries.map((discovery, index) => (
              <DiscoveryCard
                key={discovery.title}
                {...discovery}
                delay={0.7 + index * 0.1}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 SciWatch AI. Monitoring the future of science.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
