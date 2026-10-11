import { sql, type SQL } from 'drizzle-orm';
import { rowsOf, type Tx } from '../client';

/*
 * What must be true of seeded data, whatever its size or its "today". Each check is a query that
 * returns the rows that break a rule; a healthy seed returns none.
 *
 *   pnpm db:verify-seed        against the local database
 *   tests/db/seed.test.ts      against a freshly seeded test database, on every test run
 *
 * The seed bypasses the services (they do not exist until Phase 2), so these checks are what stand
 * between a mistake in the seed and a demonstration that quietly shows nonsense. Each wave adds its own.
 */

interface Check {
  rule: string;
  /** Rows that break the rule. The first column is shown as an example. */
  broken: SQL;
}

const checks: Check[] = [
  {
    rule: 'every organisation has exactly one active academic year',
    broken: sql`
      select o.slug from orgs o
      left join academic_years y on y.org_id = o.id and y.status = 'active' and y.deleted_at is null
      where o.deleted_at is null
      group by o.id, o.slug having count(y.id) <> 1`,
  },
  {
    rule: 'every active student has exactly one active enrolment in the active year',
    broken: sql`
      select s.admission_no from students s
      join academic_years y on y.org_id = s.org_id and y.status = 'active' and y.deleted_at is null
      left join enrollments e on e.student_id = s.id and e.academic_year_id = y.id
        and e.status = 'active' and e.deleted_at is null
      where s.status = 'active' and s.deleted_at is null
      group by s.id, s.admission_no having count(e.id) <> 1`,
  },
  {
    rule: 'a student who has left has no active enrolment',
    broken: sql`
      select s.admission_no from students s
      join enrollments e on e.student_id = s.id and e.status = 'active' and e.deleted_at is null
      where s.status <> 'active' and s.deleted_at is null`,
  },
  {
    rule: 'an active enrolment is at the campus the student belongs to, in a section of that campus and grade',
    broken: sql`
      select s.admission_no from enrollments e
      join students s on s.id = e.student_id
      join sections c on c.id = e.section_id
      where e.deleted_at is null and e.status = 'active'
        and (e.branch_id <> s.branch_id or c.branch_id <> e.branch_id or c.grade_id <> e.grade_id
             or c.academic_year_id <> e.academic_year_id or e.org_id <> s.org_id)`,
  },
  {
    rule: 'no section holds more students than its capacity',
    broken: sql`
      select c.name from sections c
      join enrollments e on e.section_id = c.id and e.status = 'active' and e.deleted_at is null
      where c.deleted_at is null
      group by c.id, c.name, c.capacity having count(*) > c.capacity`,
  },
  {
    rule: 'roll numbers in a section run from 1 with no gap',
    broken: sql`
      select c.name from sections c
      join enrollments e on e.section_id = c.id and e.status = 'active' and e.deleted_at is null
      where c.deleted_at is null
      group by c.id, c.name
      having min(e.roll_no) <> 1 or max(e.roll_no) <> count(*) or count(e.roll_no) <> count(*)`,
  },
  {
    rule: 'every student has exactly one primary guardian, who belongs to the student’s family',
    broken: sql`
      select s.admission_no from students s
      left join student_guardians l on l.student_id = s.id and l.is_primary and l.deleted_at is null
      left join guardians g on g.id = l.guardian_id and g.deleted_at is null
      where s.deleted_at is null
      group by s.id, s.admission_no, s.family_id
      having count(l.id) <> 1 or bool_or(g.family_id is distinct from s.family_id)`,
  },
  {
    rule: 'a family’s primary guardian is one of its own guardians, alive',
    broken: sql`
      select f.family_code from families f
      left join guardians g on g.id = f.primary_guardian_id and g.deleted_at is null
      where f.deleted_at is null
        and (g.id is null or g.family_id <> f.id or g.is_deceased or g.org_id <> f.org_id)`,
  },
  {
    rule: 'a student, their family and their guardians all belong to one organisation',
    broken: sql`
      select s.admission_no from students s join families f on f.id = s.family_id
      where s.org_id <> f.org_id
      union all
      select g.full_name from guardians g join families f on f.id = g.family_id
      where g.org_id <> f.org_id`,
  },
  {
    rule: 'every membership points at a person record of its own kind in its own organisation',
    broken: sql`
      select m.id::text from memberships m
      left join staff p1 on p1.id = m.staff_id and p1.org_id = m.org_id and p1.deleted_at is null
      left join guardians p2 on p2.id = m.guardian_id and p2.org_id = m.org_id and p2.deleted_at is null
      left join students p3 on p3.id = m.student_id and p3.org_id = m.org_id and p3.deleted_at is null
      where m.deleted_at is null
        and ((m.kind = 'staff' and p1.id is null) or (m.kind = 'guardian' and p2.id is null)
             or (m.kind = 'student' and p3.id is null))`,
  },
  {
    rule: 'every section of the active year has a class teacher who works at that campus',
    broken: sql`
      select c.name from sections c
      join academic_years y on y.id = c.academic_year_id and y.status = 'active'
      left join staff t on t.id = c.class_teacher_id and t.status in ('active', 'on_leave')
        and t.home_branch_id = c.branch_id and t.deleted_at is null
      where c.deleted_at is null and t.id is null`,
  },
  {
    rule: 'a subject is taught by someone who is on the staff and can teach it',
    broken: sql`
      select t.full_name from section_subjects a
      join grade_subjects gs on gs.id = a.grade_subject_id
      join staff t on t.id = a.teacher_id
      where a.deleted_at is null
        and (t.status not in ('active', 'on_leave') or t.staff_type <> 'teaching'
             or not (gs.subject_id = any (t.teachable_subject_ids)))`,
  },
  {
    rule: 'a teacher’s lessons in a week do not exceed their limit',
    broken: sql`
      select t.full_name from section_subjects a
      join grade_subjects gs on gs.id = a.grade_subject_id
      join staff t on t.id = a.teacher_id
      where a.deleted_at is null and t.max_lessons_per_week is not null
      group by t.id, t.full_name, t.max_lessons_per_week
      having sum(coalesce(a.periods_per_week, gs.periods_per_week)) > t.max_lessons_per_week`,
  },
  {
    rule: 'every member of staff has private details, a primary bank account and an appointment contract',
    broken: sql`
      select s.employee_no from staff s
      where s.deleted_at is null and (
        not exists (select from staff_private p where p.staff_id = s.id and p.deleted_at is null)
        or not exists (select from staff_bank_accounts b where b.staff_id = s.id and b.is_primary and b.deleted_at is null)
        or not exists (select from employment_contracts c where c.staff_id = s.id and c.deleted_at is null))`,
  },
  {
    rule: 'staff who left have a last working day and a closed exit; staff on notice have an exit in progress',
    broken: sql`
      select s.employee_no from staff s
      where s.deleted_at is null and (
        (s.status = 'left' and (s.last_working_day is null or not exists (
           select from staff_exits e where e.staff_id = s.id and e.status = 'closed' and e.deleted_at is null)))
        or (s.status = 'notice' and not exists (
           select from staff_exits e where e.staff_id = s.id and e.status in ('pending', 'clearance', 'settled') and e.deleted_at is null)))`,
  },
  {
    rule: 'a promoted student’s new enrolment is their own',
    broken: sql`
      select i.id::text from promotion_items i
      join enrollments e on e.id = i.new_enrollment_id
      where i.deleted_at is null and e.student_id <> i.student_id`,
  },
  {
    rule: 'the next employee number is beyond every number issued',
    broken: sql`
      select o.slug from orgs o
      join staff s on s.org_id = o.id
      left join number_sequences n on n.org_id = o.id and n.key = 'employee' and n.branch_id is null
      group by o.id, o.slug, n.next_value
      having n.next_value is null or n.next_value <= max(substring(s.employee_no from '[0-9]+$')::int)`,
  },
  {
    rule: 'the next admission number of each campus and year is beyond every number issued',
    broken: sql`
      select issued.prefix from (
        select s.org_id, b.id as branch_id, split_part(s.admission_no, '-', 2) as period,
               split_part(s.admission_no, '-', 1) || '-' || split_part(s.admission_no, '-', 2) as prefix,
               max(split_part(s.admission_no, '-', 3)::int) as last_issued
        from students s
        join branches b on b.org_id = s.org_id and b.code = split_part(s.admission_no, '-', 1)
        group by 1, 2, 3, 4
      ) issued
      left join number_sequences n on n.org_id = issued.org_id and n.key = 'admission'
        and n.branch_id = issued.branch_id and n.period = issued.period
      where n.next_value is null or n.next_value <= issued.last_issued`,
  },
  // ---- Wave 2
  {
    rule: 'an enrolled application names a student, and that student names the application',
    broken: sql`
      select a.application_no from admission_applications a
      left join students s on s.id = a.student_id
      where a.deleted_at is null and a.status = 'enrolled'
        and (s.id is null or s.source_application_id is distinct from a.id)`,
  },
  {
    rule: 'an application that has moved past submission was submitted; one with an offer has a decision',
    broken: sql`
      select a.application_no from admission_applications a
      where a.deleted_at is null and (
        (a.status <> 'draft' and a.submitted_at is null)
        or (a.status in ('offered', 'accepted', 'waitlisted', 'rejected', 'enrolled') and a.decided_at is null))`,
  },
  {
    rule: 'an enquiry that is closed has no follow-up waiting',
    broken: sql`
      select e.enquiry_no from admission_enquiries e
      where e.deleted_at is null and e.status in ('converted', 'lost') and e.next_follow_up_on is not null`,
  },
  {
    rule: 'the next enquiry and application numbers are beyond every number issued',
    broken: sql`
      select issued.key from (
        select org_id, 'enquiry' as key, split_part(enquiry_no, '-', 2) as period,
               max(split_part(enquiry_no, '-', 3)::int) as last_issued
        from admission_enquiries group by 1, 3
        union all
        select org_id, 'application', split_part(application_no, '-', 2),
               max(split_part(application_no, '-', 3)::int)
        from admission_applications group by 1, 3
      ) issued
      left join number_sequences n on n.org_id = issued.org_id and n.key = issued.key
        and n.branch_id is null and n.period = issued.period
      where n.next_value is null or n.next_value <= issued.last_issued`,
  },
  {
    rule: 'a certificate is issued in a template of its own type, to a person of the kind that type is for',
    broken: sql`
      select coalesce(c.number, c.id::text) from certificates c
      join certificate_types t on t.id = c.type_id
      join certificate_templates m on m.id = c.template_id
      where c.deleted_at is null and (m.type_id <> c.type_id
        or (t.issued_to = 'student' and c.student_id is null)
        or (t.issued_to = 'staff' and c.staff_id is null))`,
  },
  {
    rule: 'every certificate type has a default active template in English and in Urdu',
    broken: sql`
      select t.key from certificate_types t
      cross join (values ('en'), ('ur')) as language(code)
      left join certificate_templates m on m.type_id = t.id and m.language = language.code
        and m.is_default and m.status = 'active' and m.deleted_at is null
      where t.deleted_at is null and m.id is null`,
  },
  {
    rule: 'a gate pass has left the gate only once approved, and come back only after leaving',
    broken: sql`
      select p.id::text from gate_passes p
      where p.deleted_at is null and (
        ((p.exited_at is not null) <> (p.status in ('exited', 'returned')))
        or ((p.returned_at is not null) <> (p.status = 'returned'))
        or p.returned_at < p.exited_at)`,
  },
  {
    rule: 'a visitor still inside came in today',
    broken: sql`
      select v.full_name from visitors v
      where v.deleted_at is null and v.checked_out_at is null and not v.is_flagged
        and (v.checked_in_at at time zone 'Asia/Karachi')::date
            <> (select max((x.checked_in_at at time zone 'Asia/Karachi')::date) from visitors x where x.org_id = v.org_id)`,
  },
  {
    rule: 'an alumni record belongs to a student who has graduated',
    broken: sql`
      select s.admission_no from alumni a join students s on s.id = a.student_id
      where a.deleted_at is null and (s.status <> 'graduated' or s.left_on is null or s.org_id <> a.org_id)`,
  },
  {
    rule: 'a person on an attendance machine works, or studies, at that campus',
    broken: sql`
      select e.device_user_code from biometric_enrolments e
      left join staff s on s.id = e.staff_id
      left join students t on t.id = e.student_id
      where e.deleted_at is null
        and coalesce(s.home_branch_id, t.branch_id) is distinct from e.branch_id`,
  },
  // ---- Wave 3
  {
    rule: 'the published timetable places every weekly period of every subject a section studies',
    broken: sql`
      select c.name from section_subjects a
      join grade_subjects gs on gs.id = a.grade_subject_id
      join subjects sb on sb.id = gs.subject_id
      join sections c on c.id = a.section_id
      join academic_years y on y.id = c.academic_year_id and y.status = 'active'
      left join timetables t on t.branch_id = a.branch_id and t.status = 'published' and t.deleted_at is null
      left join timetable_entries e on e.timetable_id = t.id and e.section_subject_id = a.id and e.deleted_at is null
      where a.deleted_at is null and sb.alternative_of_id is null
      group by a.id, c.name, a.periods_per_week, gs.periods_per_week
      having count(e.id) <> coalesce(a.periods_per_week, gs.periods_per_week)`,
  },
  {
    rule: 'a substitute covers a lesson of the absent teacher, and is free at that time',
    broken: sql`
      select x.id::text from substitutions x
      join timetable_entries e on e.id = x.timetable_entry_id
      where x.deleted_at is null and (
        x.substitute_teacher_id = x.absent_teacher_id
        or e.teacher_id is distinct from x.absent_teacher_id
        or e.section_id <> x.section_id or e.lesson_no <> x.lesson_no
        or lower(to_char(x.substitution_date, 'Dy')) <> e.weekday
        or exists (
          select from timetable_entries o
          where o.timetable_id = e.timetable_id and o.deleted_at is null
            and o.teacher_id = x.substitute_teacher_id and o.weekday = e.weekday and o.lesson_no = e.lesson_no))`,
  },
  {
    rule: 'a register that was handed in has a line for every student enrolled in the section that day',
    broken: sql`
      with expected as (
        select s.id as session_id, e.student_id
        from attendance_sessions s
        join enrollments e on e.section_id = s.section_id and e.deleted_at is null
          and e.joined_on <= s.session_date and (e.left_on is null or e.left_on > s.session_date)
        where s.deleted_at is null and s.status in ('submitted', 'locked')
          and not exists (
            select from section_changes sc where sc.enrollment_id = e.id and sc.changed_on > s.session_date)
        union all
        select s.id, e.student_id
        from attendance_sessions s
        join section_changes sc on sc.from_section_id = s.section_id and sc.changed_on > s.session_date
        join enrollments e on e.id = sc.enrollment_id and e.deleted_at is null and e.joined_on <= s.session_date
        where s.deleted_at is null and s.status in ('submitted', 'locked')
      )
      select x.session_id::text from expected x
      left join attendance_records r on r.session_id = x.session_id and r.student_id = x.student_id
        and r.deleted_at is null
      where r.id is null`,
  },
  {
    rule: 'a line in a register belongs to a student who was enrolled that day, at that campus',
    broken: sql`
      select r.id::text from attendance_records r
      join attendance_sessions s on s.id = r.session_id
      join enrollments e on e.id = r.enrollment_id
      where r.deleted_at is null and (
        e.student_id <> r.student_id or r.session_date <> s.session_date or r.branch_id <> s.branch_id
        or e.joined_on > r.session_date or (e.left_on is not null and e.left_on <= r.session_date))`,
  },
  {
    rule: 'leave in a register is backed by an approved request, and approved leave shows as leave',
    broken: sql`
      select r.id::text from attendance_records r
      where r.deleted_at is null and r.status = 'leave' and not exists (
        select from student_leave_requests l
        where l.student_id = r.student_id and l.status = 'approved' and l.deleted_at is null
          and r.session_date between l.from_date and l.to_date)
      union all
      select r.id::text from attendance_records r
      join attendance_sessions s on s.id = r.session_id and s.status in ('submitted', 'locked')
      join student_leave_requests l on l.student_id = r.student_id and l.status = 'approved'
        and l.deleted_at is null and r.session_date between l.from_date and l.to_date
      where r.deleted_at is null and r.status <> 'leave'`,
  },
  {
    rule: 'a register exists only for a school day, unless it was cancelled; its dates follow its state',
    broken: sql`
      select s.id::text from attendance_sessions s
      where s.deleted_at is null and (
        (s.status <> 'cancelled' and (
          extract(isodow from s.session_date) > 5
          or exists (
            select from holidays h
            where h.org_id = s.org_id and h.deleted_at is null
              and s.session_date between h.start_date and h.end_date
              and (h.branch_id is null or h.branch_id = s.branch_id))))
        or (s.status = 'locked' and (s.locked_at is null or s.submitted_at is null))
        or (s.status = 'submitted' and (s.submitted_at is null or s.locked_at is not null))
        or (s.status = 'draft' and (s.submitted_at is not null or s.locked_at is not null)))`,
  },
  {
    rule: 'homework marks stay within the maximum; checked work says who checked it, handed-in work says when',
    broken: sql`
      select b.id::text from homework_submissions b
      join homework h on h.id = b.homework_id
      where b.deleted_at is null and (
        b.marks > h.max_marks or (b.marks is not null and h.max_marks is null)
        or b.branch_id <> h.branch_id
        or (b.status in ('checked', 'returned') and b.checked_by is null)
        or (b.status in ('submitted', 'late') and b.submitted_at is null))`,
  },
  {
    rule: 'a diary that a guardian confirmed reading was published that day',
    broken: sql`
      select k.id::text from diary_acknowledgements k
      where k.deleted_at is null and not exists (
        select from diary_entries d
        where d.section_id = k.section_id and d.entry_date = k.entry_date
          and d.status = 'published' and d.deleted_at is null)`,
  },
  {
    rule: 'progress is recorded on chapters of the subject itself, with the dates its state needs',
    broken: sql`
      select p.id::text from syllabus_progress p
      join section_subjects a on a.id = p.section_subject_id
      join syllabus_units u on u.id = p.unit_id
      where p.deleted_at is null and (
        u.grade_subject_id <> a.grade_subject_id or u.kind = 'unit'
        or (p.status = 'completed' and (p.completed_on is null or p.started_on is null))
        or (p.status <> 'completed' and p.completed_on is not null))`,
  },
  {
    rule: 'a scheme of work never plans more periods in a week than the subject has',
    broken: sql`
      select w.id::text from scheme_weeks w
      join schemes_of_work s on s.id = w.scheme_id
      join grade_subjects gs on gs.id = s.grade_subject_id
      where w.deleted_at is null and w.periods_planned > gs.periods_per_week`,
  },
];

/** Runs every check and returns one line per broken rule. An empty list means the seed is sound. */
export async function verifySeed(tx: Tx): Promise<string[]> {
  const problems: string[] = [];
  for (const check of checks) {
    const rows = rowsOf<Record<string, unknown>>(await tx.execute(check.broken));
    if (rows.length === 0) continue;
    const examples = rows
      .slice(0, 3)
      .map((row) => String(Object.values(row)[0]))
      .join(', ');
    problems.push(`${check.rule}: ${rows.length} broken, for example ${examples}`);
  }
  return problems;
}

export const seedCheckCount = checks.length;
