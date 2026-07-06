import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nome: z.string().min(1),
  isAdmin: z.boolean().default(false),
  permissions: z
    .array(z.object({ resource: z.string(), action: z.string() }))
    .default([]),
});

async function ensureAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Apenas administradores.");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    // profile auto-created by trigger, ensure nome
    await supabaseAdmin.from("profiles").update({ nome: data.nome, email: data.email }).eq("id", uid);
    if (data.isAdmin) {
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
    }
    if (data.permissions.length > 0) {
      await supabaseAdmin.from("user_permissions").insert(
        data.permissions.map((p) => ({ user_id: uid, resource: p.resource as any, action: p.action as any }))
      );
    }
    return { id: uid };
  });

export const adminUpdatePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        isAdmin: z.boolean(),
        permissions: z.array(z.object({ resource: z.string(), action: z.string() })),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.isAdmin) {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: data.userId, role: "admin" },
        { onConflict: "user_id,role" }
      );
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    }
    await supabaseAdmin.from("user_permissions").delete().eq("user_id", data.userId);
    if (data.permissions.length > 0) {
      await supabaseAdmin.from("user_permissions").insert(
        data.permissions.map((p) => ({ user_id: data.userId, resource: p.resource as any, action: p.action as any }))
      );
    }
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), password: z.string().min(6) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), ativo: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as any);
    if (data.userId === (context as any).userId) throw new Error("Você não pode desativar a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ban by setting ban_duration
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.ativo ? "none" : "100000h",
    } as any);
    await supabaseAdmin.from("profiles").update({ ativo: data.ativo }).eq("id", data.userId);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context as any);
    if (data.userId === (context as any).userId) throw new Error("Você não pode excluir a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
