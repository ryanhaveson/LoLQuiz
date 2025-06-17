// Import NextAuth core and authentication providers
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { DefaultSession, SessionStrategy } from "next-auth";
import type { JWT } from "next-auth/jwt";

// Initialize Prisma client for database access
const prisma = new PrismaClient();

// Export NextAuth options for use in getServerSession
/**
 * This extends the built-in session types with the isAdmin property
 * Note: This means that isAdmin is included in both
 * the JWT token and the session that's sent to client
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"]
  }
  
  interface User {
    isAdmin?: boolean;
  }
}

// Extend the JWT to include isAdmin property
declare module "next-auth/jwt" {
  interface JWT {
    isAdmin?: boolean;
  }
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Google OAuth provider configuration
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account", // Always show account picker
          access_type: "offline",   // Request refresh token
          response_type: "code"     // Use authorization code flow
        }
      }
    }),
    // Credentials provider for email/password login
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Validate credentials are provided
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        // Find user by email in the database
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        });

        // If user not found or no password, fail
        if (!user || !user?.password) {
          throw new Error("Invalid credentials");
        }

        // Compare provided password with hashed password in DB
        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        // If password does not match, fail
        if (!isCorrectPassword) {
          throw new Error("Invalid credentials");
        }

        // If all checks pass, return user object
        return user;
      }
    })
  ],
  // Custom sign-in page route
  pages: {
    signIn: '/',
  },
  debug: process.env.NODE_ENV === 'development',
  session: {
    strategy: 'jwt' as SessionStrategy,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // Session configuration
  secret: process.env.NEXTAUTH_SECRET, // Secret for signing tokens
  callbacks: {
    // Add isAdmin to the JWT
    async jwt({ token, user }) {
      // Only set these properties during initial sign-in when we have the user object
      if (user) {
        // Ensure user properties are added to token
        token.isAdmin = Boolean(user.isAdmin);
        token.id = user.id;
      }
      return token;
    },
    // Add isAdmin to the session
    async session({ session, token }) {
      // Make sure user exists on session
      if (session.user) {
        // Ensure token properties are added to session user
        session.user.id = token.sub as string;
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      
      return session;
    },
  },
};

// Use the exported options in the NextAuth handler
const handler = NextAuth(authOptions);

// Export the handler for GET and POST requests
export { handler as GET, handler as POST }; 