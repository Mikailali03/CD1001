import { motion } from 'framer-motion';

export const SceneSolution = () => {
  return (
    <motion.div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      initial={{ clipPath: "circle(0% at center)" }}
      animate={{ clipPath: "circle(150% at center)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[var(--color-primary)] opacity-100" />
      
      {/* Abstract floating shapes for depth */}
      <motion.div 
        className="absolute w-[60vw] h-[60vw] rounded-full mix-blend-screen opacity-20 bg-[#4b5e73] blur-[80px]"
        initial={{ x: "-20%", y: "20%" }}
        animate={{ x: "20%", y: "-10%" }}
        transition={{ duration: 8, ease: "linear" }}
      />
      <motion.div 
        className="absolute w-[40vw] h-[40vw] rounded-full mix-blend-screen opacity-10 bg-[#d4a373] blur-[60px]"
        initial={{ x: "60%", y: "-20%" }}
        animate={{ x: "-10%", y: "40%" }}
        transition={{ duration: 8, ease: "linear" }}
      />

      <div className="relative z-30 flex flex-col items-center justify-center text-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: [0, 1, 1, 0], y: [50, 0, -10, -50], scale: [0.9, 1, 1, 0.95] }}
          transition={{ duration: 4, times: [0, 0.2, 0.8, 1], ease: [0.16, 1, 0.3, 1] }}
          className="absolute"
        >
          <div className="flex items-center gap-4 mb-4 justify-center">
            {/* Minimalist icon */}
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 10L12 3L21 10V21H3V10Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"/>
                <path d="M9 21V12H15V21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"/>
              </svg>
            </div>
            <p className="text-xl font-body font-medium text-white/80 tracking-widest uppercase">INTRODUCING</p>
          </div>
          <h1 className="text-6xl md:text-8xl font-display font-medium text-white tracking-tight">
            Casa Dossier
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
          animate={{ opacity: [0, 0, 1, 1], scale: [1.1, 1.1, 1, 1], filter: ["blur(20px)", "blur(20px)", "blur(0px)", "blur(0px)"] }}
          transition={{ duration: 8, times: [0, 0.45, 0.6, 1], ease: [0.16, 1, 0.3, 1] }}
          className="absolute w-full"
        >
          <h2 className="text-5xl md:text-7xl font-display font-medium text-white leading-tight">
            One place for <br />
            <span className="text-[#d4a373] italic">everything</span> about your home.
          </h2>
        </motion.div>
      </div>
    </motion.div>
  );
};
