import { motion } from 'framer-motion';

export const SceneProblem = () => {
  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-transparent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 w-full h-full">
        {/* Background images that cross-fade */}
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: [0, 0.6, 0.6, 0], scale: 1 }}
          transition={{ duration: 5, times: [0, 0.2, 0.8, 1], ease: "easeInOut" }}
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/home-exterior.png)` }}
        />
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: [0, 0, 0.5, 0.5, 0], scale: 1 }}
          transition={{ duration: 9, times: [0, 0.44, 0.55, 0.88, 1], ease: "easeInOut" }}
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/messy-papers.png)` }}
        />
      </div>

      {/* Dark overlay for text readability */}
      <motion.div 
        className="absolute inset-0 bg-[#2c3a32]"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: [0.8, 0.6, 0.85, 0.95] }}
        transition={{ duration: 12, times: [0, 0.4, 0.8, 1] }}
      />

      <div className="relative z-20 w-[80%] max-w-5xl mx-auto text-center">
        {/* Phrase 1 */}
        <motion.div
          className="absolute w-full top-1/2 -translate-y-1/2"
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: [0, 1, 1, 0], y: [30, 0, 0, -30], filter: ["blur(10px)", "blur(0px)", "blur(0px)", "blur(10px)"] }}
          transition={{ duration: 4.5, times: [0, 0.15, 0.85, 1], ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-display font-medium text-white leading-tight tracking-tight">
            Your home is your <br/>
            <span className="text-[#d4a373] italic">biggest investment.</span>
          </h2>
        </motion.div>

        {/* Phrase 2 */}
        <motion.div
          className="absolute w-full top-1/2 -translate-y-1/2"
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: [0, 0, 1, 1, 0], y: [30, 30, 0, 0, -30], filter: ["blur(10px)", "blur(10px)", "blur(0px)", "blur(0px)", "blur(10px)"] }}
          transition={{ duration: 8.5, times: [0, 0.47, 0.58, 0.88, 1], ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium text-white leading-tight tracking-tight">
            But managing it is a mess of <br/>
            <span className="opacity-70 text-[var(--color-text-muted)]">manuals, spreadsheets,</span> <br/>
            and forgotten maintenance.
          </h2>
        </motion.div>

        {/* Phrase 3 - The Breaking point */}
        <motion.div
          className="absolute w-full top-1/2 -translate-y-1/2"
          initial={{ opacity: 0, scale: 0.9, filter: "blur(20px)" }}
          animate={{ opacity: [0, 0, 1, 1], scale: [0.9, 0.9, 1, 1.05], filter: ["blur(20px)", "blur(20px)", "blur(0px)", "blur(0px)"] }}
          transition={{ duration: 12, times: [0, 0.7, 0.8, 1], ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-6xl md:text-7xl lg:text-8xl font-display font-semibold text-[#e57373] leading-tight tracking-tighter">
            Until something breaks.
          </h2>
        </motion.div>
      </div>
    </motion.div>
  );
};
