import crypto from "node:crypto";
import {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, passwordResetTokensTable, usersTable } from "@workspace/db";
import passport from "../lib/passport";
import { logActivity } from "../lib/activity";
import { isSmtpConfigured, sendPasswordResetEmail } from "../lib/mailer";
import { toPublicUser } from "../lib/public-user";

const router: IRouter = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Muitas tentativas. Tente novamente em 15 minutos.",
    });
  },
});

const googleAuthFailureRedirect = (code: string) =>
  `/login?error=${encodeURIComponent(code)}`;

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

function handleGoogleProviderError(req: Request, res: Response, next: NextFunction): void {
  const providerError = typeof req.query.error === "string" ? req.query.error : undefined;
  if (!providerError) {
    next();
    return;
  }
  const code = providerError === "access_denied" ? "google_access_denied" : "google_auth_failed";
  req.log.warn({ providerError }, "Google OAuth was not completed");
  res.redirect(googleAuthFailureRedirect(code));
}

router.get(
  "/auth/google/callback",
  handleGoogleProviderError,
  (req, res, next): void => {
    passport.authenticate(
      "google",
      (err: Error | null, user: Express.User | false, info: { message?: string } | undefined) => {
        if (err) {
          req.log.error({ err }, "Google OAuth callback failed");
          res.redirect(googleAuthFailureRedirect("google_auth_failed"));
          return;
        }
        if (!user) {
          const code =
            info?.message === "Account is deactivated"
              ? "account_deactivated"
              : info?.message === "Account is not authorized"
                ? "google_account_not_authorized"
              : "google_auth_failed";
          res.redirect(googleAuthFailureRedirect(code));
          return;
        }
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            next(loginErr);
            return;
          }
          next();
        });
      },
    )(req, res, next);
  },
  async (req, res, next): Promise<void> => {
    const user = req.user as { id: number; name: string } | undefined;
    if (!user) {
      res.redirect(googleAuthFailureRedirect("google_auth_failed"));
      return;
    }
    try {
      await logActivity({
        userId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.name,
      });
      res.redirect("/");
    } catch (err) {
      next(err);
    }
  },
);

const RegisterBody = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

router.post("/auth/register", authRateLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
    return;
  }
  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Este e-mail já está cadastrado" });
    return;
  }

  const [newUser] = await db
    .insert(usersTable)
    .values({
      name,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: "CLIENT",
      isActive: true,
      lastLoginAt: new Date(),
    })
    .returning();
  await logActivity({
    userId: newUser.id,
    action: "register",
    entityType: "user",
    entityId: newUser.id,
    entityLabel: newUser.name,
  });
  req.login(newUser, (err) => {
    if (err) {
      res.status(500).json({ error: "Erro ao criar sessão" });
      return;
    }
    res.status(201).json(toPublicUser(newUser));
  });
});

router.post("/auth/login", authRateLimiter, (req, res, next): void => {
  passport.authenticate(
    "local",
    async (
      err: Error | null,
      user: Express.User | false,
      info: { message: string } | undefined,
    ) => {
      if (err) {
        next(err);
        return;
      }
      if (!user) {
        res.status(401).json({ error: info?.message ?? "E-mail ou senha incorretos" });
        return;
      }
      req.login(user, async (loginErr) => {
        if (loginErr) {
          next(loginErr);
          return;
        }
        const currentUser = user as { id: number; name: string };
        await logActivity({
          userId: currentUser.id,
          action: "login",
          entityType: "user",
          entityId: currentUser.id,
          entityLabel: currentUser.name,
        });
        res.json(toPublicUser(user as Parameters<typeof toPublicUser>[0]));
      });
    },
  )(req, res, next);
});

const SetPasswordBody = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

router.patch("/auth/password", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = SetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;
  const userId = (req.user as { id: number }).id;
  const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!dbUser) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }
  if (dbUser.passwordHash) {
    if (!currentPassword) {
      res.status(400).json({ error: "Senha atual é obrigatória para alterar a senha" });
      return;
    }
    if (!(await bcrypt.compare(currentPassword, dbUser.passwordHash))) {
      res.status(401).json({ error: "Senha atual incorreta" });
      return;
    }
  }
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash: await bcrypt.hash(newPassword, 12) })
    .where(eq(usersTable.id, userId))
    .returning();
  await logActivity({
    userId: updated.id,
    action: "update",
    entityType: "user",
    entityId: updated.id,
    entityLabel: updated.name,
  });
  res.json(toPublicUser(updated));
});

const ForgotPasswordBody = z.object({
  email: z.string().email("E-mail inválido"),
});

function canonicalAppOrigin(): string | null {
  if (process.env.APP_BASE_URL) {
    try {
      const url = new URL(process.env.APP_BASE_URL);
      if (
        url.protocol === "https:" ||
        (process.env.NODE_ENV !== "production" && url.protocol === "http:")
      ) {
        return url.origin;
      }
    } catch {
      return null;
    }
    return null;
  }
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (replitDomain) return `https://${replitDomain}`;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  return devDomain ? `https://${devDomain}` : null;
}

router.post("/auth/forgot-password", authRateLimiter, async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
    return;
  }
  const origin = canonicalAppOrigin();
  if (!isSmtpConfigured() || !origin) {
    req.log.error("Password recovery email delivery is not configured");
    res.status(503).json({
      error: "Serviço de recuperação indisponível. Entre em contato com o suporte.",
    });
    return;
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();
  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    try {
      await sendPasswordResetEmail(
        user.email,
        user.name,
        `${origin}/login?reset_token=${encodeURIComponent(rawToken)}`,
      );
    } catch (err) {
      req.log.error({ err }, "Failed to send password reset email");
    }
  }
  res.json({
    message: "Se este e-mail estiver cadastrado, você receberá um link de redefinição.",
  });
});

const ResetPasswordBody = z.object({
  token: z.string().min(1, "Token inválido"),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});

router.post("/auth/reset-password", authRateLimiter, async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" });
    return;
  }
  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const newHash = await bcrypt.hash(parsed.data.password, 12);
  let claimedUserId: number | undefined;
  try {
    await db.transaction(async (tx) => {
      const now = new Date();
      const claimed = await tx
        .update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokensTable.tokenHash, tokenHash),
            isNull(passwordResetTokensTable.usedAt),
            gt(passwordResetTokensTable.expiresAt, now),
          ),
        )
        .returning({ userId: passwordResetTokensTable.userId });
      const userId = claimed[0]?.userId;
      if (claimed.length !== 1 || userId === undefined) {
        throw Object.assign(new Error("TOKEN_INVALID"), { isTokenInvalid: true });
      }
      claimedUserId = userId;
      await tx
        .update(usersTable)
        .set({ passwordHash: newHash })
        .where(eq(usersTable.id, userId));
    });
  } catch (err) {
    if ((err as { isTokenInvalid?: boolean }).isTokenInvalid) {
      res.status(400).json({ error: "Link de redefinição inválido ou expirado" });
      return;
    }
    throw err;
  }
  await logActivity({
    userId: claimedUserId!,
    action: "update",
    entityType: "user",
    entityId: claimedUserId!,
    entityLabel: "password reset",
  });
  res.json({ message: "Senha redefinida com sucesso" });
});

router.get("/auth/me", (req, res): void => {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(toPublicUser(req.user as Parameters<typeof toPublicUser>[0]));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const user = req.user as { id: number; name: string } | undefined;
  if (user) {
    await logActivity({
      userId: user.id,
      action: "logout",
      entityType: "user",
      entityId: user.id,
      entityLabel: user.name,
    });
  }
  req.logout((err) => {
    if (err) {
      req.log.error({ err }, "Error during logout");
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.json({ message: "Logged out successfully" });
  });
});

export default router;