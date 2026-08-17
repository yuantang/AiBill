import type { NextAuthConfig } from "next-auth";

async function sendLoginLink(email: string, url: string) {
  const from = process.env.EMAIL_FROM ?? "AI Bill <noreply@localhost>";
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Open this AI Bill",
        text: `Sign in with this link. It lasts 24 hours:\n\n${url}\n`,
      }),
    });
    if (!res.ok) throw new Error("Could not send the sign-in email");
    return;
  }
  console.log(`[aibill] sign-in link ${email}\n${url}`);
}

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [
    {
      id: "email",
      name: "Email",
      type: "email",
      maxAge: 24 * 60 * 60,
      sendVerificationRequest: async ({ identifier, url }) => {
        await sendLoginLink(identifier, url);
      },
    },
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = String(token.id);
      return session;
    },
  },
} satisfies NextAuthConfig;
