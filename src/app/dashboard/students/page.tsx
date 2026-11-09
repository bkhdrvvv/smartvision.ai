import { Topbar, PageBody, Panel } from "@/components/dash/Shell";
import { AddStudentForm, AttendanceStats, StudentList } from "@/components/dash/Students";
import { SchoolTimes } from "@/components/dash/MorePanels";
import { PlanLock } from "@/components/dash/PlanLock";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { botLink } from "@/lib/telegram";
import { planFeatures } from "@/lib/plan";
import { getDict } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const hm = (d: Date) => d.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });

export default async function StudentsPage() {
  const user = await requireCustomer();
  const { d, f } = await getDict();
  const org = user.organization;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  const [all, feats] = await Promise.all([
    db.student.findMany({ where: { organizationId: org.id }, include: { attendance: { where: { day } } }, orderBy: [{ group: "asc" }, { name: "asc" }] }),
    planFeatures(org.id),
  ]);
  const toRow = async (s: (typeof all)[number]) => ({
    id: s.id, name: s.name, group: s.group, photo: !!s.photoKey, parents: s.parentChats.length,
    link: s.kind === "STUDENT" ? await botLink(`p_${s.parentCode}`) : null,
    came: s.attendance[0] ? hm(s.attendance[0].firstSeenAt) : null,
    left: s.attendance[0] ? hm(s.attendance[0].lastSeenAt) : null,
    late: !!s.attendance[0] && hm(s.attendance[0].firstSeenAt) > org.schoolStart,
  });
  const students = await Promise.all(all.filter((s) => s.kind !== "TEACHER").map(toRow));
  const teachers = await Promise.all(all.filter((s) => s.kind === "TEACHER").map(toRow));
  const canEdit = user.orgRole !== "VIEWER";
  const canTeachers = feats.has("teacherAttendance");
  return (
    <>
      <Topbar crumb={`${d.nav.dashboard} / ${f.menu.students}`} title={f.students.title} chip={<AttendanceStats present={students.filter((r) => r.came).length} total={students.length} />} />
      <PageBody>
        {!feats.has("faceAttendance") && <PlanLock service={org.service} feature="faceAttendance" />}
        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <div className="space-y-5">
            {canEdit && <Panel title={f.students.add}><AddStudentForm canEdit={canEdit} teachers={canTeachers} /></Panel>}
            <Panel title={f.more.schoolTimes}><SchoolTimes start={org.schoolStart} end={org.schoolEnd} report={org.absentReportAt} canEdit={canEdit} /></Panel>
            <Panel title={f.students.parent}>
              <p className="text-[13px] text-fg-muted">{f.students.parentHint}</p>
              {org.service !== "SCHOOL" && <p className="mt-2 text-[12px] text-fg-dim">{f.students.schoolOnly}</p>}
            </Panel>
          </div>
          <div className="space-y-5">
            <Panel title={`${f.x.studentsList} · ${f.students.today} ${day}`}>
              <StudentList rows={students} canEdit={canEdit} />
            </Panel>
            <Panel title={`${f.x.teachers} · ${teachers.filter((t) => t.came).length} / ${teachers.length}`}>
              {canTeachers ? <StudentList rows={teachers} canEdit={canEdit} /> : <PlanLock service={org.service} feature="teacherAttendance" />}
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
