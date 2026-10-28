// Executed inside the bound clinic container. Input only through stdin.
const { PrismaClient } = require('@prisma/client');
const crypto = require('node:crypto');
const p = new PrismaClient();
const x = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
const roles = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LAB_TECH', 'ACCOUNTANT'];
const selected = { id:true, name:true, email:true, role:true, isActive:true, isHospitalAdmin:true };
(async () => {
  let result;
  if (x.action === 'USER_LIST') {
    result = { users: await p.user.findMany({where:{hospitalId:x.tenantId,isPlatformOwner:false},select:selected,orderBy:{name:'asc'},take:500}) };
  } else {
    result = await p.$transaction(async tx => {
      // Clinic row lock serializes administrator changes and protects last admin.
      const clinics = await tx.$queryRaw`SELECT id FROM Hospital WHERE id = ${x.tenantId} FOR UPDATE`;
      if (clinics.length !== 1) throw Error('Clinic binding not found');
      if (x.action === 'USER_CREATE') {
        if (!roles.includes(x.role)) throw Error('Unsupported role');
        const id = 'owner_' + x.operationId;
        const existing = await tx.user.findFirst({where:{id,hospitalId:x.tenantId,isPlatformOwner:false},select:selected});
        if (existing) return {user:existing};
        const [firstName,...rest] = x.name.split(' ');
        return { user: await tx.user.create({data:{id,hospitalId:x.tenantId,name:x.name,email:x.email,password:x.passwordHash,role:x.role,isHospitalAdmin:x.role==='ADMIN',isPlatformOwner:false,isActive:true,mustChangePassword:true,staff:{create:{hospitalId:x.tenantId,employeeId:'OWN-'+crypto.createHash('sha256').update(id).digest('hex').slice(0,20),firstName,lastName:rest.join(' '),phone:'',email:x.email,isActive:true}}},select:selected}) };
      }
      const user = await tx.user.findFirst({where:{id:x.userId,hospitalId:x.tenantId,isPlatformOwner:false}});
      if (!user) throw Error('User not found in this clinic');
      if (x.role !== undefined && !roles.includes(x.role)) throw Error('Unsupported role');
      if (user.role === 'ADMIN' && user.isActive && (x.isActive === false || (x.role !== undefined && x.role !== 'ADMIN'))) {
        const other = await tx.user.count({where:{hospitalId:x.tenantId,role:'ADMIN',isActive:true,isPlatformOwner:false,id:{not:user.id}}});
        if (!other) throw Error('Keep at least one active clinic administrator');
      }
      const data = { ...(x.role !== undefined ? {role:x.role,isHospitalAdmin:x.role==='ADMIN'}:{}), ...(x.isActive !== undefined ? {isActive:x.isActive}:{}) };
      const updated = await tx.user.update({where:{id:user.id},data,select:selected});
      if (x.isActive !== undefined) await tx.staff.updateMany({where:{userId:user.id,hospitalId:x.tenantId},data:{isActive:x.isActive}});
      return {user:updated};
    });
  }
  console.log(JSON.stringify(result));
})().catch(e => {console.error(e.code === 'P2002' ? 'Email already exists' : e.code ? 'User operation failed ('+e.code+')' : ['Clinic binding not found','Unsupported role','User not found in this clinic','Keep at least one active clinic administrator'].includes(e.message) ? e.message : 'Clinic account schema validation failed');process.exitCode=1}).finally(()=>p.$disconnect());
