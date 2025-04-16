#!/usr/bin/env tsx
import { createUser } from '../packages/lib/server-only/user/create-user';
import { prisma } from '../packages/prisma';
import { Role } from '../packages/prisma/client';

// Parse command line arguments
const args = process.argv.slice(2);
const email = args[0];
const name = args[1];
const password = args[2];

if (!email || !name || !password) {
  console.error('Usage: npx tsx create-user.ts <email> <name> <password>');
  process.exit(1);
}

async function main() {
  try {
    console.log(`Creating user with email: ${email}`);

    // Create the user
    const user = await createUser({
      name,
      email,
      password,
    });

    // Add ADMIN role
    await prisma.user.update({
      where: { id: user.id },
      data: {
        roles: [Role.ADMIN, Role.USER],
        emailVerified: new Date(),
      },
    });

    console.log(`User created successfully with ID: ${user.id}`);
    console.log('User details:', JSON.stringify(user, null, 2));
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
