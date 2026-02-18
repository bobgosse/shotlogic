# Beta Tester Management

## Overview
ShotLogic supports giving free credits to beta testers and colleagues via environment variables or admin API calls.

## Setup Beta Testers via Environment Variable

**In Railway, add these environment variables:**

```
BETA_TESTER_EMAILS=colleague1@example.com,colleague2@example.com,filmmaker@school.edu
BETA_TESTER_INITIAL_CREDITS=50
```

- **BETA_TESTER_EMAILS**: Comma-separated list of emails (matches their Clerk user ID)
- **BETA_TESTER_INITIAL_CREDITS**: How many free scenes they get when they first sign up (default: 50)

**How it works:**
1. When a user with a beta tester email signs up, they automatically get the initial free credits
2. They show up as "Beta Tester" in the database (isTester: true)
3. When they run out, you can grant them more via the admin API

## Grant Additional Credits to Any User

Use the admin API to grant credits to anyone (beta tester or regular user):

### Get User's Current Balance
```bash
curl "https://www.shotlogic.studio/api/admin/manage-credits?action=balance&userId=user_xyz123" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

### Grant Free Credits
```bash
curl -X POST "https://www.shotlogic.studio/api/admin/manage-credits" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -d '{
    "action": "grant",
    "userId": "user_xyz123",
    "credits": 100,
    "reason": "Beta tester - additional free trial"
  }'
```

### Find a User's Clerk ID

1. Have them sign in to ShotLogic
2. Look in Railway logs for their userId when they make an API call
3. Or check the MongoDB `users` collection directly

## Admin Permissions

**Admins (unlimited credits forever):**
- Bob Gosse (bobgosse@gmail.com)
- Set via `ADMIN_USER_ID` environment variable

**Beta Testers (initial free credits, renewable):**
- Set via `BETA_TESTER_EMAILS` environment variable
- You can grant them more credits anytime via admin API

**Regular Users (pay-per-scene):**
- Purchase credits via Stripe
- 4 credit packs: 50, 150, 500, 1500 scenes

## Example Workflow

**Colleague asks to try ShotLogic:**

1. Add their email to `BETA_TESTER_EMAILS` in Railway:
   ```
   BETA_TESTER_EMAILS=existing@example.com,newcolleague@film.edu
   ```

2. They sign up → automatically get 50 free credits

3. When they run out, grant more:
   ```bash
   curl -X POST https://www.shotlogic.studio/api/admin/manage-credits \
     -H "Content-Type: application/json" \
     -d '{
       "action": "grant",
       "userId": "newcolleague@film.edu",
       "credits": 50,
       "reason": "Extended beta access"
     }'
   ```

## Notes

- Beta tester status is determined by **email match** (case-insensitive)
- Initial credits are only granted **once** when the user first signs up
- You can manually grant credits to anyone at any time via the admin API
- Admins never consume credits (always bypassed)
