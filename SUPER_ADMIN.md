# Super Admin Management Guide

This document explains how the admin system works in StudyBuddy and how to manage super admins.

## How the Admin System Works

### Role Storage
Admin roles are stored in the `user_roles` table in the database. This table uses Row Level Security (RLS) policies to ensure only existing admins can manage roles.

**Table Structure:**
```sql
public.user_roles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL,  -- 'admin' or 'user'
  created_at TIMESTAMP
)
```

### How Admin Access is Checked
When a user logs in, the app checks their role by querying the `user_roles` table:
1. If they have a record with `role = 'admin'`, they see the Admin nav link
2. The Admin panel at `/admin` is only accessible to admins
3. All admin actions (managing subscriptions, quotas, trials) use RLS policies that verify admin status

---

## Adding a New Super Admin

### Option A: Via SQL (Recommended)

1. **Find the user's ID** by their email:
```sql
-- Run this query to find the user ID
SELECT id, email 
FROM auth.users 
WHERE email = 'their-email@example.com';
```

2. **Add them as admin:**
```sql
-- Replace 'user-uuid-here' with the actual UUID from step 1
INSERT INTO public.user_roles (user_id, role)
VALUES ('user-uuid-here', 'admin');
```

### Option B: Via Admin Panel (UI)

1. Log in as an existing admin
2. Go to **Admin > Users**
3. Find the user in the table
4. Click the **Manage** button
5. Select **Make Admin** from the dropdown

---

## Removing Admin Access

### Via SQL:
```sql
DELETE FROM public.user_roles 
WHERE user_id = 'user-uuid-here' 
AND role = 'admin';
```

### Via Admin Panel:
1. Go to **Admin > Users**
2. Find the admin user
3. Click **Manage > Remove Admin**

---

## Current Super Admins

To see all current admins, run:
```sql
SELECT ur.user_id, p.email, ur.role, ur.created_at
FROM public.user_roles ur
JOIN public.profiles p ON ur.user_id = p.user_id
WHERE ur.role = 'admin';
```

---

## Admin Capabilities

Super admins can:

| Feature | Description |
|---------|-------------|
| **Grant Pro Access** | Give users unlimited courses/topics without payment |
| **Extend Trials** | Add extra days to user trial periods |
| **Set Custom Quotas** | Override plan limits for specific users |
| **Manage Roles** | Promote/demote other admins |
| **Disable Accounts** | Block users from accessing the app |
| **Edit Plans** | Modify plan pricing and limits |

---

## Security Notes

1. **Never store roles in localStorage or client-side** - Roles are always verified server-side via RLS policies
2. **RLS policies protect admin actions** - Only users with admin role can modify sensitive data
3. **The first admin must be added via SQL** - After that, admins can promote others via UI

---

## Troubleshooting

### "I can't see the Admin link"
- Make sure you've logged out and back in after being added as admin
- Verify your user_id is correctly in the user_roles table

### "Admin actions fail with permission error"
- Check that your user_roles record has `role = 'admin'` (not 'user')
- Ensure RLS policies are enabled on the tables

### "I'm the only admin and locked myself out"
- Use the Supabase SQL editor or database client to re-add your admin role:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('your-user-id', 'admin')
ON CONFLICT DO NOTHING;
```
