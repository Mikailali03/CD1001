import React from "react";
import { Stack } from "expo-router";
import { RoleGuard } from "@/components/tech/RoleGuard";

// Technician app. The guard lives here so every screen in the group —
// including deep links straight to /tech-job/<id> — requires the
// technician (or admin) role; anyone else is redirected to the homeowner app.
export default function TechLayout() {
  return (
    <RoleGuard app="tech">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tech-tabs)" />
        <Stack.Screen name="tech-job/[id]" options={{ animation: "slide_from_right" }} />
      </Stack>
    </RoleGuard>
  );
}
