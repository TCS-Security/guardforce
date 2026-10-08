# Eagle demo — runbook

**Demo: today, 14:30, Eagle Security Agency office, Langford Gardens.**
Everything below is live on the deployed site against the cloud project. Plan: `eagle-demo-plan.md`.

## Logins

Dashboard — https://guardforce-chirags-projects-388b236c.vercel.app

| Who | Email | Password |
|---|---|---|
| Tharun (Owner, all sites) | `owner@eagle-demo.test` | `eagle-demo` |
| Ops manager (all sites) | `ops@eagle-demo.test` | `eagle-demo` |
| Field Officer East (scoped) | `fo.east@eagle-demo.test` | `eagle-demo` |
| Field Officer Mumbai (scoped) | `fo.mumbai@eagle-demo.test` | `eagle-demo` |

Guard phone — **+91 90000 00001**, OTP **123456**, PIN: set it to 1234 in the room.
The guard is **Ravi Shankar, Head Guard, Eagle HQ**, deliberately unclaimed so the first-run
flow is what gets shown. His shift today is scheduled and **not started**, so the app opens on
*Start shift*.

## The ten-minute run

| # | Beat | Where | The line |
|---|---|---|---|
| 1 | Your morning at 7am | `/` | 25 sites, 94 on duty, who isn't. No phone calls |
| 2 | The Verint no-show | `/attendance` | Post unmanned from 06:00, reliever in at 06:40, already a deduction |
| 3 | The sites you can't drive to | `/live` | Zoom out: Jigani, Dobaspet, Tumakuru, Mumbai |
| 4 | Last night | `/events`, `/patrols` | Metropolis 02:00 round missed with GPS evidence; Nysha guard found asleep on the 02:40 check |
| 5 | The jewellers | `/tasks`, `/incidents` | Two-person strong-room opening on record; bikers circling Bhima, with a photo |
| 6 | The guard phone | emulator | OTP → PIN → check in at this office → round → incident. Appears on the dashboard in seconds |
| 7 | Compliance | `/guards` | Arms licence 12 days from lapsing; 9 joiners blocked on police verification |
| 8 | Roster and leave | `/roster`, `/leave` | The Orion weekend clash |
| 9 | Money | `/payroll` | 2026 Karnataka rates. Every guard now above the ESI ceiling and into professional tax |
| 10 | Client proof | `/client-reports` | Diageo's monthly pack, the Consulate's daily report |

Avoid `/campus`, `/visitors`, `/gate-passes`, `/property`, `/inspections` unless asked — their
sample content is generic rather than Eagle's.

## Refreshing the data

The story is relative to the clock. To re-run (takes ~20 s, wipes and rebuilds the tenant only):

```
cd /home/chirag/TCS && set -a; . ./.env; set +a
python3 /tmp/runsql.py supabase/demo/eagle.sql
```

Do it **30–60 minutes before**, not during. It resets the guard phone to unclaimed, so if the
app is already signed in when you re-run, clear it: `adb shell pm clear com.guardforce.guard`.

## The phone

Emulator and Metro are already running, Metro pointed at the cloud project. If the app needs
relaunching:

```
export ANDROID_HOME=/home/chirag/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
adb reverse tcp:8081 tcp:8081
adb emu geo fix 77.60257 12.95998          # Langford Gardens, inside the HQ fence
adb shell am start -a android.intent.action.VIEW \
  -d "guardforce://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
```

Permissions are pre-granted, so no system dialogs. If the Expo dev-menu sheet appears over the
app, close it with the X at the top right of the sheet.

**Tap the OTP and PIN pads slowly** — one key at a time. React Native drops presses that arrive
faster than about two seconds on those pads, and a dropped digit looks like the app ignoring you.

## If something breaks

| Problem | Do this |
|---|---|
| Phone OTP fails | Fall back to supervisor mode: *Sign in with email* on the app, `fo.east@eagle-demo.test` |
| App will not load | Screenshots of every beat are in `/tmp/shot-demo-*.png` |
| Check-in refused | The device must be inside the HQ fence — re-run the `geo fix` above |
| Data looks stale | Re-run the script (above) |

## Known rough edges

- **"Present today 0"** on the overview sits next to "94 on duty". Attendance finalises at
  check-out, so nobody is *proved* present until their shift ends. If asked: present is what we
  have proved, not what we have assumed.
- Four coordinates are street or area centres rather than the actual gate: CKC, Bhima Jayanagar,
  LAPP and Eagle HQ. Fine at normal zoom, slightly off if you zoom right in.
- Mumbai (Asahi Kasei, Brother Powai) is **inferred** from Eagle's logo wall. Ask rather than
  assert that they guard those premises.
- Orion Uptown and the Holiday Inn inside it are grouped under Brigade on the assumption it is
  one relationship. Question 3 in the plan checks that.
