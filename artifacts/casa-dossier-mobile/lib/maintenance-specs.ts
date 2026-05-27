export type MaintenanceSpec = {
  title: string;
  description: string;
  intervalDays: number;
  isDiy: boolean;
  priority: "low" | "medium" | "high";
  estimatedMinutes?: number;
  steps?: string[];
  toolsNeeded?: string[];
  safetyNotes?: string;
};

export const MAINTENANCE_SPECS: Record<string, MaintenanceSpec[]> = {
  HVAC: [
    {
      title: "Replace air filter",
      description: "Replace your HVAC air filter to keep air quality high and the system running efficiently. A clogged filter makes the motor work harder and can cut equipment life in half.",
      intervalDays: 30,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 10,
      steps: [
        "Turn off the thermostat",
        "Locate the filter slot — usually on the return air duct or air handler",
        "Note the arrow on the old filter (shows airflow direction)",
        "Slide out old filter; note its size (e.g. 16x25x1)",
        "Insert new filter with arrow pointing toward the unit",
        "Restore power and check that airflow is strong at vents",
      ],
      toolsNeeded: ["Replacement filter (match exact size)"],
    },
    {
      title: "Clean condensate drain line",
      description: "Pour distilled white vinegar into the AC condensate drain pan to clear algae and prevent water backup — a common cause of ceiling leaks and high humidity.",
      intervalDays: 90,
      isDiy: true,
      priority: "medium",
      estimatedMinutes: 15,
      steps: [
        "Locate the condensate drain line (PVC pipe near air handler, usually exits outside)",
        "Find the cleanout access port (cap near air handler)",
        "Pour ¼ cup distilled white vinegar into the line",
        "Wait 30 minutes, then flush with water",
        "Check that water flows freely from the outdoor exit point",
      ],
      toolsNeeded: ["Distilled white vinegar", "Funnel"],
    },
    {
      title: "Annual HVAC tune-up",
      description: "A certified HVAC technician should inspect the system once per year — checking refrigerant, coils, blower, thermostat calibration, and all electrical connections.",
      intervalDays: 365,
      isDiy: false,
      priority: "high",
      estimatedMinutes: 90,
    },
  ],
  Plumbing: [
    {
      title: "Flush water heater",
      description: "Sediment buildup at the bottom of the tank reduces heating efficiency and accelerates corrosion. An annual flush adds years of life to the unit.",
      intervalDays: 365,
      isDiy: true,
      priority: "medium",
      estimatedMinutes: 30,
      steps: [
        "Turn the thermostat to 'Vacation' or 'Pilot' mode (gas) / flip the breaker (electric)",
        "Connect a garden hose to the drain valve at the bottom of the tank",
        "Turn off the cold water supply inlet",
        "Open a hot water faucet in the house to prevent vacuum",
        "Open the drain valve and let the tank drain fully",
        "Close the drain valve, remove the hose, restore cold water, and turn the heater back on",
      ],
      toolsNeeded: ["Garden hose", "Flat-head screwdriver or hose adapter"],
      safetyNotes: "Water will be very hot — wear gloves and drain slowly.",
    },
    {
      title: "Test pressure relief valve",
      description: "The T&P relief valve is a critical safety device. If it fails to open, the water heater can rupture. Testing once a year ensures it's not stuck.",
      intervalDays: 365,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 10,
      steps: [
        "Locate the T&P relief valve (on the side of the tank with a pipe going down)",
        "Place a bucket under the discharge pipe",
        "Briefly lift the lever — hot water should flow out and stop when released",
        "If no water flows, or if it leaks after the test, replace the valve",
      ],
      toolsNeeded: ["Bucket"],
      safetyNotes: "The discharge water is scalding hot. Do not lift the lever with your hand directly under the pipe.",
    },
    {
      title: "Inspect supply lines & shut-offs",
      description: "Braided stainless supply lines and angle stop valves are the most common source of sudden water damage. Checking them takes 5 minutes.",
      intervalDays: 180,
      isDiy: true,
      priority: "medium",
      estimatedMinutes: 15,
      steps: [
        "Check all under-sink supply lines (kitchen, bathrooms, laundry)",
        "Look for bulging, corrosion, or moisture around fittings",
        "Try turning each angle stop valve — if it won't move, replace it",
        "Replace any supply line older than 7–10 years as preventive maintenance",
      ],
      toolsNeeded: ["Flashlight"],
    },
  ],
  Electrical: [
    {
      title: "Test GFCI outlets",
      description: "GFCI outlets prevent electrocution in wet areas. They can fail silently — the test button ensures they'll actually trip in an emergency.",
      intervalDays: 30,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 10,
      steps: [
        "Locate all GFCI outlets: bathrooms, kitchen counters, garage, exterior, laundry",
        "Plug in a night light or phone charger to verify the outlet is live",
        "Press the 'TEST' button — the outlet should go dead immediately",
        "Press 'RESET' — power should be restored",
        "If the outlet doesn't trip, or won't reset, replace the GFCI outlet",
      ],
    },
    {
      title: "Test smoke & CO detectors",
      description: "Smoke detectors older than 10 years and CO detectors older than 7 years should be replaced regardless of whether they pass the test.",
      intervalDays: 180,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 20,
      steps: [
        "Press and hold the test button on each detector until it sounds",
        "Check the date on the back — smoke detectors expire after 10 years",
        "Replace 9V batteries (or use a 10-year sealed battery detector)",
        "Vacuum the detector grills to remove dust that can cause false alarms",
      ],
      toolsNeeded: ["9V replacement batteries"],
    },
  ],
  Roof: [
    {
      title: "Clean gutters",
      description: "Clogged gutters cause water to overflow and pool against the foundation, rot fascia boards, and create ice dams in cold climates. Clean twice a year.",
      intervalDays: 180,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 60,
      steps: [
        "Use a sturdy ladder with stand-off arms to avoid leaning on the gutter",
        "Scoop leaves and debris out by hand or with a gutter scoop, working toward a downspout",
        "Flush the gutter with a garden hose toward the downspout",
        "Check downspout flow — use a hose at the top and watch for full-flow at the bottom",
      ],
      toolsNeeded: ["Ladder", "Gutter scoop or gloves", "Garden hose"],
      safetyNotes: "Never lean a ladder against the gutter itself. Work with a helper whenever using a ladder.",
    },
    {
      title: "Inspect shingles & flashing",
      description: "Catching damaged shingles and flashing early prevents expensive deck rot and interior water damage.",
      intervalDays: 365,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 30,
      steps: [
        "From the ground: use binoculars to look for curling, missing, cracked, or bald shingles",
        "From the attic: look for daylight, water stains, or wet insulation",
        "Inspect chimney, vent pipe, and skylight flashings for rust, gaps, or caulk failure",
      ],
      toolsNeeded: ["Binoculars", "Flashlight (for attic)"],
    },
  ],
  Appliance: [
    {
      title: "Clean refrigerator condenser coils",
      description: "Dirty coils make the compressor run constantly, shortening its life and raising your electric bill.",
      intervalDays: 180,
      isDiy: true,
      priority: "medium",
      estimatedMinutes: 20,
      steps: [
        "Unplug the refrigerator",
        "Remove the kick plate at the bottom front",
        "Vacuum coils using the brush attachment — work gently to avoid bending them",
        "Replace the kick plate and plug back in",
      ],
      toolsNeeded: ["Vacuum with brush attachment", "Refrigerator coil brush"],
    },
    {
      title: "Clean dryer exhaust vent",
      description: "A clogged dryer vent is the #1 cause of house fires from appliances. Clean the full exhaust duct once a year.",
      intervalDays: 365,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 45,
      steps: [
        "Pull the dryer away from the wall and disconnect the duct at the back",
        "Vacuum the duct opening on the dryer and the wall",
        "Use a dryer vent cleaning kit (long flexible brush) to clean the full duct",
        "Go outside and remove the vent cover; brush from outside in",
        "Reconnect the duct and run a test cycle",
      ],
      toolsNeeded: ["Dryer vent cleaning kit", "Vacuum"],
      safetyNotes: "Never use plastic flex duct — it can collapse and sag, trapping lint.",
    },
    {
      title: "Inspect washing machine hoses",
      description: "Rubber washing machine hoses burst without warning and can flood a home. Check and replace every 5 years.",
      intervalDays: 365,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 15,
      steps: [
        "Pull the washer out to access the back",
        "Inspect hot and cold water supply hoses for bulging, cracks, or corrosion at fittings",
        "Feel for soft spots or blisters in the rubber",
        "Replace any hose older than 5 years or showing wear",
      ],
      toolsNeeded: ["Flashlight"],
    },
  ],
  Structural: [
    {
      title: "Inspect foundation & crawl space",
      description: "Small foundation cracks caught early are a minor repair. Left unchecked, water intrusion causes structural damage, mold, and expensive remediation.",
      intervalDays: 365,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 30,
      steps: [
        "Walk the perimeter of the foundation after a heavy rain",
        "Look for new cracks wider than 1/8\" or any horizontal cracks (serious warning sign)",
        "Check for efflorescence (white mineral deposits) indicating water movement",
        "In the crawl space: look for standing water, wet insulation, or wood rot",
      ],
      toolsNeeded: ["Flashlight", "Tape measure or crack gauge"],
    },
    {
      title: "Caulk windows & exterior doors",
      description: "Failed caulk around windows and doors is one of the most common paths for air and water infiltration.",
      intervalDays: 365,
      isDiy: true,
      priority: "medium",
      estimatedMinutes: 60,
      steps: [
        "Inspect all exterior window and door frames for cracked, shrinking, or missing caulk",
        "Use a utility knife to remove all old caulk",
        "Clean the surface and let it dry completely",
        "Apply a bead of paintable exterior caulk and tool it with a wet finger",
      ],
      toolsNeeded: ["Caulk gun", "Exterior paintable caulk", "Utility knife"],
    },
  ],
  Other: [
    {
      title: "Test garage door auto-reverse",
      description: "Test the safety reverse feature monthly — a door that fails to reverse can seriously injure a person or pet.",
      intervalDays: 30,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 5,
      steps: [
        "Place a 2×4 board flat on the ground under the center of the door",
        "Close the door with the remote or wall button",
        "The door should reverse automatically when it contacts the board",
        "If it does not reverse, adjust the 'Close Force' limit on the motor unit",
      ],
    },
    {
      title: "Check exterior grading",
      description: "The ground around your home should slope away at 6 inches per 10 feet. Improper grading sends rainwater toward the foundation.",
      intervalDays: 365,
      isDiy: true,
      priority: "high",
      estimatedMinutes: 20,
      steps: [
        "After a heavy rain, observe where water pools around your home",
        "Check that flower beds, mulch, and soil slope away from the foundation",
        "Add topsoil if needed to build up the grade near the house",
        "Ensure downspout extensions discharge at least 6 feet from the foundation",
      ],
      toolsNeeded: ["Topsoil (if needed)", "Landscape rake"],
    },
  ],
};

export function getSpecsForCategory(category: string): MaintenanceSpec[] {
  return MAINTENANCE_SPECS[category] ?? MAINTENANCE_SPECS["Other"] ?? [];
}
