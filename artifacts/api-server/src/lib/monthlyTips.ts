import { sendBroadcastPush } from "./pushNotifications.js";
import { logger } from "./logger.js";

const MONTHLY_TIPS: string[] = [
  "January: Check weather-stripping on doors and windows to keep cold air out and cut heating bills.",
  "February: Test smoke and carbon monoxide detectors — replace batteries if needed.",
  "March: Clean gutters after winter to prevent water damage as spring rains arrive.",
  "April: Inspect your roof for cracked or missing shingles after winter storms.",
  "May: Service your HVAC before summer — replace the filter and schedule a tune-up.",
  "June: Check outdoor faucets and hoses for leaks before peak watering season.",
  "July: Inspect window and door screens for tears that let bugs in.",
  "August: Flush your water heater to remove sediment and extend its life.",
  "September: Seal gaps around pipes and cables to stop pests from entering as temps cool.",
  "October: Drain outdoor faucets and store hoses before the first freeze.",
  "November: Have your fireplace and chimney inspected before heating season.",
  "December: Insulate exposed pipes in unheated areas to prevent freezing.",
];

export async function sendMonthlyTips(): Promise<void> {
  const monthIndex = new Date().getMonth(); // 0 = January
  const tip = MONTHLY_TIPS[monthIndex]!;

  const count = await sendBroadcastPush({
    title: "🏠 Monthly Home Tip",
    body: tip,
    data: { screen: "tips" },
  });

  logger.info({ month: monthIndex + 1, recipients: count }, "Monthly home tip sent");
}
