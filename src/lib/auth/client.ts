"use client";

import { createAuthClient } from "better-auth/react";

// The same-origin /api/auth route is the only browser auth transport.
export const authClient = createAuthClient();
