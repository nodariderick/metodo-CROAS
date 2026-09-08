import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
}

const callbackURL = (() => {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}/api/auth/google/callback`;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) return `https://${devDomain}/api/auth/google/callback`;
  return "http://localhost:5000/api/auth/google/callback";
})();

logger.info({ callbackURL }, "Google OAuth callback URL");

// ─── Google OAuth Strategy ───────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value ?? "";
        const name = profile.displayName ?? email;
        const avatarUrl = profile.photos?.[0]?.value ?? null;

        // Upsert user by googleId
        const existing = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.googleId, googleId))
          .limit(1);

        if (existing.length > 0) {
          if (!existing[0].isActive) {
            return done(null, false, { message: "Account is deactivated" });
          }
          const [updated] = await db
            .update(usersTable)
            .set({ lastLoginAt: new Date(), avatarUrl, name })
            .where(eq(usersTable.googleId, googleId))
            .returning();
          return done(null, updated);
        }

        // Check if user exists by email (pre-seeded user)
        const byEmail = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email))
          .limit(1);

        if (byEmail.length > 0) {
          if (!byEmail[0].isActive) {
            return done(null, false, { message: "Account is deactivated" });
          }
          const [updated] = await db
            .update(usersTable)
            .set({ googleId, lastLoginAt: new Date(), avatarUrl, name })
            .where(eq(usersTable.email, email))
            .returning();
          return done(null, updated);
        }

        // CROAS is invitation-only: an active user must exist before Google
        // OAuth can link the account. Never auto-provision unknown identities.
        return done(null, false, { message: "Account is not authorized" });
      } catch (err) {
        return done(err as Error);
      }
    },
  ),
);

// ─── Local (email + password) Strategy ──────────────────────────────────────
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.email, email.toLowerCase().trim()))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "E-mail ou senha incorretos" });
        }
        if (!user.isActive) {
          return done(null, false, { message: "Conta desativada" });
        }
        if (!user.passwordHash) {
          return done(null, false, { message: "Esta conta usa login com Google" });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return done(null, false, { message: "E-mail ou senha incorretos" });
        }

        const [updated] = await db
          .update(usersTable)
          .set({ lastLoginAt: new Date() })
          .where(eq(usersTable.id, user.id))
          .returning();

        return done(null, updated);
      } catch (err) {
        return done(err as Error);
      }
    },
  ),
);

// ─── Session serialization ───────────────────────────────────────────────────
passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: number }).id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    // Reject deactivated users at deserialization — revokes access immediately
    if (!user || !user.isActive) {
      return done(null, false);
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
