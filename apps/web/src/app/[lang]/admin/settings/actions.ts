"use server";

import { refresh, updateTag } from "next/cache";
import type { IntegrationDto, IntegrationTestDto, LibrarySettingsDto, UpdateSettingsInput } from "@mybook/shared";
import { post, run } from "@/lib/action-result";
import { api } from "@/lib/api";

/** Loan rules are shown on the member site (about page, book pages), so their cache refreshes too. */
export async function saveSettings(input: UpdateSettingsInput) {
  const result = await run(() => api<LibrarySettingsDto>("/admin/settings", post(input, "PATCH")));
  if (result.ok) {
    updateTag("rules");
    refresh();
  }
  return result;
}

export async function testIntegration(id: IntegrationDto["id"]) {
  return run(() => api<IntegrationTestDto>(`/admin/integrations/${id}/test`, post({})));
}
