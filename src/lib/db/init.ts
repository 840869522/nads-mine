import { PrismaClient } from '@prisma/client';
import { defaultPermissions, defaultRoles, sampleQuestions, sampleImages, sampleCourseCases, sampleInstances } from './defaultData';
import fs from 'fs';
import { execSync } from 'child_process';

const dbPath = 'prisma/data.sqlite';

let prisma: PrismaClient | null = null;

export async function getPrisma() {
  if (!prisma) {
    ensureDatabase();
    prisma = new PrismaClient();
    await seedData(prisma);
  }
  return prisma;
}

function ensureDatabase() {
  if (!fs.existsSync('prisma')) fs.mkdirSync('prisma');
  if (!fs.existsSync(dbPath)) {
    // Run prisma db push to create tables
    execSync('npx prisma db push --schema=./prisma/schema.prisma --skip-generate', { stdio: 'inherit' });
  } else {
    execSync('npx prisma db push --schema=./prisma/schema.prisma --skip-generate', { stdio: 'inherit' });
  }
}

async function seedData(client: PrismaClient) {
  const permCount = await client.permission.count();
  if (permCount === 0) {
    await client.permission.createMany({ data: defaultPermissions });
  }

  const roleCount = await client.role.count();
  if (roleCount === 0) {
    for (const [key, value] of Object.entries(defaultRoles)) {
      await client.role.create({
        data: {
          id: `core_${key}`,
          name_key: key,
          name_display: value.name,
          description: `系统默认角色：${value.name}`,
          rolePermissions: {
            create: value.permissions.map(p => ({ permission_key: p }))
          }
        }
      });
    }
  }

  const userCount = await client.user.count();
  if (userCount === 0) {
    await client.user.create({
      data: {
        id: 'u_admin',
        username: 'admin',
        password_hash: 'admin123',
        email: 'admin@example.com',
        status: 'active',
        role_id: 'core_admin',
        created_at: new Date()
      }
    });
    await client.user.create({
      data: {
        id: 'u_student',
        username: 'student',
        password_hash: 'student123',
        email: 'student@example.com',
        status: 'active',
        role_id: 'core_student',
        created_at: new Date()
      }
    });
  }

  if ((await client.question.count()) === 0) {
    await client.question.createMany({ data: sampleQuestions });
  }

  if ((await client.image.count()) === 0) {
    await client.image.createMany({
      data: sampleImages.map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        version: i.version,
        description: i.description,
        file_name: i.fileName,
        size: i.size,
        upload_date: new Date(i.uploadDate),
      }))
    });
  }

  if ((await client.courseCase.count()) === 0) {
    for (const c of sampleCourseCases) {
      await client.courseCase.create({
        data: {
          id: c.id,
          title: c.title,
          description: c.description,
          category: c.category,
          upload_date: new Date(c.uploadDate),
          files: { createMany: { data: c.files.map(f => ({ ...f })) } }
        }
      });
    }
  }

  if ((await client.instance.count()) === 0) {
    await client.instance.createMany({
      data: sampleInstances.map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        status: i.status,
        ip_address: i.ports,
        image_name: i.imageName,
        cpu_usage: i.cpuUsage,
        memory_usage: i.memoryUsage,
        disk_usage: i.diskUsage,
        uptime: i.uptime,
        node_id: i.nodeId ?? undefined,
        created_at: new Date(i.createdAt),
      }))
    });
  }
}
