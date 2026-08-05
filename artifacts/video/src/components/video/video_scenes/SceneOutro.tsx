import { motion } from 'framer-motion';

export const SceneOutro = () => {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-primary)]"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
    >
      {/* Background elegant gradient/blur */}
      <motion.div 
        className="absolute w-[80vw] h-[80vw] rounded-full bg-[#2c3a32] opacity-50 blur-[100px]"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.5 }}
        transition={{ duration: 4, ease: "easeOut" }}
      />

      <div className="relative z-10 text-center flex flex-col items-center">
        {/* Logo/Icon reveal */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.5, type: "spring", stiffness: 100, damping: 20 }}
          className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-2xl"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 10L12 3L21 10V21H3V10Z" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinelinejoin="round"/>
            <path d="M9 21V12H15V21" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinelinejoin="round"/>
          </svg>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.5, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-6xl md:text-8xl font-display font-semibold text-white tracking-tight mb-6"
        >
          Casa Dossier
        </motion.h1>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <p className="text-2xl md:text-3xl font-body font-medium text-[#e9e5d9] tracking-wide">
            Your home, <span className="text-[#d4a373] italic">fully managed.</span>
          </p>
        </motion.div>

        {/* Small decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 2, ease: [0.16, 1, 0.3, 1] }}
          className="w-16 h-1 bg-[#d4a373] mt-8 rounded-full"
        />
      </div>
    </motion.div>
  );
};
