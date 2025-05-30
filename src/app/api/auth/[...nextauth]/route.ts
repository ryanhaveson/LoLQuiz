// Import NextAuth core and authentication providers
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { SessionStrategy } from "next-auth";

// Initialize Prisma client for database access
const prisma = new PrismaClient();

// Export NextAuth options for use in getServerSession
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
  },
  secret: process.env.NEXTAUTH_SECRET, // Secret for signing tokens
  callbacks: {
    // Add isAdmin to the JWT
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    // Add isAdmin to the session
    async session({ session, token }) {
      if (session.user) {
        session.user.isAdmin = token.isAdmin;
      }
      return session;
    },
  },
};

// Use the exported options in the NextAuth handler
const handler = NextAuth(authOptions);

// Export the handler for GET and POST requests
export { handler as GET, handler as POST }; 