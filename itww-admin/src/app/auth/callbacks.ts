// // packages/auth/core/callbacks.ts

// import type { JWT } from "next-auth/jwt";
// import type { Session } from "next-auth";

// export function createCallbacks(maxIdleTime: number) {
//   return {
//     async jwt({ token, user }: { token: JWT; user?: any }) {
//       if (user) {
//         token.userId = user.id;
//         token.email = user.email;

//         token.isPlatformAdmin = user.isPlatformAdmin ?? user.is_platform_admin;
//         // token.storeRoles = user.storeRoles;
//         token.storeRoles = user.storeRoles?.map((role: any) => ({
//           store_id: role.store_id,
//           role: role.role,
//           slug: role.slug, // Map the slug here
//         }));

//       }

//       token.lastActiveAt = (token.lastActiveAt as number) || Date.now();
//       return token;
//     },

//     async session({ session, token }: { session: Session; token: JWT }) {
//       const now = Date.now();
//       const lastActive = (token.lastActiveAt as number) || now;
//       const expired = now - lastActive > maxIdleTime;

//       if (session.user) {
//         session.user.id = token.userId as string;
//         session.user.email = token.email as string;
//         session.user.isPlatformAdmin = !!token.isPlatformAdmin;
//         session.user.storeRoles = (token.storeRoles as any[]) || [];
//       }

//       session.expired = Boolean(expired);
//       return session;
//     },
//   };
// }
