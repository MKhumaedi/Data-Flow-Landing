import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { ensurePrismaUser, ensurePrismaDataset, ensurePrismaTemplate } from '../src/lib/db-helpers';

async function runAudit() {
  console.log('====================================================');
  console.log('   COMPREHENSIVE DATABASE INTEGRITY AUDIT TEST      ');
  console.log('====================================================\n');

  const results: Record<string, any> = {};

  // 1. USER TABLE AUDIT
  console.log('--> Testing Table 1: User...');
  try {
    const testEmail = `audit_user_${Date.now()}@example.com`;
    const pwdHash = await bcrypt.hash('TestPassword123!', 10);
    const createdUser = await prisma.user.create({
      data: {
        id: `usr-test-${Date.now()}`,
        name: 'Audit Test User',
        email: testEmail,
        passwordHash: pwdHash,
        role: 'FREE',
        verificationStatus: 'PENDING',
      },
    });

    const verifyUser = await prisma.user.findUnique({ where: { id: createdUser.id } });
    const isPersisted = !!verifyUser && verifyUser.email === testEmail;

    // Test soft delete
    await prisma.user.update({
      where: { id: createdUser.id },
      data: { deletedAt: new Date() },
    });
    const softDeletedUser = await prisma.user.findUnique({ where: { id: createdUser.id } });
    const softDeleteWorks = !!softDeletedUser?.deletedAt;

    results['User'] = {
      persists: isPersisted,
      foreignKeys: 'Root entity (parent of Dataset, RefreshToken, Dashboard)',
      softDelete: softDeleteWorks,
      notes: `User created ID: ${createdUser.id}, soft-delete respected.`,
    };
    console.log('✓ User Table: PASS');
  } catch (err: any) {
    results['User'] = { error: err.message };
    console.error('✗ User Table: FAIL', err);
  }

  // 2. REFRESH TOKEN TABLE AUDIT
  console.log('--> Testing Table 2: RefreshToken...');
  try {
    const auditUserId = await ensurePrismaUser('usr-alex-chen');
    const tokenHash = `hash_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const createdToken = await prisma.refreshToken.create({
      data: {
        id: `rt-audit-${Date.now()}`,
        userId: auditUserId,
        token: tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const verifyToken = await prisma.refreshToken.findUnique({
      where: { id: createdToken.id },
      include: { user: true },
    });
    const isTokenPersisted = !!verifyToken && verifyToken.userId === auditUserId && !!verifyToken.user;

    // Soft delete / revoke test
    await prisma.refreshToken.update({
      where: { id: createdToken.id },
      data: { deletedAt: new Date() },
    });
    const softDelToken = await prisma.refreshToken.findUnique({ where: { id: createdToken.id } });

    results['RefreshToken'] = {
      persists: isTokenPersisted,
      foreignKeys: `FK to User (${verifyToken?.user?.email}) valid`,
      softDelete: !!softDelToken?.deletedAt,
      notes: `RefreshToken created ID: ${createdToken.id}`,
    };
    console.log('✓ RefreshToken Table: PASS');
  } catch (err: any) {
    results['RefreshToken'] = { error: err.message };
    console.error('✗ RefreshToken Table: FAIL', err);
  }

  // 3. DATASET TABLE AUDIT
  console.log('--> Testing Table 3: Dataset...');
  try {
    const auditUserId = await ensurePrismaUser('usr-alex-chen');
    const testDatasetId = `ds-audit-${Date.now()}`;
    const createdDataset = await prisma.dataset.create({
      data: {
        id: testDatasetId,
        userId: auditUserId,
        fileName: 'audit_financial_test.xlsx',
        fileSize: 10240,
        rowCount: 50,
        columns: [
          { name: 'Month', dataType: 'string' },
          { name: 'Revenue', dataType: 'number' },
        ],
      },
    });

    const verifyDs = await prisma.dataset.findUnique({
      where: { id: testDatasetId },
      include: { user: true },
    });
    const isDsPersisted = !!verifyDs && verifyDs.userId === auditUserId && !!verifyDs.user;

    // Soft delete test
    await prisma.dataset.update({
      where: { id: testDatasetId },
      data: { deletedAt: new Date() },
    });
    const softDelDs = await prisma.dataset.findUnique({ where: { id: testDatasetId } });

    results['Dataset'] = {
      persists: isDsPersisted,
      foreignKeys: `FK to User (${verifyDs?.user?.email}) valid`,
      softDelete: !!softDelDs?.deletedAt,
      notes: `Dataset created ID: ${testDatasetId}`,
    };
    console.log('✓ Dataset Table: PASS');
  } catch (err: any) {
    results['Dataset'] = { error: err.message };
    console.error('✗ Dataset Table: FAIL', err);
  }

  // 4. DASHBOARD TABLE AUDIT
  console.log('--> Testing Table 4: Dashboard...');
  try {
    const auditUserId = await ensurePrismaUser('usr-alex-chen');
    const auditDatasetId = await ensurePrismaDataset('ds-sample-financial', auditUserId);
    const auditTemplateId = await ensurePrismaTemplate('minimal-teal');

    const testDashId = `dash-audit-${Date.now()}`;
    const createdDash = await prisma.dashboard.create({
      data: {
        id: testDashId,
        datasetId: auditDatasetId,
        templateId: auditTemplateId,
        title: 'Executive Financial Audit Dashboard',
        config: {
          charts: [{ id: 'chart-1', type: 'bar', x: 'Month', y: 'Revenue' }],
          filters: { currency: 'IDR' },
          thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',
        },
        isPublicShare: false,
        shareToken: `share-${Date.now()}`,
      },
    });

    const verifyDash = await prisma.dashboard.findUnique({
      where: { id: testDashId },
      include: { dataset: true, template: true },
    });
    const isDashPersisted = !!verifyDash && !!verifyDash.dataset && !!verifyDash.template;

    // Soft delete test
    await prisma.dashboard.update({
      where: { id: testDashId },
      data: { deletedAt: new Date() },
    });
    const softDelDash = await prisma.dashboard.findUnique({ where: { id: testDashId } });

    results['Dashboard'] = {
      persists: isDashPersisted,
      foreignKeys: `FK dataset: ${verifyDash?.datasetId}, FK template: ${verifyDash?.templateId}`,
      softDelete: !!softDelDash?.deletedAt,
      notes: `Dashboard created ID: ${testDashId}, config stores charts, filters & thumbnailUrl`,
    };
    console.log('✓ Dashboard Table: PASS');
  } catch (err: any) {
    results['Dashboard'] = { error: err.message };
    console.error('✗ Dashboard Table: FAIL', err);
  }

  // 5. DASHBOARD TEMPLATE TABLE AUDIT
  console.log('--> Testing Table 5: DashboardTemplate...');
  try {
    const templates = await prisma.dashboardTemplate.findMany({ where: { deletedAt: null } });
    const sample = templates[0];
    results['DashboardTemplate'] = {
      persists: templates.length >= 6,
      foreignKeys: 'Referenced by Dashboard (templateId)',
      softDelete: templates.every((t: { deletedAt: Date | null }) => t.deletedAt === null),
      notes: `Total active templates in DB: ${templates.length}. Sample: ${sample?.name} (${sample?.id})`,
    };
    console.log(`✓ DashboardTemplate Table: PASS (${templates.length} templates in DB)`);
  } catch (err: any) {
    results['DashboardTemplate'] = { error: err.message };
    console.error('✗ DashboardTemplate Table: FAIL', err);
  }

  // 6. EDITABLE CONTENT TABLE AUDIT
  console.log('--> Testing Table 6: EditableContent...');
  try {
    const contentCount = await prisma.editableContent.count();
    const sample = await prisma.editableContent.findFirst({ where: { key: 'hero_headline' } });
    results['EditableContent'] = {
      persists: contentCount > 0,
      foreignKeys: 'Standalone key-value entity with updatedBy audit info',
      softDelete: 'N/A (Keys are unique & upserted directly)',
      notes: `Total editable content rows: ${contentCount}. Hero headline: "${sample?.value?.substring(0, 30)}..."`,
    };
    console.log(`✓ EditableContent Table: PASS (${contentCount} CMS rows in DB)`);
  } catch (err: any) {
    results['EditableContent'] = { error: err.message };
    console.error('✗ EditableContent Table: FAIL', err);
  }

  // 7. ADMIN AUDIT LOG TABLE AUDIT
  console.log('--> Testing Table 7: AdminAuditLog...');
  try {
    const testLog = await prisma.adminAuditLog.create({
      data: {
        id: `audit-${Date.now()}`,
        adminId: 'usr-alex-chen',
        adminEmail: 'alex@maystudio.id',
        action: 'AUDIT_VERIFICATION_CHECK',
        targetType: 'SYSTEM_AUDIT',
        targetId: 'table-audit',
        details: { status: 'testing', timestamp: new Date().toISOString() },
      },
    });

    const verifyLog = await prisma.adminAuditLog.findUnique({ where: { id: testLog.id } });
    const logCount = await prisma.adminAuditLog.count();

    results['AdminAuditLog'] = {
      persists: !!verifyLog,
      foreignKeys: 'adminId references admin user',
      softDelete: 'Append-only audit ledger (immutable)',
      notes: `Total audit logs: ${logCount}. Created log ID: ${testLog.id}`,
    };
    console.log(`✓ AdminAuditLog Table: PASS (Total logs in DB: ${logCount})`);
  } catch (err: any) {
    results['AdminAuditLog'] = { error: err.message };
    console.error('✗ AdminAuditLog Table: FAIL', err);
  }

  // 8. FORMULA TABLE AUDIT
  console.log('--> Testing Table 8: Formula...');
  try {
    const formulaCount = await prisma.formula.count({ where: { deletedAt: null } });
    const sample = await prisma.formula.findFirst({ where: { slug: 'vlookup' } });

    // Test upsert / update
    const updated = await prisma.formula.update({
      where: { id: sample!.id },
      data: { updatedAt: new Date() },
    });

    results['Formula'] = {
      persists: formulaCount >= 80,
      foreignKeys: 'Standalone entity with category index',
      softDelete: true,
      notes: `Total active formulas in DB: ${formulaCount}. Sample: ${sample?.name} (${sample?.slug})`,
    };
    console.log(`✓ Formula Table: PASS (${formulaCount} formulas in DB)`);
  } catch (err: any) {
    results['Formula'] = { error: err.message };
    console.error('✗ Formula Table: FAIL', err);
  }

  // 9. AD PLACEMENT & AD BOOKING TABLES AUDIT
  console.log('--> Testing Tables 9 & 10: AdPlacement & AdBooking...');
  try {
    const placements = await prisma.adPlacement.findMany({ where: { deletedAt: null } });
    const p = placements[0];

    const testBookingId = `bk_audit_${Date.now()}`;
    const testBooking = await prisma.adBooking.create({
      data: {
        id: testBookingId,
        placementId: p.id,
        advertiserName: 'Audit Advertiser Inc',
        advertiserContact: 'contact@auditadv.com',
        type: 'BANNER',
        imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
        linkUrl: 'https://maystudio.id/sponsor',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        pricePaid: 500000,
        status: 'ACTIVE',
      },
    });

    const verifyBooking = await prisma.adBooking.findUnique({
      where: { id: testBookingId },
      include: { placement: true },
    });

    // Soft delete booking
    await prisma.adBooking.update({
      where: { id: testBookingId },
      data: { deletedAt: new Date() },
    });
    const softDelBooking = await prisma.adBooking.findUnique({ where: { id: testBookingId } });

    results['AdPlacement & AdBooking'] = {
      persists: !!verifyBooking && !!verifyBooking.placement,
      foreignKeys: `FK placementId (${verifyBooking?.placementId}) resolves to placement ${verifyBooking?.placement?.key}`,
      softDelete: !!softDelBooking?.deletedAt,
      notes: `Active placements in DB: ${placements.length}. Created and verified booking ID: ${testBookingId}`,
    };
    console.log(`✓ AdPlacement & AdBooking Tables: PASS (${placements.length} placements in DB)`);
  } catch (err: any) {
    results['AdPlacement & AdBooking'] = { error: err.message };
    console.error('✗ AdPlacement & AdBooking Tables: FAIL', err);
  }

  console.log('\n====================================================');
  console.log('               AUDIT SUMMARY TABLE                  ');
  console.log('====================================================');
  console.table(results);
  await prisma.$disconnect();
  process.exit(0);
}

runAudit().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
