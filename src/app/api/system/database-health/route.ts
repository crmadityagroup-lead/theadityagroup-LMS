import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const startedAt = performance.now();
  try {
    const [health, dealers, brands, models, enquiryCategories, enquiryTypes, users, supportTickets, otpRecords, userEnquiryTypes, leads, activities, followups, departmentUpdates, loginHistory, databaseTime] = await Promise.all([
      db.$queryRawUnsafe<Array<{ ok: number }>>('SELECT 1 AS ok'),
      db.crmDealer.count(),
      db.crmBrand.count(),
      db.crmModel.count(),
      db.crmEnquiryCategory.count(),
      db.crmEnquiryType.count(),
      db.crmUser.count(),
      db.crmSupportTicket.count(),
      db.crmOtpCode.count(),
      db.crmUserEnquiryType.count(),
      db.crmLead.count(),
      db.crmLeadActivity.count(),
      db.crmLeadFollowup.count(),
      db.crmDepartmentUpdate.count(),
      db.crmLoginHistory.count(),
      db.$queryRawUnsafe<Array<{ database_time: Date }>>('SELECT NOW() AS database_time'),
    ]);
    const latencyMs = Math.round(performance.now() - startedAt);
    const status = latencyMs < 300 ? 'Excellent' : latencyMs < 800 ? 'Good' : latencyMs < 2000 ? 'Slow' : 'Degraded';
    return NextResponse.json({
      status,
      connected: health[0]?.ok === 1,
      latency_ms: latencyMs,
      database_time: databaseTime[0]?.database_time || new Date(),
      tables: {
        Dealers: dealers,
        Brands: brands,
        Models: models,
        'Enquiry Categories': enquiryCategories,
        'Enquiry Types': enquiryTypes,
        Users: users,
        'Support Tickets': supportTickets,
        'OTP Records': otpRecords,
        'User Enquiry Types': userEnquiryTypes,
        Leads: leads,
        'Lead Activities': activities,
        'Lead Follow-ups': followups,
        'Department Updates': departmentUpdates,
        'Login History': loginHistory,
      },
      checked_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ status: 'Offline', connected: false, error: error?.message || 'Database check failed', checked_at: new Date().toISOString() }, { status: 503 });
  }
}
