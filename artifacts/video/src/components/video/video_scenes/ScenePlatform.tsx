import { motion } from 'framer-motion';

export const ScenePlatform = () => {
  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--color-bg-dark)]"
      initial={{ clipPath: "inset(100% 0 0 0)" }}
      animate={{ clipPath: "inset(0% 0 0 0)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Background Elements */}
      <motion.div 
        className="absolute right-0 top-0 w-1/2 h-full bg-[var(--color-primary)] opacity-10"
        initial={{ x: "100%" }}
        animate={{ x: "0%" }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: "right" }}
      />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-16 px-12 w-full max-w-6xl">
        
        <div className="flex-1 flex justify-center relative h-[400px] w-full">
          {/* Abstract Web UI */}
          <motion.div
            initial={{ opacity: 0, x: -50, rotateY: 20, z: -100 }}
            animate={{ opacity: 1, x: 0, rotateY: 10, z: 0 }}
            transition={{ duration: 1.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-10 w-80 h-56 bg-white rounded-xl shadow-2xl overflow-hidden border border-white/20 p-4 transform perspective-1000"
          >
            <div className="w-full flex justify-between items-center mb-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="h-2 w-16 bg-gray-200 rounded-full" />
            </div>
            <div className="flex gap-4 h-full">
              <div className="w-16 h-full bg-gray-100 rounded-md" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="w-full h-20 bg-[var(--color-primary)] rounded-md opacity-80" />
                <div className="flex gap-2">
                  <div className="flex-1 h-12 bg-gray-100 rounded-md" />
                  <div className="flex-1 h-12 bg-gray-100 rounded-md" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Abstract Mobile UI */}
          <motion.div
            initial={{ opacity: 0, x: 50, y: 50, rotateY: -20, z: 100 }}
            animate={{ opacity: 1, x: 20, y: 30, rotateY: -10, z: 50 }}
            transition={{ duration: 1.5, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-10 top-0 w-48 h-80 bg-white rounded-[2rem] shadow-2xl border-4 border-gray-800 p-3 transform perspective-1000"
          >
            <div className="w-full h-full border border-gray-100 rounded-2xl flex flex-col p-3">
              <div className="w-1/2 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <div className="w-full h-24 bg-[var(--color-primary)] rounded-xl mb-3 opacity-90" />
              <div className="w-full h-10 bg-gray-100 rounded-lg mb-2" />
              <div className="w-full h-10 bg-gray-100 rounded-lg mb-2" />
              <div className="w-full h-10 bg-gray-100 rounded-lg" />
            </div>
          </motion.div>
        </div>

        <div className="flex-1 text-left">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-6xl font-display font-medium text-white mb-4 leading-tight"
          >
            Web <span className="text-white/50">&</span> Mobile
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-2xl font-body text-white/70"
          >
            Your home's command center.<br />
            Anytime, anywhere.
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
};
