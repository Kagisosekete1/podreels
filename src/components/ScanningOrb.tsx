import { motion } from "framer-motion";

export const ScanningOrb = () => {
  return (
    <div className="relative w-64 h-64 md:w-80 md:h-80">
      {/* Outer glow rings */}
      <motion.div
        className="absolute inset-0 rounded-full border border-primary/20"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-4 rounded-full border border-primary/30"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.2, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.div
        className="absolute inset-8 rounded-full border border-primary/40"
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.3, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* Core orb */}
      <motion.div
        className="absolute inset-12 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 backdrop-blur-sm"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      >
        {/* Inner glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-primary/10 to-primary/30" />
        
        {/* Scan line */}
        <motion.div
          className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
          style={{ top: "50%" }}
          animate={{ 
            top: ["0%", "100%", "0%"],
            opacity: [0, 1, 0]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Center dot */}
      <motion.div
        className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-primary glow-primary"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Orbiting particles */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-accent"
          style={{
            top: "50%",
            left: "50%",
            marginTop: -4,
            marginLeft: -4,
          }}
          animate={{
            x: [0, Math.cos((i * 120 * Math.PI) / 180) * 100, 0],
            y: [0, Math.sin((i * 120 * Math.PI) / 180) * 100, 0],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};
