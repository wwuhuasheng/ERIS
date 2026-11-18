import { authClient } from "./persistence";
import { scenarioSchema, type Scenario } from "./scenario";
import { importScene, exportScene } from "./scene-exchange";

export type CreatorTemplate = { id: string; title: string; scenario: Scenario; opening: string; updatedAt: string };

async function ownerId(): Promise<string> {
  const { data: { user }, error } = await authClient().auth.getUser();
  if (error || !user || user.is_anonymous || user.app_metadata?.eris_account_type !== "creator") throw new Error("请先登录创作者账号。");
  return user.id;
}

export async function listCreatorTemplates(): Promise<CreatorTemplate[]> {
  const owner = await ownerId();
  const { data, error } = await authClient().from("creator_templates")
    .select("id,title,scene_json,opening,updated_at").eq("owner_id", owner).order("updated_at", { ascending: false }).limit(50);
  if (error) throw new Error("无法读取模板库，请确认已应用创作者模板数据库迁移。" + (error.code ? `（${error.code}）` : ""));
  return (data || []).flatMap((row) => {
    const parsed = scenarioSchema.safeParse(row.scene_json);
    return parsed.success ? [{ id: row.id, title: row.title, scenario: parsed.data, opening: row.opening, updatedAt: row.updated_at }] : [];
  });
}

export async function saveCreatorTemplate(scenario: Scenario, opening: string, id?: string): Promise<void> {
  const owner = await ownerId();
  const safe = importScene(exportScene(scenario));
  const trimmedOpening = opening.trim();
  if (trimmedOpening.length > 1000) throw new Error("开场白不能超过 1000 字。");
  const db = authClient();
  if (id) {
    const { data, error } = await db.from("creator_templates")
      .update({ title: safe.title, scene_json: safe, opening: trimmedOpening, updated_at: new Date().toISOString() })
      .eq("id", id).eq("owner_id", owner).select("id").single();
    if (error || !data) throw new Error("更新模板失败，请重试。");
  } else {
    const { count, error: countError } = await db.from("creator_templates").select("id", { count: "exact", head: true }).eq("owner_id", owner);
    if (countError) throw new Error("无法确认模板数量，请重试。");
    if ((count || 0) >= 50) throw new Error("每个账号最多保存 50 个模板。");
    const { error } = await db.from("creator_templates").insert({ owner_id: owner, title: safe.title, scene_json: safe, opening: trimmedOpening });
    if (error) throw new Error("保存模板失败，请确认数据库迁移已应用。");
  }
}

export async function deleteCreatorTemplate(id: string): Promise<void> {
  const owner = await ownerId();
  const { data, error } = await authClient().from("creator_templates").delete().eq("id", id).eq("owner_id", owner).select("id").single();
  if (error || !data) throw new Error("删除模板失败，请重试。");
}
