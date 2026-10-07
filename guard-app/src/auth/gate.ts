/** Where a session in this state must be; screens outside the gate set are only reachable when ready. */
export function landingRoute(stage: string, permissionsDone: boolean, hasSelfie: boolean, mustUpdate: boolean, blocked: string | null): string | null {
  switch (stage) {
    case "signed_out": return "/phone";
    case "needs_claim": return "/claim";
    case "needs_pin": return "/set-pin";
    case "locked": return "/lock";
    case "staff": return "/supervisor";
    case "ready": return mustUpdate ? "/update" : blocked ? "/blocked" : !permissionsDone ? "/permissions" : !hasSelfie ? "/reg-selfie" : null;
    default: return null;
  }
}

