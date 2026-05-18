import { prisma } from "./prisma";
import {
  DEFAULT_SETTINGS,
  type SettingsKey,
  type SettingsMap,
} from "./settings-defaults";

export async function getSetting<K extends SettingsKey>(
  key: K
): Promise<SettingsMap[K]> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return DEFAULT_SETTINGS[key];
  return row.value as SettingsMap[K];
}

export async function setSetting<K extends SettingsKey>(
  key: K,
  value: SettingsMap[K]
): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: value as object },
    create: { key, value: value as object },
  });
}

export async function getAllSettings(): Promise<SettingsMap> {
  const rows = await prisma.systemSetting.findMany();
  const result = { ...DEFAULT_SETTINGS } as SettingsMap;
  for (const row of rows) {
    if (row.key in result) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[row.key] = row.value;
    }
  }
  return result;
}
