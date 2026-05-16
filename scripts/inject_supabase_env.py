#!/usr/bin/env python3
"""
Safe env injector: reads SUPABASE_PASSWORD from server/.env and
writes the Supabase PostgreSQL connection strings.

Run from the project root:
  python3 scripts/inject_supabase_env.py

Two URLs are produced:
  DATABASE_URL  — transaction-mode pooler via PgBouncer (port 6543)
                  Used by the app at runtime. Efficient for many short-lived connections.
  DIRECT_URL    — direct Postgres connection (port 5432, no pooler)
                  Required by Prisma for schema migrations (db push / migrate).
                  Host format: db.[ref].supabase.co with user 'postgres'.
"""
import os

ENV_PATH = os.path.join(os.path.dirname(__file__), '..', 'server', '.env')


def read_env(path):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            key, _, val = line.partition('=')
            env[key.strip()] = val.strip().strip('"').strip("'")
    return env


def write_env(path, env_dict):
    """
    Update existing keys in-place and append any new keys at the end.
    Password is never printed.
    """
    with open(path) as f:
        existing = f.read().splitlines()

    lines = []
    written = set()

    for line in existing:
        if line.strip().startswith('#') or '=' not in line:
            lines.append(line)
            continue
        key = line.partition('=')[0].strip()
        if key in env_dict:
            lines.append(f'{key}="{env_dict[key]}"')
            written.add(key)
        else:
            lines.append(line)

    # Append new keys not already present
    for key, val in env_dict.items():
        if key not in written:
            lines.append(f'{key}="{val}"')

    with open(path, 'w') as f:
        f.write('\n'.join(lines) + '\n')


def main():
    env = read_env(ENV_PATH)
    password = env.get('SUPABASE_PASSWORD', '')
    project_ref = (
        os.environ.get('SUPABASE_PROJECT_REF', '').strip()
        or env.get('SUPABASE_PROJECT_REF', '').strip()
    )
    pooler_host = (
        os.environ.get('SUPABASE_POOLER_HOST', '').strip()
        or env.get('SUPABASE_POOLER_HOST', '').strip()
        or (f'aws-0-eu-central-1.pooler.supabase.com' if project_ref else '')
    )
    direct_host = f'db.{project_ref}.supabase.co' if project_ref else ''

    if not project_ref or project_ref.startswith('['):
        print('ERROR: SUPABASE_PROJECT_REF is missing.')
        print('Set it in server/.env or export SUPABASE_PROJECT_REF before running.')
        return

    if not password:
        print('ERROR: SUPABASE_PASSWORD is missing or empty in server/.env')
        print('Please add:  SUPABASE_PASSWORD="your-supabase-db-password"')
        print('Then run this script again.')
        return

    # URL-encode the password so special characters (@ # ! $ etc.) don't break the URI
    from urllib.parse import quote_plus
    encoded_pw = quote_plus(password)

    # Pooled (transaction mode) — runtime queries
    pooled = (
        f'postgresql://postgres.{project_ref}:{encoded_pw}'
        f'@{pooler_host}:6543/postgres?pgbouncer=true'
    )

    # Direct — used only by Prisma CLI for schema migrations
    # User is 'postgres' (no project suffix), host is db.[ref].supabase.co
    direct = (
        f'postgresql://postgres:{encoded_pw}'
        f'@{direct_host}:5432/postgres'
    )

    updates = {
        'DATABASE_URL':    pooled,
        'DIRECT_URL':      direct,
        'OPENROUTER_MODEL': env.get('OPENROUTER_MODEL', 'deepseek/deepseek-v4-flash:free'),
    }

    write_env(ENV_PATH, updates)

    # Safe summary — password is never shown
    print('✅ server/.env updated with Supabase connection strings.')
    print(f'   DATABASE_URL  → pooler (port 6543) via PgBouncer')
    print(f'   DIRECT_URL    → direct  (port 5432) to {direct_host}')
    print()
    print('Next steps:')
    print('  cd server')
    print('  npx prisma generate')
    print('  npx prisma db push')


if __name__ == '__main__':
    main()
