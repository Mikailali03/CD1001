import { motion } from 'framer-motion';

export const SceneFeatures = () => {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-bg-light)]"
      initial={{ y: "100%" }}
      animate={{ y: "0%" }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute inset-0 bg-cover bg-center opacity-5"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/clean-interior.png)` }}
        />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-12 h-full flex items-center justify-center">
        
        {/* 1. Health Score */}
        <FeatureBlock 
          delay={0}
          duration={5}
          title="Home Health Score"
          subtitle="Know exactly where you stand."
          visual={
            <div className="relative w-64 h-64 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(61, 122, 95, 0.2)" strokeWidth="8" />
                <motion.circle 
                  cx="50" cy="50" r="45" fill="none" stroke="#3d7a5f" strokeWidth="8"
                  strokeDasharray="283"
                  initial={{ strokeDashoffset: 283 }}
                  animate={{ strokeDashoffset: 283 - (283 * 0.92) }}
                  transition={{ duration: 1.5, delay: 0.8, ease: "easeOut" }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <motion.span 
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 1.2, type: "spring" }}
                  className="text-7xl font-display font-bold text-[var(--color-primary)] leading-none"
                >
                  A-
                </motion.span>
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 1.5 }}
                  className="text-xl font-body font-medium text-[var(--color-text-secondary)] mt-1"
                >
                  92 / 100
                </motion.span>
              </div>
            </div>
          }
        />

        {/* 2. Asset Tracking */}
        <FeatureBlock 
          delay={5}
          duration={5}
          title="Asset Tracking"
          subtitle="Catalog every system, appliance, and fixture."
          visual={
            <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
              {[1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 5.5 + (i * 0.1), ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-[var(--color-bg-muted)] flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-lg bg-[var(--color-bg-muted)] flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] opacity-50" />
                  </div>
                  <div>
                    <div className="h-3 w-16 bg-[var(--color-text-primary)] rounded-full mb-2 opacity-80" />
                    <div className="h-2 w-12 bg-[var(--color-text-muted)] rounded-full opacity-60" />
                  </div>
                </motion.div>
              ))}
            </div>
          }
        />

        {/* 3. Maintenance Inbox */}
        <FeatureBlock 
          delay={10}
          duration={5}
          title="Maintenance Inbox"
          subtitle="Automated alerts. Nothing slips through."
          visual={
            <div className="flex flex-col gap-3 w-full max-w-md">
              {[
                { title: "Flush water heater", status: "Overdue", color: "var(--color-error)" },
                { title: "Replace HVAC filter", status: "Today", color: "var(--color-warning)" },
                { title: "Clean gutters", status: "Upcoming", color: "var(--color-success)" }
              ].map((task, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 10.5 + (i * 0.15), type: "spring", stiffness: 300, damping: 25 }}
                  className="bg-white p-5 rounded-2xl shadow-md border border-[var(--color-bg-muted)] flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: task.color }} />
                    <span className="font-body font-medium text-[var(--color-text-primary)]">{task.title}</span>
                  </div>
                  <span className="text-sm font-medium" style={{ color: task.color }}>{task.status}</span>
                </motion.div>
              ))}
            </div>
          }
        />

        {/* 4. Capital Outlook */}
        <FeatureBlock 
          delay={15}
          duration={5}
          title="Capital Outlook"
          subtitle="Project future replacement costs. No surprises."
          visual={
            <div className="w-full max-w-xl bg-white p-6 rounded-3xl shadow-lg border border-[var(--color-bg-muted)]">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <p className="text-sm text-[var(--color-text-muted)] font-medium mb-1">Estimated 5-Year Cost</p>
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 15.6 }}
                    className="text-4xl font-display font-semibold text-[var(--color-text-primary)]"
                  >
                    $12,450
                  </motion.p>
                </div>
              </div>
              <div className="flex items-end h-32 gap-2">
                {[40, 70, 30, 90, 50].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col justify-end group">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 1, delay: 15.8 + (i * 0.1), ease: [0.16, 1, 0.3, 1] }}
                      className="w-full bg-[var(--color-primary)] rounded-t-sm opacity-80"
                    />
                    <div className="text-center mt-2 text-xs text-[var(--color-text-muted)]">202{4+i}</div>
                  </div>
                ))}
              </div>
            </div>
          }
        />
      </div>
    </motion.div>
  );
};

const FeatureBlock = ({ title, subtitle, visual, delay, duration }: any) => {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col md:flex-row items-center justify-center gap-12 md:gap-24 px-12"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: [0, 1, 1, 0],
        scale: [0.95, 1, 1, 1.05],
        filter: ["blur(10px)", "blur(0px)", "blur(0px)", "blur(10px)"]
      }}
      transition={{ 
        duration: duration, 
        delay: delay,
        times: [0, 0.15, 0.85, 1], 
        ease: [0.16, 1, 0.3, 1] 
      }}
    >
      <div className="w-full md:w-1/2 flex justify-center md:justify-end order-2 md:order-1">
        {visual}
      </div>
      <div className="w-full md:w-1/2 text-center md:text-left order-1 md:order-2">
        <motion.h3 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -20] }}
          transition={{ duration: duration, delay: delay, times: [0, 0.15, 0.85, 1] }}
          className="text-4xl md:text-6xl font-display font-medium text-[var(--color-text-primary)] mb-4 leading-tight"
        >
          {title}
        </motion.h3>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -20] }}
          transition={{ duration: duration, delay: delay + 0.1, times: [0, 0.15, 0.85, 1] }}
          className="text-xl md:text-2xl font-body text-[var(--color-text-secondary)]"
        >
          {subtitle}
        </motion.p>
      </div>
    </motion.div>
  );
};
