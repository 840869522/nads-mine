import { PrismaClient } from '@prisma/client';
import { getPrisma } from './init';

export async function getRoles() {
  const prisma = await getPrisma();
  const roles = await prisma.role.findMany({
    include: { rolePermissions: true }
  });
  return roles.map(r => ({
    id: r.id,
    nameKey: r.name_key,
    nameDisplay: r.name_display,
    description: r.description,
    permissions: r.rolePermissions.map(p => p.permission_key)
  }));
}

export async function createRole(data: { id: string; nameKey: string; nameDisplay: string; description: string; permissions: string[] }) {
  const prisma = await getPrisma();
  await prisma.role.create({
    data: {
      id: data.id,
      name_key: data.nameKey,
      name_display: data.nameDisplay,
      description: data.description,
      rolePermissions: { createMany: { data: data.permissions.map(p => ({ permission_key: p })) } }
    }
  });
}

export async function updateRole(data: { id: string; nameKey: string; nameDisplay: string; description: string; permissions: string[] }) {
  const prisma = await getPrisma();
  await prisma.role.update({
    where: { id: data.id },
    data: {
      name_key: data.nameKey,
      name_display: data.nameDisplay,
      description: data.description,
      rolePermissions: {
        deleteMany: {},
        createMany: { data: data.permissions.map(p => ({ permission_key: p })) }
      }
    }
  });
}

export async function deleteRole(id: string) {
  const prisma = await getPrisma();
  await prisma.role.delete({ where: { id } });
}

export async function getUsers() {
  const prisma = await getPrisma();
  const users = await prisma.user.findMany({ include: { role: true } });
  return users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role.name_key,
    email: u.email,
    status: u.status,
    createdAt: u.created_at.toISOString()
  }));
}

export async function findUserByUsername(username: string) {
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true }
  });
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    passwordHash: user.password_hash,
    role: user.role.name_key
  };
}

// 创建新用户
export async function createUser(data: any) {
  const prisma = await getPrisma();
  await prisma.user.create({
    data: {
      id: data.id,
      username: data.username,
      password_hash: data.passwordHash,
      email: data.email,
      status: data.status,
      role_id: data.roleId.startsWith('core_') ? data.roleId : `core_${data.roleId}`,
      created_at: new Date()
    }
  });
}

// 更新用户
export async function updateUser(data: any) {
  const prisma = await getPrisma();
  await prisma.user.update({
    where: { id: data.id },
    data: {
      username: data.username,
      password_hash: data.passwordHash,
      email: data.email,
      status: data.status,
      role_id: data.roleId.startsWith('core_') ? data.roleId : `core_${data.roleId}`
    }
  });
}

// 删除用户
export async function deleteUser(id: string) {
  const prisma = await getPrisma();
  await prisma.user.delete({ where: { id } });
}

export async function getQuestions() {
  const prisma = await getPrisma();

  // 增加 orderBy 条件，确保问题按 id 升序排列
  const rows = await prisma.question.findMany({
    orderBy: {
      id: 'asc',
    },
  });

  return rows.map(r => ({
    id: r.id,         // 现在 r.id 的类型是 number
    text: r.text,
    type: r.type,     // 移除了不安全的 `as any`
    options: r.options ? JSON.parse(r.options) : undefined
  }));
}
export async function createQuestion(data: { text: string; type: string; options?: string }) {
  const prisma = await getPrisma();

  // 从传入的 data 对象中，只提取我们明确需要的字段
  const { text, type, options } = data;

  // 使用这些提取出的字段构建一个干净的 data 对象传给 Prisma
  // 这样可以确保 id 由数据库自动生成，且不会传入任何多余的字段
  return prisma.question.create({
    data: {
      text,
      type,
      options,
    },
  });
}

export async function getImages() {
  const prisma = await getPrisma();
  return prisma.image.findMany();
}

export async function getCourseCases() {
  const prisma = await getPrisma();
  const cases = await prisma.courseCase.findMany({ include: { files: true } });
  return cases.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    uploadDate: c.upload_date.toISOString(),
    files: c.files.map(f => ({ id: f.id, name: f.name, format: f.format as any, url: f.url, size: f.size }))
  }));
}

export async function getInstances() {
  const prisma = await getPrisma();
  const instances = await prisma.instance.findMany();
  return instances.map(i => ({
    id: i.id,
    name: i.name,
    type: i.type,
    status: i.status,
    ports: i.ip_address,
    imageName: i.image_name,
    cpuUsage: i.cpu_usage,
    memoryUsage: i.memory_usage,
    diskUsage: i.disk_usage,
    uptime: i.uptime,
    nodeId: i.node_id ?? undefined,
    createdAt: i.created_at.toISOString()
  }));
}

export async function createImage(data: any) {
  const prisma = await getPrisma();
  await prisma.image.create({ data: { ...data, upload_date: new Date(data.uploadDate) } });
}

// 更新镜像信息
export async function updateImage(data: any) {
  const prisma = await getPrisma();
  await prisma.image.update({
    where: { id: data.id },
    data: { ...data, upload_date: new Date(data.uploadDate) }
  });
}

// 删除镜像
export async function deleteImage(id: string) {
  const prisma = await getPrisma();
  await prisma.image.delete({ where: { id } });
}

export async function createCourseCase(data: any) {
  const prisma = await getPrisma();
  await prisma.courseCase.create({
    data: {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      upload_date: new Date(data.uploadDate),
      files: { createMany: { data: data.files } }
    }
  });
}

// 更新课程案例
export async function updateCourseCase(data: any) {
  const prisma = await getPrisma();
  await prisma.courseCase.update({
    where: { id: data.id },
    data: {
      title: data.title,
      description: data.description,
      category: data.category,
      upload_date: new Date(data.uploadDate)
    }
  });
  // 重新保存附件
  await prisma.courseCaseFile.deleteMany({ where: { case_id: data.id } });
  await prisma.courseCaseFile.createMany({
    data: data.files.map((f: any) => ({ ...f, case_id: data.id }))
  });
}

// 删除课程案例
export async function deleteCourseCase(id: string) {
  const prisma = await getPrisma();
  await prisma.courseCaseFile.deleteMany({ where: { case_id: id } });
  await prisma.courseCase.delete({ where: { id } });
}

export async function createInstance(data: any) {
  const prisma = await getPrisma();
  await prisma.instance.create({ data: { ...data, created_at: new Date(data.createdAt) } });
}

// 更新实例
export async function updateInstance(data: any) {
  const prisma = await getPrisma();
  await prisma.instance.update({
    where: { id: data.id },
    data: { ...data, created_at: new Date(data.createdAt) }
  });
}

// 删除实例
export async function deleteInstance(id: string) {
  const prisma = await getPrisma();
  await prisma.instance.delete({ where: { id } });
}
